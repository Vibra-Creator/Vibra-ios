let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(1100, now + 0.08);
    osc1.frequency.setValueAtTime(1320, now + 0.16);

    osc2.frequency.setValueAtTime(440, now);
    osc2.frequency.setValueAtTime(550, now + 0.08);
    osc2.frequency.setValueAtTime(660, now + 0.16);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.setValueAtTime(0.3, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
    gain.gain.setValueAtTime(0.35, now + 0.16);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.18);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch (e) {
    console.warn("[notification-sound] Could not play:", e);
  }
}
