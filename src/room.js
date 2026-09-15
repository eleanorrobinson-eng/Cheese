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

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/state')) {
      this.sql.exec(`UPDATE room SET visits = visits + 1 WHERE id = 0`);
      const row = [...this.sql.exec(`SELECT state, visits FROM room WHERE id = 0`)][0];
      return Response.json({ state: JSON.parse(row.state), visits: row.visits });
    }

    return new Response('Room scaffold OK', { status: 200 });
  }
}
