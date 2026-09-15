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
  const ctx = ensureContext();
  if (ambience) return;

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
    playChatterBurst(ctx, ambienceGain);
    chatterTimer = setTimeout(scheduleNext, 1500 + Math.random() * 2500);
  };
  scheduleNext();
}

export function stopAmbience() {
  if (!ambience) return;
  ambience.hum1.stop();
  ambience.hum2.stop();
  clearTimeout(chatterTimer);
  ambience = null;
  chatterTimer = null;
}

export function setMuted(value) {
  muted = value;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}
