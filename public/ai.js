// The Vs Computer opponent: minimax with alpha-beta pruning, search depth 2.
// Runs entirely in the browser, on top of the same rules.js used everywhere else.

import { getAllLegalMoves, applyMove, isInCheck } from './rules.js';

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function evaluate(state) {
  let score = 0;
  for (const piece of state.board) {
    if (!piece) continue;
    const value = PIECE_VALUES[piece.type];
    score += piece.color === 'w' ? value : -value;
  }
  return score;
}

function minimax(state, depth, alpha, beta, maximizing) {
  const moves = getAllLegalMoves(state);

  if (moves.length === 0) {
    if (isInCheck(state, state.turn)) return maximizing ? -100000 : 100000;
    return 0; // stalemate
  }

  if (depth === 0) return evaluate(state);

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const value = minimax(applyMove(state, move), depth - 1, alpha, beta, false);
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const value = minimax(applyMove(state, move), depth - 1, alpha, beta, true);
    best = Math.min(best, value);
    beta = Math.min(beta, value);
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseMove(state, depth = 2) {
  const moves = getAllLegalMoves(state);
  if (moves.length === 0) return null;

  const maximizing = state.turn === 'w';
  let bestMove = moves[0];
  let bestValue = maximizing ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of moves) {
    const value = minimax(applyMove(state, move), depth - 1, alpha, beta, !maximizing);
    if (maximizing ? value > bestValue : value < bestValue) {
      bestValue = value;
      bestMove = move;
    }
    if (maximizing) alpha = Math.max(alpha, bestValue);
    else beta = Math.min(beta, bestValue);
  }

  return bestMove;
}
