let audioCtx: AudioContext | null = null;
let unlocked = false;

export function initNotificationSound() {
  if (unlocked) return;
  try {
    audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    unlocked = true;
  } catch (e) {
    console.warn("[notification-sound] AudioContext init failed:", e);
  }
}

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContext();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function resume(ctx: AudioContext, fn: () => void) {
  if (ctx.state === "suspended") {
    ctx.resume().then(fn).catch(() => {});
  } else {
    fn();
  }
}

export function playNotificationSound() {
  const ctx = getCtx();
  if (!ctx) return;
  resume(ctx, () => _playAlienSound(ctx));
}

export function playVibrappSound() {
  const ctx = getCtx();
  if (!ctx) return;
  resume(ctx, () => _playVibrappDirectSound(ctx));
}

function _note(
  ctx: AudioContext,
  master: GainNode,
  type: OscillatorType,
  freqStart: number,
  freqEnd: number,
  start: number,
  dur: number,
  vol: number,
  detune = 0
) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freqStart, now + start);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + start + dur * 0.9);
  }
  gain.gain.setValueAtTime(0, now + start);
  gain.gain.linearRampToValueAtTime(vol, now + start + 0.015);
  gain.gain.setValueAtTime(vol, now + start + dur * 0.75);
  gain.gain.linearRampToValueAtTime(0, now + start + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now + start);
  osc.stop(now + start + dur + 0.01);
}

function _playAlienSound(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.value = 1.0;
  master.connect(ctx.destination);

  const n = (type: OscillatorType, fs: number, fe: number, s: number, d: number, v: number, det = 0) =>
    _note(ctx, master, type, fs, fe, s, d, v, det);

  // Phase 1: UFO sweep up-down (0 – 0.32s)
  n("sine",  220,  1800, 0,    0.18, 0.75);
  n("sine",  220,  1800, 0,    0.18, 0.35, 700);
  n("sine", 1800,   440, 0.18, 0.14, 0.65);

  // Phase 2: alien beep-beep (0.38s – 0.65s)
  n("square",  880, 880, 0.37, 0.10, 0.45);
  n("sine",   1100, 1100, 0.37, 0.10, 0.30, -1200);

  n("square", 1320, 1320, 0.52, 0.12, 0.50);
  n("sine",   1650, 1650, 0.52, 0.12, 0.28, -1200);

  // Phase 3: cosmic tail (0.67s – 0.85s)
  n("sine",  660,  110, 0.67, 0.18, 0.25);
}

// Suono distinto per messaggi Vibrapp diretti — più intenso e cosmico
function _playVibrappDirectSound(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.value = 1.0;
  master.connect(ctx.destination);

  const n = (type: OscillatorType, fs: number, fe: number, s: number, d: number, v: number, det = 0) =>
    _note(ctx, master, type, fs, fe, s, d, v, det);

  // Apertura: razzo spaziale ascendente
  n("sine",  150,  2200, 0,    0.22, 0.80);
  n("sine",  150,  2200, 0,    0.22, 0.40, 1200);
  n("sawtooth", 200, 800, 0,   0.15, 0.20);

  // Beep cosmico triplo distinto
  n("square",  600,  600, 0.26, 0.08, 0.55);
  n("square",  900,  900, 0.36, 0.08, 0.55);
  n("square", 1200, 1200, 0.46, 0.10, 0.60);

  // Armonia vibra
  n("sine",   900,  900, 0.26, 0.08, 0.30, -800);
  n("sine",  1350, 1350, 0.36, 0.08, 0.30, -800);
  n("sine",  1800, 1800, 0.46, 0.10, 0.35, -800);

  // Coda cosmica lunga
  n("sine",  1200,  80, 0.58, 0.30, 0.35);
  n("sine",  2400,  80, 0.58, 0.30, 0.15);
}
