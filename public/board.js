import {
  createInitialState,
  algebraic,
  getLegalMovesFrom,
  applyMove,
  getGameStatus,
  squareIndex,
  fileOf,
  rankOf,
} from './rules.js';
import { chooseMove } from './ai.js';

const AI_SEARCH_DEPTH = 2;
const AI_THINK_DELAY_MS = 400;

const PIECE_GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const COLOR_NAME = { w: 'White', b: 'Black' };

let mode = 'hotseat';
let state = null;
let selectedSquare = null;
let legalMoves = [];
let awaitingPromotion = false;
let gameOver = false;
let pendingHandoff = false;
let awaitingComputer = false;

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

function playCaptureAnimation(square, piece) {
  const squareEl = document.querySelector(`[data-square="${algebraic(square)}"]`);
  if (!squareEl) return;

  const fx = document.createElement('div');
  fx.className = 'capture-fx';

  const ghost = document.createElement('span');
  ghost.className = `ghost-piece piece piece-${piece.color}`;
  ghost.textContent = PIECE_GLYPHS[piece.color][piece.type];

  const mouse = document.createElement('span');
  mouse.className = 'mouse-eater';
  mouse.textContent = '🐭';

  fx.append(ghost, mouse);
  squareEl.appendChild(fx);

  setTimeout(() => fx.remove(), 650);
}

function applyMoveAndAnimate(move) {
  let captureInfo = null;
  if (move.capture) {
    const capturedSquare = move.enPassantCapture
      ? squareIndex(fileOf(move.to), rankOf(move.from))
      : move.to;
    captureInfo = { square: capturedSquare, piece: state.board[capturedSquare] };
  }

  state = applyMove(state, move);
  clearSelection();
  if (captureInfo) playCaptureAnimation(captureInfo.square, captureInfo.piece);
  return captureInfo;
}

function makeComputerMove() {
  const move = chooseMove(state, AI_SEARCH_DEPTH);
  awaitingComputer = false;
  if (!move) return;
  applyMoveAndAnimate(move);
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
  if (awaitingPromotion || gameOver || pendingHandoff || awaitingComputer) return;

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
    const captureInfo = applyMoveAndAnimate(move);

    if (!gameOver) {
      const nextTurn = state.turn;
      if (mode === 'hotseat') {
        if (captureInfo) {
          // Block input right away, but delay revealing the handoff prompt so
          // the capture animation is actually visible before the device is passed.
          pendingHandoff = true;
          setTimeout(() => showHandoff(nextTurn), 650);
        } else {
          showHandoff(nextTurn);
        }
      } else if (mode === 'vscomputer' && nextTurn === 'b') {
        awaitingComputer = true;
        setTimeout(makeComputerMove, captureInfo ? 650 + AI_THINK_DELAY_MS : AI_THINK_DELAY_MS);
      }
    }
    return;
  }

  if (piece && piece.color === state.turn) {
    selectSquare(square);
    return;
  }

  clearSelection();
}

function startGame(newMode) {
  mode = newMode;
  document.getElementById('home-screen').hidden = true;
  document.getElementById('game-screen').hidden = false;
  gameOverBanner.hidden = true;
  dismissHandoff();
  awaitingComputer = false;
  state = createInitialState();
  clearSelection();
}

document.getElementById('mode-hotseat').addEventListener('click', () => startGame('hotseat'));
document.getElementById('mode-vscomputer').addEventListener('click', () => startGame('vscomputer'));
document.getElementById('play-again-btn').addEventListener('click', () => startGame(mode));
document.getElementById('handoff-ready-btn').addEventListener('click', dismissHandoff);
