// Prefer the copy bundled into the APK (assets/vendor/chess.js) so the app
// works fully offline. Fall back to jsdelivr only if that's ever missing.
export async function loadChessJs(){
  try {
    const mod = await import("../vendor/chess.js");
    return mod.Chess;
  } catch (e) {
    const mod = await import("https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js");
    return mod.Chess;
  }
}
