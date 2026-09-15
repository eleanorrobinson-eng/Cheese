// Online mode client: renders the server's state and sends moves over the
// same WebSocket — the server (src/room.js) is the sole authority on what's
// legal. This client never applies a move locally; it only ever displays
// whatever state the server broadcasts back.

import {
  algebraic,
  getLegalMovesFrom,
  getGameStatus,
  squareIndex,
  fileOf,
  rankOf,
} from './rules.js';

const PIECE_GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const COLOR_NAME = { w: 'White', b: 'Black' };
const ROLE_LABEL = { w: 'You are White', b: 'You are Black', spectator: 'You are spectating' };

let socket = null;
let roomCode = null;
let myColor = null;
let currentState = null;
let selectedSquare = null;
let legalMoves = [];
let awaitingServer = false;
let gameOver = false;

const boardEl = document.getElementById('online-board');
const turnIndicatorEl = document.getElementById('online-turn-indicator');
const roomInfoEl = document.getElementById('online-room-info');
const gameOverBanner = document.getElementById('online-game-over-banner');
const gameOverText = document.getElementById('online-game-over-text');

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

function findKingSquare(color) {
  for (let sq = 0; sq < 64; sq++) {
    const p = currentState.board[sq];
    if (p && p.type === 'k' && p.color === color) return sq;
  }
  return -1;
}

function setRoomInfo(text) {
  roomInfoEl.textContent = text;
}

function render() {
  boardEl.innerHTML = '';

  const status = getGameStatus(currentState);
  const checkedKingSquare = (status === 'check' || status === 'checkmate')
    ? findKingSquare(currentState.turn)
    : -1;

  turnIndicatorEl.textContent =
    `${PIECE_GLYPHS[currentState.turn].k} ${COLOR_NAME[currentState.turn]} to move` +
    (status === 'check' ? ' — check!' : '');
  turnIndicatorEl.className = `turn-indicator turn-${currentState.turn}`;

  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = rank * 8 + file;
      const isLight = (file + rank) % 2 === 1;

      const squareEl = document.createElement('div');
      squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
      squareEl.dataset.square = algebraic(square);

      const piece = currentState.board[square];
      if (piece) {
        const glyph = document.createElement('span');
        glyph.className = `piece piece-${piece.color}`;
        glyph.textContent = PIECE_GLYPHS[piece.color][piece.type];
        squareEl.appendChild(glyph);
      }

      if (square === selectedSquare) squareEl.classList.add('selected');
      if (square === checkedKingSquare) squareEl.classList.add('in-check');

      const move = legalMoves.find((m) => m.to === square);
      if (move) squareEl.classList.add(move.capture ? 'legal-capture' : 'legal-move');

      squareEl.addEventListener('click', () => handleSquareClick(square));
      boardEl.appendChild(squareEl);
    }
  }

  if (status === 'checkmate') {
    const winner = COLOR_NAME[currentState.turn === 'w' ? 'b' : 'w'];
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

function playCaptureAnimation(square, piece) {
  const squareEl = boardEl.querySelector(`[data-square="${algebraic(square)}"]`);
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

function clearSelection() {
  selectedSquare = null;
  legalMoves = [];
  render();
}

async function handleSquareClick(square) {
  if (gameOver || awaitingServer) return;
  if (myColor !== 'w' && myColor !== 'b') return; // spectators can't move
  if (currentState.turn !== myColor) return;

  const piece = currentState.board[square];

  if (selectedSquare === null) {
    if (piece && piece.color === myColor) {
      selectedSquare = square;
      legalMoves = getLegalMovesFrom(currentState, square);
      render();
    }
    return;
  }

  if (square === selectedSquare) {
    clearSelection();
    return;
  }

  const candidates = legalMoves.filter((m) => m.to === square);
  if (candidates.length > 0) {
    let promotion;
    if (candidates.length > 1) {
      promotion = await askPromotionChoice(myColor);
    }
    awaitingServer = true;
    socket.send(JSON.stringify({ type: 'move', payload: { from: selectedSquare, to: square, promotion } }));
    clearSelection();
    return;
  }

  if (piece && piece.color === myColor) {
    selectedSquare = square;
    legalMoves = getLegalMovesFrom(currentState, square);
    render();
    return;
  }

  clearSelection();
}

function wsUrl(code) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/api/room/${encodeURIComponent(code)}`;
}

function showOnlineScreen() {
  document.getElementById('home-screen').hidden = true;
  document.getElementById('game-screen').hidden = true;
  document.getElementById('online-join-dialog').hidden = true;
  document.getElementById('online-screen').hidden = false;
  gameOverBanner.hidden = true;
}

function joinRoom(code) {
  roomCode = code;
  showOnlineScreen();
  setRoomInfo(`Connecting to room ${code}…`);

  socket = new WebSocket(wsUrl(code));

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'welcome') {
      myColor = message.payload.color;
      currentState = message.payload.state;
      setRoomInfo(`Room ${roomCode} — ${ROLE_LABEL[myColor]}`);
      clearSelection();
      return;
    }

    if (message.type === 'state') {
      awaitingServer = false;
      const lastMove = message.payload.lastMove;
      let captureInfo = null;
      if (lastMove?.capture) {
        const capturedSquare = lastMove.enPassantCapture
          ? squareIndex(fileOf(lastMove.to), rankOf(lastMove.from))
          : lastMove.to;
        captureInfo = { square: capturedSquare, piece: currentState.board[capturedSquare] };
      }
      currentState = message.payload.state;
      clearSelection();
      if (captureInfo) playCaptureAnimation(captureInfo.square, captureInfo.piece);
      return;
    }

    if (message.type === 'error') {
      awaitingServer = false;
      const previous = `Room ${roomCode} — ${ROLE_LABEL[myColor] ?? ''}`;
      setRoomInfo(`⚠ ${message.payload.message}`);
      setTimeout(() => setRoomInfo(previous), 1500);
    }
  });

  socket.addEventListener('close', () => {
    setRoomInfo(`Room ${roomCode} — disconnected.`);
  });

  socket.addEventListener('error', () => {
    setRoomInfo(`Room ${roomCode} — connection error.`);
  });
}

document.getElementById('mode-online').addEventListener('click', () => {
  document.getElementById('home-screen').hidden = true;
  document.getElementById('online-join-dialog').hidden = false;
});

document.getElementById('room-join-btn').addEventListener('click', () => {
  const input = document.getElementById('room-code-input');
  const code = input.value.trim().toUpperCase();
  if (!code) return;
  joinRoom(code);
});
