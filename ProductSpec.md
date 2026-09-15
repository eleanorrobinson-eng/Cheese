# Cheese — Product Spec

## 1. What this document is

This is the source of truth for *what* we're building and *what "done" means*. The
[roadmap](FEATUREROADMAP_workplan.md) is the *order* we build it in. If the two ever
disagree, this document wins.

## 2. Glossary

Chess terms and technical terms used throughout this project, defined once.

**Chess terms**

- **Legal move** — a move that follows all of chess's rules for the current position. An
  "illegal move" is anything else — for example, moving a piece through another piece, or
  moving your king into check.
- **Check** — the king is currently under attack and must be gotten out of danger next turn.
- **Checkmate** — the king is in check and there is no legal move to escape it. Game over.
- **Stalemate** — the player to move has no legal move at all, but is *not* in check. The
  game ends as a draw (neither side wins).
- **Castling** — a special one-time move where the king and a rook move together, if neither
  has moved yet and the squares between them are empty and safe.
- **En passant** ("in passing") — a special pawn capture: if an enemy pawn just moved two
  squares and landed beside your pawn, you may capture it as if it had only moved one square,
  but only on the very next move.
- **Promotion** — when a pawn reaches the far end of the board, it must turn into a queen,
  rook, bishop, or knight — the player's choice.

**Technical terms**

- **Cloudflare Worker** — a small piece of code that runs on Cloudflare's servers and answers
  web requests, instead of you running your own server.
- **Durable Object** — one single, always-addressable instance of a Worker that keeps its own
  memory (and, here, its own tiny database) between requests. We use exactly one per game room.
- **WebSocket** — a connection between browser and server that both sides can send messages
  over at any time, instantly, without either side having to ask "anything new?" on a timer.
- **Minimax** — an algorithm where the computer looks ahead a few moves, assumes both players
  always pick their best move, and works backward to decide its own best move now.
- **Alpha-beta pruning** — a speed-up for minimax that skips exploring lines of play that
  can't possibly change the outcome, so the same best move is found faster.
- **Search depth** — how many moves ahead the computer looks. "Depth 2" means: the computer's
  move, then your best reply to it — two half-moves total.
- **Perft test** ("performance test") — a standard way chess programmers check their rules are
  correct: count every possible sequence of moves 1, 2, and 3 moves deep from the start
  position. The correct counts are always 20, then 400, then 8,902. If our count is different,
  our rules have a bug.

## 3. The three modes

### Hot-seat
Two people, one screen, one device. Players take turns making moves for White and then Black.
No account, no save — just an in-progress game on the board in front of you.

### Vs Computer
You always play White. After your move, the browser itself (no server round-trip needed)
calculates Black's reply using minimax with alpha-beta pruning, search depth 2, and must
answer within **2 seconds**.

### Online
Two players each type the same short room code into the game on their own device. The first
person to join a room plays White, the second plays Black, and anyone who joins after that
watches as a spectator. The **server** (not either browser) is the referee: it is the only
thing that decides whether a submitted move is legal and updates the official game state.
Refreshing the page rejoins the same game in progress. Either player can start "New game,"
which resets the board for both.

## 4. The look: cheese and mice

Every visual element is built around a cheese-and-mice theme (matching the Figma file
`Cheese`, file key `avpp7smMt4MKCngLNf66zH`):

- The board and all 32 pieces are rendered as if made of cheese — distinct cheese textures
  or colors per piece type is fine, as long as it's readable as chess at a glance.
- The board sits on a table, with a pink tablecloth showing underneath and around it, so the
  whole scene reads as a cheese board set out on a table rather than a floating game grid.
- Mice animate around the board continuously, independent of gameplay, to keep the scene
  feeling alive.
- **Every capture** triggers a mouse running onto the board and "eating" the captured piece —
  this must happen for all 16 possible captured pieces per side, not just pawns.
- As each UI piece is implemented, the specific colors, spacing, and component layout are
  pulled directly from the Figma file for that screen/component — the Figma file is the
  authority on exact visual details; this spec is the authority on *behavior*.

## 5. Definition of "done"

Full legal chess, in every mode:

- All six piece types move correctly, including check, checkmate, and stalemate detection.
- Castling, en passant, and promotion (with a choice of piece) all work.
- **An illegal move must be impossible to make** — not just discouraged or corrected after
  the fact. The UI only ever lets a player select a legal destination square.
- Vs Computer: the built-in engine always replies with a legal move within 2 seconds, at
  search depth 2.
- Online: the server is the sole authority on whether a move is legal and what the current
  position is. First player in is White, second is Black, everyone else spectates. A page
  refresh rejoins the same in-progress game. "New game" resets the board for both players.

## 6. Out of scope (not building this)

Accounts or logins, chess clocks, ratings, draw by repetition, draw by the fifty-move rule,
opening books, move export (e.g. PGN), and React (or any UI framework) — plain HTML, CSS, and
JavaScript only.

## 7. Non-negotiable technical constraints

- **Hosting:** Cloudflare Workers, Free plan. The static site (HTML/CSS/JS files) is served
  via the `assets` feature in `wrangler.jsonc`, with `not_found_handling` set to
  `"single-page-application"` so any unknown URL falls back to the app itself.
  `run_worker_first` is set for the WebSocket path, so those requests reach our server code
  instead of being served as static files. `compatibility_date` is kept at today's date, and
  observability (Cloudflare's request/error logging) is enabled.
- **Chess rules — one module, hand-written:** every rule of chess is written by us in a
  single file, `rules.js`, and every mode (hot-seat, vs computer, online client, and the
  online server) uses that same file. No outside chess library (e.g. chess.js) and no chess
  engine library. Before any other game code is built, `rules.js` must pass the perft test:
  20 move sequences at depth 1, 400 at depth 2, 8,902 at depth 3, all from the starting
  position.
- **Online multiplayer:** no Socket.IO, Express, or the `ws` package. Exactly one
  SQLite-backed Durable Object per game room, looked up with `env.ROOM.getByName(roomCode)`,
  using the `new_sqlite_classes` Durable Object migration. Connections use Cloudflare's native
  WebSocket support via `ctx.acceptWebSocket()`. Every message is JSON with a `type` and a
  `payload`. A connected player's identity (which color they are) is stored using
  `ws.serializeAttachment()`, so it survives without a separate session system.
- **No timers of any kind.** The game state is written to storage after every move, so there
  is never a "save every N seconds" timer to reason about or get wrong.
