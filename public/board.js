import { createInitialState, algebraic, getLegalMovesFrom, applyMove } from './rules.js';

const PIECE_GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

let state = null;
let selectedSquare = null;
let legalMoves = [];
let awaitingPromotion = false;

const promotionDialog = document.getElementById('promotion-dialog');
const promotionChoicesEl = promotionDialog.querySelector('.promotion-choices');
const PROMOTION_ORDER = ['q', 'r', 'b', 'n'];

function askPromotionChoice(color) {
  return new Promise((resolve) => {
    promotionChoicesEl.innerHTML = '';
    for (const type of PROMOTION_ORDER) {
      const btn = document.createElement('button');
      btn.className = `promotion-choice piece piece-${color}`;
      btn.textContent = PIECE_GLYPHS[color][type];
      btn.addEventListener('click', () => {
        promotionDialog.hidden = true;
        resolve(type);
      });
      promotionChoicesEl.appendChild(btn);
    }
    promotionDialog.hidden = false;
  });
}

function render() {
  const container = document.getElementById('board');
  container.innerHTML = '';

  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = rank * 8 + file;
      const isLight = (file + rank) % 2 === 1;

      const squareEl = document.createElement('div');
      squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
      squareEl.dataset.square = algebraic(square);

      const piece = state.board[square];
      if (piece) {
        const glyph = document.createElement('span');
        glyph.className = `piece piece-${piece.color}`;
        glyph.textContent = PIECE_GLYPHS[piece.color][piece.type];
        squareEl.appendChild(glyph);
      }

      if (square === selectedSquare) {
        squareEl.classList.add('selected');
      }

      const move = legalMoves.find((m) => m.to === square);
      if (move) {
        squareEl.classList.add(move.capture ? 'legal-capture' : 'legal-move');
      }

      squareEl.addEventListener('click', () => handleSquareClick(square));
      container.appendChild(squareEl);
    }
  }
}

function selectSquare(square) {
  selectedSquare = square;
  legalMoves = getLegalMovesFrom(state, square);
  render();
}

function clearSelection() {
  selectedSquare = null;
  legalMoves = [];
  render();
}

async function handleSquareClick(square) {
  if (awaitingPromotion) return;

  const piece = state.board[square];

  if (selectedSquare === null) {
    if (piece && piece.color === state.turn) selectSquare(square);
    return;
  }

  if (square === selectedSquare) {
    clearSelection();
    return;
  }

  const candidates = legalMoves.filter((m) => m.to === square);
  if (candidates.length > 0) {
    let move = candidates[0];
    if (candidates.length > 1) {
      // Multiple candidates for the same destination only happens on promotion,
      // one candidate per piece choice — ask which piece to become.
      awaitingPromotion = true;
      const choice = await askPromotionChoice(state.turn);
      awaitingPromotion = false;
      move = candidates.find((m) => m.promotion === choice);
    }
    state = applyMove(state, move);
    clearSelection();
    return;
  }

  if (piece && piece.color === state.turn) {
    selectSquare(square);
    return;
  }

  clearSelection();
}

function startHotSeat() {
  document.getElementById('home-screen').hidden = true;
  document.getElementById('game-screen').hidden = false;
  state = createInitialState();
  clearSelection();
}

document.getElementById('mode-hotseat').addEventListener('click', startHotSeat);
