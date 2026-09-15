# Cheese

A browser chess game with a full cheese-and-mice theme. Every piece is made of cheese, mice
scurry around the board, and when a piece is captured, a mouse runs in and eats it.

Cheese has three ways to play:

- **Hot-seat** — two people share one screen and one device, taking turns.
- **Vs Computer** — you play White; the browser calculates Black's replies.
- **Online** — two people on two different devices type the same room code and play live.

This is a student project by **Eleanor Robinson**, built to learn how a real multiplayer web
app is put together — from the chess rules themselves, up through a live server that keeps two
players' screens in sync.

## What is this built on?

A few terms that come up throughout this project, explained once here:

- **Cloudflare Workers** — a way to run code on the internet without renting or managing your
  own server. You upload JavaScript; Cloudflare runs it on computers close to whoever opens the
  site, and hands you a public URL.
- **Durable Object** — a special kind of Worker that *remembers things between visits*. Cheese
  uses one Durable Object per online game room, so it can hold that room's board position,
  whose turn it is, and who is playing which color.
- **WebSocket** — a live, two-way connection between a browser and the server that stays open,
  like a phone line left connected. It lets the server push "your opponent just moved their
  knight" to your screen the instant it happens, instead of your browser having to keep asking
  "anything new yet?" over and over.
- **SQLite** — a small, built-in database (a structured place to save data) that lives inside
  each Durable Object, so a room's game state survives even if that Durable Object restarts.

## Where things live

- [`README.md`](README.md) — this file: what the project is and who's building it.
- [`ProductSpec.md`](ProductSpec.md) — what "done" means for every mode, the look and feel, and
  the technical rules the whole project must follow.
- [`FEATUREROADMAP_workplan.md`](FEATUREROADMAP_workplan.md) — the ordered, checkbox-by-checkbox
  build plan: what gets built first, what depends on what, and how we'll know each piece works.

Game code hasn't started yet — see the roadmap for the first task.
