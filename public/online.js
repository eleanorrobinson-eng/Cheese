// Online mode — room connection and player identity.
// Board rendering and move sync are built out in later tasks; for now this
// proves that joining a room over a real WebSocket assigns White, then
// Black, then spectator, correctly and live.

const ROLE_LABEL = {
  w: 'You are White',
  b: 'You are Black',
  spectator: 'You are spectating',
};

let socket = null;

function wsUrl(code) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/api/room/${encodeURIComponent(code)}`;
}

function setStatus(text) {
  document.getElementById('online-status-text').textContent = text;
}

function showOnlineScreen() {
  document.getElementById('home-screen').hidden = true;
  document.getElementById('game-screen').hidden = true;
  document.getElementById('online-join-dialog').hidden = true;
  document.getElementById('online-screen').hidden = false;
}

function joinRoom(code) {
  showOnlineScreen();
  setStatus(`Connecting to room ${code}…`);

  socket = new WebSocket(wsUrl(code));

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'welcome') {
      const { color } = message.payload;
      setStatus(`Room ${code} — ${ROLE_LABEL[color]}`);
    }
  });

  socket.addEventListener('close', () => {
    setStatus(`Room ${code} — disconnected.`);
  });

  socket.addEventListener('error', () => {
    setStatus(`Room ${code} — connection error.`);
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
