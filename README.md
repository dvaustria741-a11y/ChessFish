# ChessFish

A pocket best-move helper: set up any position, run real Stockfish 18 (WASM,
lite/single-thread build) fully client-side, and see exactly where the engine
wants you to move — including a plain-language callout when the best move is
a pawn push.

The whole app is a single self-contained web page
(`app/src/main/assets/chess-helper.html`) wrapped in a minimal Android WebView
shell. No backend, nothing uploaded — the position and the engine both run
on-device in the WebView.

- Board setup: tap a piece in the palette then tap a square to place it, tap
  again to erase. Castling rights, side to move, en passant, and raw FEN
  import/export are all exposed.
- Engine: [Stockfish 18](https://github.com/nmrugg/stockfish.js) (lite,
  single-thread WASM build by Nathan Rugg / Chess.com), fetched from jsdelivr
  on first run (~7 MB, cached after) — no server-side analysis.
- Move legality / SAN via [chess.js](https://github.com/jhlywa/chess.js).
- Best move is drawn as an arrow directly on the board plus a plain-text
  callout ("move the pawn from e2 to e4").

## Building

Pushing to `main` triggers `.github/workflows/build.yml`, which builds a
debug APK and attaches it to a new GitHub Release automatically. You can also
trigger it manually from the Actions tab (workflow_dispatch) or download the
`ChessFish-debug-apk` build artifact from any run.

This is a debug-signed build (Android's auto-generated debug keystore) — fine
to sideload, not intended for the Play Store as-is.

## Local dev

The web app itself (`app/src/main/assets/chess-helper.html`) is a fully
standalone HTML file — you can open it directly in any modern desktop or
mobile browser with no build step at all.
