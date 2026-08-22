# ChessFish

A pocket chess toolkit built as a minimal Android WebView shell around a
few self-contained web pages. No backend — the board, the engine, and any
chess.com data you pull in all live and run on-device.

Two tools, picked from a landing screen (`app/src/main/assets/home.html`):

- **Chess Helper** (`chess-helper.html`) — set up any position by hand and
  ask Stockfish 18 for the best move, with a plain-language callout when
  the best move is a pawn push. Board setup: tap a piece in the palette
  then tap a square to place it, tap the eraser to remove one, or tap an
  existing piece to pick it up and tap again to move it (castling drags
  the rook along automatically). Castling rights, side to move, en
  passant, raw FEN import/export, and full undo/redo history are all
  exposed.
- **Chess Analyst** (`chess-analyst.html`) — enter a chess.com username to
  pull your recent games from chess.com's public data API, step through
  them move by move with a `<< < > >>` navigator, and run Stockfish on
  any position along the way. An optional voice toggle reads moves and
  analysis results aloud via the browser's speech synthesis.

Shared code (engine loading, chess.js loading, board theming/constants)
lives under `app/src/main/assets/shared/` and is imported by both pages as
ES modules.

- Engine: [Stockfish 18](https://github.com/nmrugg/stockfish.js) (lite,
  single-thread WASM build by Nathan Rugg / Chess.com), bundled straight
  into the APK (`app/src/main/assets/engine/`) so both tools work fully
  offline — jsdelivr is only ever used as a fallback if that bundled copy
  is somehow missing.
- Move legality / SAN / PGN parsing via
  [chess.js](https://github.com/jhlywa/chess.js), also bundled
  (`app/src/main/assets/vendor/chess.js`).
- Best move is drawn as an arrow directly on the board plus a plain-text
  callout.
- Chess Analyst talks to `api.chess.com/pub/...` (chess.com's public,
  unauthenticated data API) to list and load games — this only covers
  *completed* games; chess.com doesn't expose a public API for spectating
  live in-progress games.

## Building

Pushing to `main` triggers `.github/workflows/build.yml`, which builds a
debug APK and attaches it to a new GitHub Release automatically. You can also
trigger it manually from the Actions tab (workflow_dispatch) or download the
`ChessFish-debug-apk` build artifact from any run.

This is a debug-signed build (Android's auto-generated debug keystore) — fine
to sideload, not intended for the Play Store as-is.

## Local dev

Each page under `app/src/main/assets/` is a standalone HTML file you can open
directly in any modern desktop or mobile browser with no build step — just
keep the folder structure intact (`shared/`, `engine/`, `vendor/` need to sit
alongside the HTML files) since they're loaded as relative ES module/asset
paths.
