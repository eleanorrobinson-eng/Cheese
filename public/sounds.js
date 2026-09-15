// All sound is synthesized with the Web Audio API — no audio asset files.
// Browsers block audio until a real user gesture, so the context is created
// lazily on first click anywhere on the page.

let audioCtx = null;
let masterGain = null;

let muted = false;
try {
  muted = sessionStorage.getItem('cheese-muted') === 'true';
} catch {
  // Storage can be unavailable (private browsing, disabled cookies, etc.) —
  // muted just won't persist across a reload in that case.
}

function ensureContext() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null; // browser doesn't support Web Audio at all

  audioCtx = new Ctor();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

document.addEventListener('click', () => {
  try {
    ensureContext();
  } catch {
    // Audio being blocked or unsupported must never break the game itself.
  }
}, { once: true });

function squeakTone(ctx, startTime, freqStart, freqEnd, duration, gainPeak) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const gain = ctx.createGain();

  osc.frequency.setValueAtTime(freqStart, startTime);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + duration * 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function playMoveSqueak() {
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    squeakTone(ctx, now, 1600, 1100, 0.12, 0.3);
  } catch {
    // A sound failing to play must never break move-making.
  }
}

export function playCaptureSqueak() {
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Two quick descending blips to sound like a nibble, not just a move.
    squeakTone(ctx, now, 2000, 1400, 0.09, 0.35);
    squeakTone(ctx, now + 0.1, 1800, 1000, 0.11, 0.35);
  } catch {
    // A sound failing to play must never break move-making.
  }
}

// Background cafe ambience: a low hum (two slightly detuned low oscillators,
// which beat together for a warm, room-tone feel) plus occasional soft,
// filtered noise bursts standing in for distant chatter — an honest
// approximation given there are no recorded voice samples to draw on.

let ambience = null;
let chatterTimer = null;

function noiseBuffer(ctx, duration) {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playChatterBurst(ctx, destination) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 0.3 + Math.random() * 0.3);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 300 + Math.random() * 500;
  filter.Q.value = 1.5;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(now);
  source.stop(now + 0.6);
}

export function startAmbience() {
  try {
    if (ambience) return;
    const ctx = ensureContext();
    if (!ctx) return;

    const ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 1;
    ambienceGain.connect(masterGain);

    const hum1 = ctx.createOscillator();
    hum1.type = 'sine';
    hum1.frequency.value = 55;
    const hum2 = ctx.createOscillator();
    hum2.type = 'sine';
    hum2.frequency.value = 58;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.05;
    hum1.connect(humGain);
    hum2.connect(humGain);
    humGain.connect(ambienceGain);
    hum1.start();
    hum2.start();

    ambience = { hum1, hum2, ambienceGain };

    const scheduleNext = () => {
      try {
        playChatterBurst(ctx, ambienceGain);
      } catch {
        // Skip this burst rather than breaking the schedule.
      }
      chatterTimer = setTimeout(scheduleNext, 1500 + Math.random() * 2500);
    };
    scheduleNext();
  } catch {
    // Ambience is decorative — never let it break entering a game.
  }
}

export function stopAmbience() {
  if (!ambience) return;
  try {
    ambience.hum1.stop();
    ambience.hum2.stop();
  } catch {
    // Already stopped/disconnected — fine.
  }
  clearTimeout(chatterTimer);
  ambience = null;
  chatterTimer = null;
}

export function setMuted(value) {
  muted = value;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
  try {
    sessionStorage.setItem('cheese-muted', String(muted));
  } catch {
    // No persistence available — the toggle still works for this page view.
  }
}

export function isMuted() {
  return muted;
}

// Self-contained mute toggle, present on every screen regardless of mode.
function createMuteButton() {
  const btn = document.createElement('button');
  btn.id = 'mute-toggle';
  btn.className = 'mute-toggle';
  btn.type = 'button';

  const refresh = () => {
    const m = isMuted();
    btn.textContent = m ? '🔇' : '🔊';
    btn.title = m ? 'Unmute' : 'Mute';
    btn.setAttribute('aria-label', btn.title);
  };

  btn.addEventListener('click', () => {
    setMuted(!isMuted());
    refresh();
  });

  refresh();
  document.body.appendChild(btn);
}

if (document.body) {
  createMuteButton();
} else {
  document.addEventListener('DOMContentLoaded', createMuteButton);
}
