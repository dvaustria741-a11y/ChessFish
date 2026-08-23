// Full-game review: per-move classification, accuracy, phase quality and
// coach commentary. Kept separate from engine.js so the "quick analyze one
// position" page and the "review a whole game" page can both use the engine
// without dragging this heavier logic along.

const PIECE_VALUE = { p:1, n:3, b:3, r:5, q:9, k:0 };

/** Raw centipawn score from the *side to move*'s own perspective (no turn
 *  flipping) — mate scores are folded into a big number so they sort/compare
 *  sensibly against centipawn scores. */
export function rawEvalCp(infoLine){
  if (!infoLine) return 0;
  const mMate = infoLine.match(/score mate (-?\d+)/);
  const mCp = infoLine.match(/score cp (-?\d+)/);
  if (mMate){
    const n = parseInt(mMate[1],10);
    return n >= 0 ? (100000 - n) : (-100000 - n);
  } else if (mCp){
    return parseInt(mCp[1],10);
  }
  return 0;
}

export function bestMoveUci(infoLine, bestMove){
  return bestMove && bestMove !== '(none)' ? bestMove : null;
}

/** Chess.com-style accuracy-from-centipawn-loss approximation. */
export function accuracyFromCpLoss(cpLoss){
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0,cpLoss)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

export const BADGES = {
  brilliant:  { icon:'!!', label:'Brilliant',  cls:'brilliant' },
  great:      { icon:'!',  label:'Great',      cls:'great' },
  best:       { icon:'\u2605', label:'Best',   cls:'best' },
  excellent:  { icon:'\u2713', label:'Excellent', cls:'excellent' },
  good:       { icon:'\u2713', label:'Good',   cls:'good' },
  book:       { icon:'\uD83D\uDCD6', label:'Book', cls:'book' },
  inaccuracy: { icon:'?!', label:'Inaccuracy', cls:'inaccuracy' },
  mistake:    { icon:'?',  label:'Mistake',    cls:'mistake' },
  miss:       { icon:'\u2715', label:'Miss',   cls:'miss' },
  blunder:    { icon:'??', label:'Blunder',    cls:'blunder' },
};
// Order used for the summary breakdown table (top to bottom).
export const BADGE_ORDER = ['brilliant','great','best','excellent','good','book','inaccuracy','mistake','miss','blunder'];
// The subset chess.com shows before you tap "expand more".
export const BADGE_ORDER_COLLAPSED = ['brilliant','great','best','mistake','miss','blunder'];

const COMMENTARY = {
  brilliant: [
    "A real sacrifice, and the engine backs it completely. Sharp find.",
    "Giving up material on purpose here — and it works. Nicely calculated.",
    "That's the kind of move that wins games outright. Brilliant.",
  ],
  great: [
    "The only move that keeps things together here, and you found it.",
    "A precise, only-good-move moment — well handled.",
    "That's exactly the resource this position needed.",
  ],
  best: [
    "Matches the engine's top choice. Can't do better than that.",
    "Exactly what the position called for.",
    "The strongest move available — well played.",
  ],
  excellent: [
    "Very close to best — barely gives anything away.",
    "A strong, accurate choice.",
    "Nearly optimal — the engine is happy with this.",
  ],
  good: [
    "A solid, reasonable move.",
    "Keeps the position healthy, even if not the sharpest try.",
    "Not the top engine line, but nothing wrong with it either.",
  ],
  book: [
    "Standard opening theory — textbook stuff.",
    "Well-known opening territory.",
    "Straight out of the book.",
  ],
  inaccuracy: [
    "A small slip — gives the opponent a bit more than necessary.",
    "Not quite precise; there was a cleaner path.",
    "Loosens the position slightly.",
  ],
  mistake: [
    "This one hands back some of the advantage.",
    "A real mistake — the evaluation swings noticeably here.",
    "Better options were available in this position.",
  ],
  miss: [
    "There was a much bigger opportunity here that got away.",
    "A winning continuation was on the board — this move lets it slip.",
    "The position had more in it than this move takes.",
  ],
  blunder: [
    "A serious error — this changes the outcome of the game.",
    "Ouch. That drops significant material or the advantage outright.",
    "The evaluation swings hard here — a costly moment.",
  ],
};

export function coachLine(classification){
  const options = COMMENTARY[classification] || COMMENTARY.good;
  return options[Math.floor(Math.random() * options.length)];
}

export function headline(san, classification, moverIsWhite){
  const map = {
    brilliant: `${san} is brilliant!`,
    great: `${san} is a great move`,
    best: `${san} is the best move`,
    excellent: `${san} is excellent`,
    good: `${san} is a good move`,
    book: `${san} is a book move`,
    inaccuracy: `${san} is an inaccuracy`,
    mistake: `${san} is a mistake`,
    miss: `${san} misses a bigger opportunity`,
    blunder: `${san} is a blunder`,
  };
  return map[classification] || `${san}`;
}

/** Roughly detects an unprotected material sacrifice: right after our move,
 *  the opponent has a legal capture landing on the square we just moved to,
 *  taking more value than we gained this move. Not a full "is this sound"
 *  check — just enough to flag genuine offer-of-material moments. */
export function detectSacrifice(ChessCtor, fenAfter, moveObj){
  try{
    const c = new ChessCtor(fenAfter);
    const oppMoves = c.moves({ verbose:true });
    const recapture = oppMoves.find(m => m.to === moveObj.to && m.captured);
    if (!recapture) return false;
    const lostValue = PIECE_VALUE[moveObj.piece] || 0;
    const gainedValue = moveObj.captured ? (PIECE_VALUE[moveObj.captured]||0) : 0;
    return lostValue >= 3 && lostValue > gainedValue;
  }catch(e){ return false; }
}

/**
 * Classify one move.
 *  cpLoss: max(0, evalBeforeForMover - evalAfterForMover), in centipawns.
 *  isTop: whether the move matches the engine's best move at the prior position.
 *  isBookPly: whether this ply is within the fixed opening window.
 *  moverEvalBefore: eval (mover's perspective) of the position before the move —
 *    used to tell a "miss" (was winning big, let it slip) from a plain mistake.
 */
export function classifyMove({ cpLoss, isTop, sacrifice, moveObj, isBookPly, moverEvalBefore }){
  if (isBookPly && cpLoss <= 40) return 'book';
  if (sacrifice && (isTop || cpLoss <= 10)) return 'brilliant';
  if (isTop && (cpLoss <= 4) && (moveObj.san.includes('+') || moveObj.captured)) return 'great';
  if (isTop || cpLoss <= 4) return 'best';
  if (cpLoss <= 20) return 'excellent';
  if (cpLoss <= 50) return 'good';
  const wasWinningBig = moverEvalBefore >= 200;
  if (cpLoss <= 100) return wasWinningBig ? 'miss' : 'inaccuracy';
  if (cpLoss <= 250) return wasWinningBig ? 'miss' : 'mistake';
  return 'blunder';
}

/** Very rough phase-quality icon for the Opening / Middlegame / Endgame rows. */
export function phaseIcon(avgCpLoss){
  if (avgCpLoss == null) return { icon:'-', cls:'' };
  if (avgCpLoss <= 15) return { icon:'!', cls:'great' };
  if (avgCpLoss <= 40) return { icon:'\uD83D\uDC4D', cls:'good' };
  if (avgCpLoss <= 80) return { icon:'?!', cls:'inaccuracy' };
  return { icon:'?', cls:'mistake' };
}

/** Non-pawn, non-king material left on the board for a FEN's piece placement. */
export function nonPawnMaterial(fenPlacement){
  let total = 0;
  for (const ch of fenPlacement){
    const lower = ch.toLowerCase();
    if (lower === 'p' || lower === 'k' || !/[a-z]/i.test(ch)) continue;
    total += PIECE_VALUE[lower] || 0;
  }
  return total;
}

/** Rough, clearly-labelled-as-an-estimate rating implied by a given accuracy. */
export function estimatedRating(accuracy){
  return Math.round(400 + accuracy * 17);
}
