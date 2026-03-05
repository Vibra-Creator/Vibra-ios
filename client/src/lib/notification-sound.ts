let cachedAudioUrl: string | null = null;

function generateNotificationWav(): string {
  if (cachedAudioUrl) return cachedAudioUrl;

  const sampleRate = 22050;
  const duration = 0.4;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase1 = t < 0.15 ? 0 : 1;
    const freq1 = 880 + (t < 0.15 ? t / 0.15 * 200 : 200);
    const freq2 = 1320 + (t < 0.15 ? 0 : (t - 0.15) / 0.25 * 300);
    const freq = phase1 === 0 ? freq1 : freq2;

    let envelope = 0;
    if (t < 0.02) envelope = t / 0.02;
    else if (t < 0.12) envelope = 1;
    else if (t < 0.15) envelope = 1 - (t - 0.12) / 0.03 * 0.3;
    else if (t < 0.17) envelope = 0.7 + (t - 0.15) / 0.02 * 0.3;
    else if (t < 0.32) envelope = 1;
    else envelope = Math.max(0, 1 - (t - 0.32) / 0.08);

    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  cachedAudioUrl = URL.createObjectURL(blob);
  return cachedAudioUrl;
}

let audioElement: HTMLAudioElement | null = null;

export function playNotificationSound() {
  try {
    const url = generateNotificationWav();

    if (!audioElement) {
      audioElement = new Audio();
    }
    audioElement.src = url;
    audioElement.volume = 0.7;
    audioElement.play().catch(() => {});
  } catch (e) {
    console.warn("[notification-sound] Could not play:", e);
  }
}

export function initNotificationSound() {
  if (!audioElement) {
    audioElement = new Audio();
    generateNotificationWav();
  }
}
