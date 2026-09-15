// All sound is synthesized with the Web Audio API — no audio asset files.
// Browsers block audio until a real user gesture, so the context is created
// lazily on first click anywhere on the page.

let audioCtx = null;
let masterGain = null;
let muted = false;

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 0.5;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

document.addEventListener('click', ensureContext, { once: true });

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
  const ctx = ensureContext();
  const now = ctx.currentTime;
  squeakTone(ctx, now, 1600, 1100, 0.12, 0.3);
}

export function playCaptureSqueak() {
  const ctx = ensureContext();
  const now = ctx.currentTime;
  // Two quick descending blips to sound like a nibble, not just a move.
  squeakTone(ctx, now, 2000, 1400, 0.09, 0.35);
  squeakTone(ctx, now + 0.1, 1800, 1000, 0.11, 0.35);
}

export function setMuted(value) {
  muted = value;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}
