import { createInitialState, algebraic, getLegalMovesFrom, applyMove, getGameStatus } from './rules.js';

const PIECE_GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const COLOR_NAME = { w: 'White', b: 'Black' };

let state = null;
let selectedSquare = null;
let legalMoves = [];
let awaitingPromotion = false;
let gameOver = false;
let pendingHandoff = false;

const gameOverBanner = document.getElementById('game-over-banner');
const gameOverText = document.getElementById('game-over-text');
const handoffBanner = document.getElementById('handoff-banner');
const handoffText = document.getElementById('handoff-text');
const turnIndicator = document.getElementById('turn-indicator');

function findKingSquare(color) {
  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq];
    if (p && p.type === 'k' && p.color === color) return sq;
  }
  return -1;
}

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

  const status = getGameStatus(state);
  const checkedKingSquare = (status === 'check' || status === 'checkmate')
    ? findKingSquare(state.turn)
    : -1;

  turnIndicator.textContent =
    `${PIECE_GLYPHS[state.turn].k} ${COLOR_NAME[state.turn]} to move` +
    (status === 'check' ? ' — check!' : '');
  turnIndicator.className = `turn-indicator turn-${state.turn}`;

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

      if (square === checkedKingSquare) {
        squareEl.classList.add('in-check');
      }

      const move = legalMoves.find((m) => m.to === square);
      if (move) {
        squareEl.classList.add(move.capture ? 'legal-capture' : 'legal-move');
      }

      squareEl.addEventListener('click', () => handleSquareClick(square));
      container.appendChild(squareEl);
    }
  }

  if (status === 'checkmate') {
    const winner = COLOR_NAME[state.turn === 'w' ? 'b' : 'w'];
    showGameOver(`Checkmate — ${winner} wins!`);
  } else if (status === 'stalemate') {
    showGameOver('Stalemate — draw.');
  } else {
    gameOver = false;
    gameOverBanner.hidden = true;
  }
}

function showGameOver(message) {
  gameOver = true;
  gameOverText.textContent = message;
  gameOverBanner.hidden = false;
}

function showHandoff(color) {
  pendingHandoff = true;
  handoffText.textContent = `Pass the device to ${COLOR_NAME[color]}`;
  handoffBanner.hidden = false;
}

function dismissHandoff() {
  pendingHandoff = false;
  handoffBanner.hidden = true;
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
  if (awaitingPromotion || gameOver || pendingHandoff) return;

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
    if (!gameOver) showHandoff(state.turn);
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
  gameOverBanner.hidden = true;
  dismissHandoff();
  state = createInitialState();
  clearSelection();
}

document.getElementById('mode-hotseat').addEventListener('click', startHotSeat);
document.getElementById('play-again-btn').addEventListener('click', startHotSeat);
document.getElementById('handoff-ready-btn').addEventListener('click', dismissHandoff);
