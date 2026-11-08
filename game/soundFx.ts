let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AudioCtx();
    }
    if (sharedCtx.state === "suspended") {
      void sharedCtx.resume();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

function playTone(
  frequency: number,
  durationSec: number,
  startOffsetSec: number = 0,
  type: OscillatorType = "square",
  gainPeak: number = 0.08
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const startTime = ctx.currentTime + startOffsetSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.02);
  } catch {
    // Ignore WebAudio failures in restricted/headless environments
  }
}

export function playClickSfx(): void {
  playTone(520, 0.06, 0, "square", 0.05);
}

export function playCorrectSfx(): void {
  playTone(523.25, 0.09, 0, "square", 0.06); // C5
  playTone(659.25, 0.09, 0.08, "square", 0.06); // E5
  playTone(783.99, 0.14, 0.16, "square", 0.07); // G5
}

export function playWrongSfx(): void {
  playTone(260, 0.12, 0, "sawtooth", 0.06);
  playTone(185, 0.22, 0.11, "sawtooth", 0.07);
}

export function playWinSfx(): void {
  playTone(523.25, 0.1, 0, "square", 0.06);
  playTone(659.25, 0.1, 0.1, "square", 0.06);
  playTone(783.99, 0.1, 0.2, "square", 0.06);
  playTone(1046.5, 0.28, 0.3, "square", 0.08);
}

export function playLoseSfx(): void {
  playTone(349.23, 0.14, 0, "triangle", 0.08);
  playTone(311.13, 0.14, 0.15, "triangle", 0.08);
  playTone(261.63, 0.3, 0.3, "triangle", 0.08);
}

