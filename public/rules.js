// Cheese chess rules engine — the single source of truth for legal chess.
// Shared by hot-seat, vs-computer, the online client, and the online server.
// No outside chess library. Correctness is proven by test/perft.js.

export const WHITE = 'w';
export const BLACK = 'b';

const FILES = 'abcdefgh';

export function squareIndex(file, rank) {
  return rank * 8 + file;
}

export function fileOf(square) {
  return square % 8;
}

export function rankOf(square) {
  return Math.floor(square / 8);
}

export function algebraic(square) {
  return FILES[fileOf(square)] + (rankOf(square) + 1);
}

export function fromAlgebraic(str) {
  const file = FILES.indexOf(str[0]);
  const rank = Number(str[1]) - 1;
  return squareIndex(file, rank);
}

function inBounds(file, rank) {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

export function otherColor(color) {
  return color === WHITE ? BLACK : WHITE;
}

const BACK_RANK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export function createInitialState() {
  const board = new Array(64).fill(null);
  for (let file = 0; file < 8; file++) {
    board[squareIndex(file, 0)] = { type: BACK_RANK[file], color: WHITE };
    board[squareIndex(file, 1)] = { type: 'p', color: WHITE };
    board[squareIndex(file, 6)] = { type: 'p', color: BLACK };
    board[squareIndex(file, 7)] = { type: BACK_RANK[file], color: BLACK };
  }
  return {
    board,
    turn: WHITE,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
  };
}

function cloneState(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    castling: { ...state.castling },
    enPassant: state.enPassant,
  };
}

const KNIGHT_OFFSETS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_OFFSETS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];

function findKing(board, color) {
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p && p.type === 'k' && p.color === color) return sq;
  }
  return -1;
}

export function isSquareAttacked(board, square, byColor) {
  const file = fileOf(square);
  const rank = rankOf(square);

  const pawnRankOffset = byColor === WHITE ? -1 : 1;
  for (const df of [-1, 1]) {
    const f = file + df;
    const r = rank + pawnRankOffset;
    if (inBounds(f, r)) {
      const p = board[squareIndex(f, r)];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
  }

  for (const [df, dr] of KNIGHT_OFFSETS) {
    const f = file + df, r = rank + dr;
    if (inBounds(f, r)) {
      const p = board[squareIndex(f, r)];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  for (const [df, dr] of KING_OFFSETS) {
    const f = file + df, r = rank + dr;
    if (inBounds(f, r)) {
      const p = board[squareIndex(f, r)];
      if (p && p.color === byColor && p.type === 'k') return true;
    }
  }

  for (const [df, dr] of ROOK_DIRS) {
    let f = file + df, r = rank + dr;
    while (inBounds(f, r)) {
      const p = board[squareIndex(f, r)];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      f += df; r += dr;
    }
  }

  for (const [df, dr] of BISHOP_DIRS) {
    let f = file + df, r = rank + dr;
    while (inBounds(f, r)) {
      const p = board[squareIndex(f, r)];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      f += df; r += dr;
    }
  }

  return false;
}

export function isInCheck(state, color) {
  const kingSq = findKing(state.board, color);
  if (kingSq === -1) return false;
  return isSquareAttacked(state.board, kingSq, otherColor(color));
}

function generatePseudoMoves(state, square) {
  const board = state.board;
  const piece = board[square];
  if (!piece) return [];

  const moves = [];
  const file = fileOf(square);
  const rank = rankOf(square);
  const color = piece.color;
  const enemy = otherColor(color);

  const addMove = (to, extra = {}) => {
    moves.push({
      from: square,
      to,
      piece: piece.type,
      color,
      capture: !!board[to],
      ...extra,
    });
  };

  if (piece.type === 'p') {
    const dir = color === WHITE ? 1 : -1;
    const startRank = color === WHITE ? 1 : 6;
    const promoRank = color === WHITE ? 7 : 0;

    const oneR = rank + dir;
    if (inBounds(file, oneR) && !board[squareIndex(file, oneR)]) {
      const to = squareIndex(file, oneR);
      if (oneR === promoRank) {
        for (const promotion of ['q', 'r', 'b', 'n']) addMove(to, { promotion });
      } else {
        addMove(to);
        if (rank === startRank) {
          const twoR = rank + 2 * dir;
          const toSq = squareIndex(file, twoR);
          if (!board[toSq]) addMove(toSq, { doublePush: true });
        }
      }
    }

    for (const df of [-1, 1]) {
      const f = file + df, r = rank + dir;
      if (!inBounds(f, r)) continue;
      const to = squareIndex(f, r);
      const target = board[to];
      if (target && target.color === enemy) {
        if (r === promoRank) {
          for (const promotion of ['q', 'r', 'b', 'n']) addMove(to, { promotion });
        } else {
          addMove(to);
        }
      } else if (state.enPassant === to) {
        addMove(to, { enPassantCapture: true, capture: true });
      }
    }
  } else if (piece.type === 'n') {
    for (const [df, dr] of KNIGHT_OFFSETS) {
      const f = file + df, r = rank + dr;
      if (!inBounds(f, r)) continue;
      const to = squareIndex(f, r);
      const target = board[to];
      if (!target || target.color === enemy) addMove(to);
    }
  } else if (piece.type === 'k') {
    for (const [df, dr] of KING_OFFSETS) {
      const f = file + df, r = rank + dr;
      if (!inBounds(f, r)) continue;
      const to = squareIndex(f, r);
      const target = board[to];
      if (!target || target.color === enemy) addMove(to);
    }

    const rankHome = color === WHITE ? 0 : 7;
    if (rank === rankHome && file === 4 && !isSquareAttacked(board, square, enemy)) {
      const rights = state.castling;

      const kRight = color === WHITE ? rights.wK : rights.bK;
      if (kRight) {
        const fSq = squareIndex(5, rankHome);
        const gSq = squareIndex(6, rankHome);
        const hSq = squareIndex(7, rankHome);
        const rook = board[hSq];
        if (
          !board[fSq] && !board[gSq] &&
          rook && rook.type === 'r' && rook.color === color &&
          !isSquareAttacked(board, fSq, enemy) &&
          !isSquareAttacked(board, gSq, enemy)
        ) {
          addMove(gSq, { castle: 'K' });
        }
      }

      const qRight = color === WHITE ? rights.wQ : rights.bQ;
      if (qRight) {
        const dSq = squareIndex(3, rankHome);
        const cSq = squareIndex(2, rankHome);
        const bSq = squareIndex(1, rankHome);
        const aSq = squareIndex(0, rankHome);
        const rook = board[aSq];
        if (
          !board[dSq] && !board[cSq] && !board[bSq] &&
          rook && rook.type === 'r' && rook.color === color &&
          !isSquareAttacked(board, dSq, enemy) &&
          !isSquareAttacked(board, cSq, enemy)
        ) {
          addMove(cSq, { castle: 'Q' });
        }
      }
    }
  } else {
    const dirs = piece.type === 'r' ? ROOK_DIRS : piece.type === 'b' ? BISHOP_DIRS : QUEEN_DIRS;
    for (const [df, dr] of dirs) {
      let f = file + df, r = rank + dr;
      while (inBounds(f, r)) {
        const to = squareIndex(f, r);
        const target = board[to];
        if (!target) {
          addMove(to);
        } else {
          if (target.color === enemy) addMove(to);
          break;
        }
        f += df; r += dr;
      }
    }
  }

  return moves;
}

export function applyMove(state, move) {
  const next = cloneState(state);
  const board = next.board;
  const piece = board[move.from];
  const color = piece.color;

  next.enPassant = null;

  if (move.enPassantCapture) {
    const capturedSquare = squareIndex(fileOf(move.to), rankOf(move.from));
    board[capturedSquare] = null;
  }

  board[move.to] = move.promotion ? { type: move.promotion, color } : piece;
  board[move.from] = null;

  if (move.castle === 'K') {
    const rankHome = rankOf(move.from);
    const rookFrom = squareIndex(7, rankHome);
    const rookTo = squareIndex(5, rankHome);
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  } else if (move.castle === 'Q') {
    const rankHome = rankOf(move.from);
    const rookFrom = squareIndex(0, rankHome);
    const rookTo = squareIndex(3, rankHome);
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }

  if (move.doublePush) {
    const dir = color === WHITE ? 1 : -1;
    next.enPassant = squareIndex(fileOf(move.from), rankOf(move.from) + dir);
  }

  if (piece.type === 'k') {
    if (color === WHITE) { next.castling.wK = false; next.castling.wQ = false; }
    else { next.castling.bK = false; next.castling.bQ = false; }
  }
  if (move.from === squareIndex(0, 0) || move.to === squareIndex(0, 0)) next.castling.wQ = false;
  if (move.from === squareIndex(7, 0) || move.to === squareIndex(7, 0)) next.castling.wK = false;
  if (move.from === squareIndex(0, 7) || move.to === squareIndex(0, 7)) next.castling.bQ = false;
  if (move.from === squareIndex(7, 7) || move.to === squareIndex(7, 7)) next.castling.bK = false;

  next.turn = otherColor(color);
  return next;
}

export function getAllLegalMoves(state) {
  const color = state.turn;
  const legal = [];
  for (let sq = 0; sq < 64; sq++) {
    const piece = state.board[sq];
    if (!piece || piece.color !== color) continue;
    const pseudo = generatePseudoMoves(state, sq);
    for (const move of pseudo) {
      const next = applyMove(state, move);
      if (!isInCheck(next, color)) legal.push(move);
    }
  }
  return legal;
}

export function getLegalMovesFrom(state, square) {
  return getAllLegalMoves(state).filter((m) => m.from === square);
}

export function getGameStatus(state) {
  const moves = getAllLegalMoves(state);
  const inCheck = isInCheck(state, state.turn);
  if (moves.length > 0) return inCheck ? 'check' : 'ongoing';
  return inCheck ? 'checkmate' : 'stalemate';
}
