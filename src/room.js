import { DurableObject } from 'cloudflare:workers';
import { createInitialState, getAllLegalMoves, applyMove } from '../public/rules.js';

// One Room per online game, addressed by room code via env.ROOM.getByName(code).
// State lives in this Durable Object's own SQLite storage, so it survives
// restarts and is the single source of truth both players' clients sync to.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS room (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        state TEXT NOT NULL,
        visits INTEGER NOT NULL DEFAULT 0
      )`
    );

    const existing = [...this.sql.exec(`SELECT id FROM room WHERE id = 0`)][0];
    if (!existing) {
      this.sql.exec(
        `INSERT INTO room (id, state, visits) VALUES (0, ?, 0)`,
        JSON.stringify(createInitialState())
      );
    }
  }

  getState() {
    const row = [...this.sql.exec(`SELECT state FROM room WHERE id = 0`)][0];
    return JSON.parse(row.state);
  }

  saveState(state) {
    this.sql.exec(`UPDATE room SET state = ? WHERE id = 0`, JSON.stringify(state));
  }

  broadcast(message) {
    const json = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(json);
    }
  }

  // First connection to claim a color becomes that color; once both are
  // taken, later connections spectate. A disconnected color's slot frees up
  // immediately since it's based on currently-attached sockets, not history.
  assignColor() {
    let whiteTaken = false;
    let blackTaken = false;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment?.color === 'w') whiteTaken = true;
      if (attachment?.color === 'b') blackTaken = true;
    }
    if (!whiteTaken) return 'w';
    if (!blackTaken) return 'b';
    return 'spectator';
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const color = this.assignColor();
      server.serializeAttachment({ color });
      this.ctx.acceptWebSocket(server);

      server.send(JSON.stringify({
        type: 'welcome',
        payload: { color, state: this.getState() },
      }));

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith('/state')) {
      this.sql.exec(`UPDATE room SET visits = visits + 1 WHERE id = 0`);
      const row = [...this.sql.exec(`SELECT state, visits FROM room WHERE id = 0`)][0];
      return Response.json({ state: JSON.parse(row.state), visits: row.visits });
    }

    return new Response('Room scaffold OK', { status: 200 });
  }

  async webSocketMessage(ws, message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }
    if (data.type !== 'move') return;

    const attachment = ws.deserializeAttachment();
    const color = attachment?.color;
    if (color !== 'w' && color !== 'b') {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Spectators cannot move.' } }));
      return;
    }

    const state = this.getState();
    if (state.turn !== color) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Not your turn.' } }));
      return;
    }

    // Never trust the client's description of the move beyond from/to/promotion —
    // the server independently recomputes every legal move for the current
    // position and only accepts an exact match.
    const { from, to, promotion } = data.payload || {};
    const legalMoves = getAllLegalMoves(state);
    const move = legalMoves.find(
      (m) => m.from === from && m.to === to && (m.promotion ?? null) === (promotion ?? null)
    );

    if (!move) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Illegal move.' } }));
      return;
    }

    const nextState = applyMove(state, move);
    this.saveState(nextState);
    this.broadcast({ type: 'state', payload: { state: nextState, lastMove: move } });
  }

  async webSocketClose(ws, code, reason, wasClean) {
    ws.close(code, reason);
  }
}
