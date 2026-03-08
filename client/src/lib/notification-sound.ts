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

export function playNotificationSound() {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(() => _playAlienSound(audioCtx!)).catch(() => {});
    } else {
      _playAlienSound(audioCtx);
    }
  } catch (e) {
    console.warn("[notification-sound] Could not play:", e);
  }
}

function _playAlienSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1.0;
  master.connect(ctx.destination);

  function note(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    start: number,
    dur: number,
    vol: number,
    detune = 0
  ) {
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

  // Phase 1: UFO sweep up-down (0 – 0.32s)
  note("sine",  220,  1800, 0,    0.18, 0.75);
  note("sine",  220,  1800, 0,    0.18, 0.35, 700);
  note("sine", 1800,   440, 0.18, 0.14, 0.65);

  // Phase 2: alien beep-beep (0.38s – 0.65s)
  note("square",  880, 880, 0.37, 0.10, 0.45);
  note("sine",   1100, 1100, 0.37, 0.10, 0.30, -1200);

  note("square", 1320, 1320, 0.52, 0.12, 0.50);
  note("sine",   1650, 1650, 0.52, 0.12, 0.28, -1200);

  // Phase 3: cosmic tail (0.67s – 0.85s)
  note("sine",  660,  110, 0.67, 0.18, 0.25);
}
