import { DurableObject } from 'cloudflare:workers';
import { createInitialState } from '../public/rules.js';

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
    // Move handling arrives in a later task.
  }

  async webSocketClose(ws, code, reason, wasClean) {
    ws.close(code, reason);
  }
}
