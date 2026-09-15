# Cheese — Feature Roadmap / Workplan

How to read this file: every task is a checkbox. **Depends on** lists tasks that must be
checked off first. **Files** lists what gets created or changed. **Done when** is the exact
test we'll use to call it finished — no vibes-based "looks done."

Order of the whole plan, as required: get hot-seat chess live on the internet first, then add
the computer opponent, then add online rooms, then (last, optional) sound.

---

## Phase 0 — Foundations

Nothing in Phase 1 can start until Phase 0 is done — this is the ground everything else
stands on.

- [x] **0.1 — Create the GitHub repo and push an initial commit**
  Depends on: nothing.
  Files: repo itself, `.gitignore`.
  Done when: a repo named `Cheese` exists on GitHub and `main` has one commit.

- [x] **0.2 — Write README, ProductSpec, and this roadmap**
  Depends on: 0.1.
  Files: `README.md`, `ProductSpec.md`, `FEATUREROADMAP_workplan.md`.
  Done when: all three are pushed to `main` (this task).

- [x] **0.3 — Cloudflare Workers project scaffold**
  Depends on: 0.1.
  Files: `wrangler.jsonc`, `package.json`, `public/index.html` (placeholder page).
  Done when: `wrangler dev` serves the placeholder page locally, and `wrangler deploy`
  publishes it to a live `*.workers.dev` URL. `wrangler.jsonc` already has
  `not_found_handling: "single-page-application"`, today's `compatibility_date`, and
  observability turned on, so later tasks don't have to touch that config again.

- [x] **0.4 — Chess rules engine (`rules.js`) and the perft test**
  Depends on: 0.3 (needs somewhere to run a script from), but not on any UI.
  Files: `src/rules.js`, `test/perft.js`.
  Done when: running the perft script from the start position prints exactly 20 (depth 1),
  400 (depth 2), and 8,902 (depth 3) legal move sequences. This must be correct and fixed
  **before any board, click-to-move, computer opponent, or online code is written** — every
  later mode depends on `rules.js` being right.

---

## Phase 1 — Hot-seat, live on the internet

The whole point of this phase: two people can sit at one screen and play a full, legal game
of chess, cheese-themed, at a public URL — before the computer opponent or online rooms exist.

- [x] **1.1 — Static board and pieces, matching Figma**
  Depends on: 0.3, 0.4.
  Files: `public/index.html`, `public/styles.css`, `public/board.js`.
  Done when: the start position renders with all 32 cheese-styled pieces, laid out to match
  the Figma `Cheese` file, on both desktop and mobile widths.

- [x] **1.2 — Click-to-move with legal-move highlighting**
  Depends on: 1.1.
  Files: `public/board.js` (reads `src/rules.js`).
  Done when: clicking a piece highlights only its legal destination squares (per `rules.js`),
  and clicking anywhere else is not possible as a move — an illegal move cannot be made
  through the UI.

- [x] **1.3 — Special moves: castling, en passant, promotion choice**
  Depends on: 1.2.
  Files: `public/board.js`.
  Done when: each of the three special moves is playable exactly when legal (and not
  offered when illegal), and promotion always asks which piece to become.

- [x] **1.4 — Check, checkmate, and stalemate**
  Depends on: 1.2.
  Files: `public/board.js`.
  Done when: a king in check is visibly marked, a checkmate ends the game with the correct
  winner shown, and a stalemate ends the game and is shown as a draw.

- [x] **1.5 — Turn indicator and hot-seat "pass the device" prompt**
  Depends on: 1.2.
  Files: `public/board.js`, `public/styles.css`.
  Done when: it's always visually obvious whose turn it is, and the board prompts players
  to hand off the device between turns.

- [x] **1.6 — Mouse-eats-piece capture animation**
  Depends on: 1.2.
  Files: `public/board.js`, `public/styles.css`, mouse art assets.
  Done when: every one of the 16 capturable piece types on both sides triggers a mouse
  running in and eating the piece when captured, in a full test game.

- [x] **1.7 — Deploy hot-seat mode live**
  Depends on: 1.1–1.6.
  Files: none new — `wrangler deploy`.
  Done when: a public URL lets two people play a complete, legal hot-seat game start to
  finish, with no illegal move ever possible and no crashes.

---

## Phase 2 — Vs Computer

- [x] **2.1 — Minimax + alpha-beta engine**
  Depends on: 0.4 (`rules.js`).
  Files: `public/ai.js` (moved from the planned `src/ai.js` — like rules.js, it must run in the browser).
  Done when: given any legal position, the engine returns a legal move, searching depth 2,
  within 2 seconds, verified against at least 10 varied test positions.

- [x] **2.2 — Vs Computer mode**
  Depends on: 1.1–1.6 (reuses the board UI), 2.1.
  Files: `public/vs-computer.js` (or a mode flag in `board.js`).
  Done when: a full game is playable against the computer from start to a legal end state
  (checkmate/stalemate), you are always White, and the computer never takes over 2 seconds
  to respond.

- [x] **2.3 — Deploy Vs Computer update**
  Depends on: 2.2.
  Done when: the live URL offers Vs Computer as a mode choice and it works end to end.

---

## Phase 3 — Online rooms

- [x] **3.1 — Durable Object room scaffold**
  Depends on: 0.3, 0.4.
  Files: `src/room.js` (the Durable Object class), `wrangler.jsonc` (add the
  `new_sqlite_classes` migration and the `ROOM` binding).
  Done when: opening a room code creates a Durable Object via `env.ROOM.getByName(roomCode)`
  the first time, and reuses the same one every time after — verified by writing a value on
  one request and reading it back on the next.

- [x] **3.2 — WebSocket connections and player identity**
  Depends on: 3.1.
  Files: `src/room.js`, `public/online.js`.
  Done when: accepting a connection with `ctx.acceptWebSocket()` and storing color with
  `ws.serializeAttachment()` means the first browser to join a room is White, the second is
  Black, and a third is a spectator — verified with three tabs on the same room code.

- [x] **3.3 — Server-side move validation**
  Depends on: 3.2, 0.4 (`rules.js`, reused unchanged on the server).
  Files: `src/room.js`.
  Done when: the server rechecks every incoming move against `rules.js` and rejects (without
  changing state) any move that isn't legal for the room's current position and current
  player's color — including a deliberately-faked illegal move sent straight over the socket.

- [x] **3.4 — Live move sync between both players**
  Depends on: 3.3.
  Files: `src/room.js`, `public/online.js`.
  Done when: a legal move made on one device appears on the other device's board with no
  page refresh and no polling — the server pushes a JSON message (`type`, `payload`) over the
  open WebSocket the instant the move is accepted.

- [x] **3.5 — Refresh-rejoin and "New game"**
  Depends on: 3.4.
  Files: `src/room.js`, `public/online.js`.
  Done when: refreshing mid-game restores the exact position and your correct color (no
  timers involved — state is saved after every move, so there's nothing to lose), and
  clicking "New game" resets the board for both connected players at once.

- [x] **3.6 — Deploy online mode and test on two real devices**
  Depends on: 3.1–3.5.
  Done when: two different physical devices, entering the same room code, play a full legal
  game live against each other on the public URL.

---

## Phase 4 — Optional extra (built last): sound

- [ ] **4.1 — Mouse squeak sound effects**
  Depends on: 1.6 (capture animation to attach the sound to).
  Files: `public/sounds.js`, squeak audio assets.
  Done when: moves and captures trigger an appropriate squeak, in every mode.

- [ ] **4.2 — Background cafe chatter + low hum**
  Depends on: 4.1.
  Files: `public/sounds.js`, ambience audio asset.
  Done when: a looping background ambience plays during a game without cutting out or
  restarting jarringly.

- [ ] **4.3 — Mute control**
  Depends on: 4.1, 4.2.
  Files: `public/sounds.js`, `public/styles.css`.
  Done when: a visible mute toggle silences all sound, persists for the session, and the
  game works normally with audio muted or blocked by the browser.
