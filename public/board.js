import { createInitialState, algebraic, getLegalMovesFrom, applyMove } from './rules.js';

const PIECE_GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

let state = null;
let selectedSquare = null;
let legalMoves = [];

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

function handleSquareClick(square) {
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
    // Multiple candidates only happens on promotion (one per piece choice).
    // The choice dialog is a later task — default to queen for now.
    const move = candidates.length > 1 ? candidates.find((m) => m.promotion === 'q') : candidates[0];
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
