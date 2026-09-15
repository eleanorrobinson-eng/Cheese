import { createInitialState, algebraic } from './rules.js';

const PIECE_GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

export function renderBoard(state, container) {
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

      container.appendChild(squareEl);
    }
  }
}

function startHotSeat() {
  document.getElementById('home-screen').hidden = true;
  document.getElementById('game-screen').hidden = false;
  const state = createInitialState();
  renderBoard(state, document.getElementById('board'));
}

document.getElementById('mode-hotseat').addEventListener('click', startHotSeat);
