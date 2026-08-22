const SF_VERSION = "18.0.8"; // only used for the CDN fallback below
const LOCAL_SF_JS = new URL("../engine/stockfish-18-lite-single.js", import.meta.url).href;
const LOCAL_SF_WASM = new URL("../engine/stockfish-18-lite-single.wasm", import.meta.url).href;
const CDN_SF_BASE = `https://cdn.jsdelivr.net/npm/stockfish@${SF_VERSION}/bin/`;
const CDN_SF_JS = CDN_SF_BASE + "stockfish-18-lite-single.js";
const CDN_SF_WASM = CDN_SF_BASE + "stockfish-18-lite-single.wasm";

async function loadEngineScript(){
  // Bundled copy first (works fully offline, no CDN dependency).
  try {
    const resp = await fetch(LOCAL_SF_JS);
    if (resp.ok) return { code: await resp.text(), wasmUrl: LOCAL_SF_WASM };
  } catch (e) { /* fall through to CDN */ }
  // Fallback: fetch from jsdelivr in case the bundled asset is ever missing.
  const resp = await fetch(CDN_SF_JS);
  if (!resp.ok) throw new Error(`Could not load the engine (bundled asset missing and CDN returned HTTP ${resp.status}).`);
  return { code: await resp.text(), wasmUrl: CDN_SF_WASM };
}

/**
 * Creates an independent Stockfish controller. `onStatus(msg)` is called
 * with short human-readable progress strings ("Starting engine…", etc).
 * Each caller gets its own worker/state, so a page can safely create more
 * than one if it ever needs to.
 */
export function createEngine(onStatus){
  let worker = null;
  let readyPromise = null;
  const status = (msg) => { if (onStatus) onStatus(msg); };

  function init(){
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      status('Starting engine…');
      const { code, wasmUrl } = await loadEngineScript();
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl + '#' + encodeURIComponent(wasmUrl));
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(()=>reject(new Error('Engine did not respond in time (uciok timeout).')), 30000);
        function handler(e){
          const line = e.data;
          if (typeof line === 'string' && line.trim() === 'uciok'){
            worker.removeEventListener('message', handler);
            clearTimeout(timeout);
            resolve();
          }
        }
        worker.addEventListener('message', handler);
        worker.onerror = (err) => { clearTimeout(timeout); reject(new Error('Engine worker error: ' + (err.message||'unknown'))); };
        worker.postMessage('uci');
      });
      status('Engine ready.');
      return worker;
    })();
    return readyPromise;
  }

  function analyze(fen, movetimeMs, onDepth){
    return new Promise((resolve, reject) => {
      if (!worker){ reject(new Error('Engine not initialized.')); return; }
      let lastInfo = null;
      function handler(e){
        const line = e.data;
        if (typeof line !== 'string') return;
        if (line.startsWith('info') && line.includes(' pv ')){
          lastInfo = line;
          const m = line.match(/\bdepth (\d+)/);
          if (m && onDepth) onDepth(m[1]);
        } else if (line.startsWith('bestmove')){
          worker.removeEventListener('message', handler);
          const parts = line.split(' ');
          resolve({ bestMove: parts[1], lastInfo });
        }
      }
      worker.addEventListener('message', handler);
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go movetime ' + movetimeMs);
    });
  }

  return { init, analyze };
}

export function parseEval(infoLine, sideToMove){
  if (!infoLine) return null;
  const mMate = infoLine.match(/score mate (-?\d+)/);
  const mCp = infoLine.match(/score cp (-?\d+)/);
  let text;
  if (mMate){
    let n = parseInt(mMate[1],10);
    if (sideToMove === 'b') n = -n;
    text = n === 0 ? 'Checkmate' : `Mate in ${Math.abs(n)} for ${n>0?'White':'Black'}`;
  } else if (mCp){
    let cp = parseInt(mCp[1],10);
    if (sideToMove === 'b') cp = -cp;
    const pawns = (cp/100).toFixed(2);
    text = `${cp>=0?'+':''}${pawns}  (${cp>=0?'White':'Black'} is better)`;
  } else {
    text = 'Evaluation unavailable';
  }
  const pvMatch = infoLine.match(/ pv (.+)$/);
  const pv = pvMatch ? pvMatch[1] : '';
  return { text, pv };
}
