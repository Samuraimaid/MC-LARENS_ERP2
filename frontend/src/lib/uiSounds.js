import { getStoredSoundPreferences, UI_SOUND_PROFILES } from "@/lib/userUiPreferences";

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextCls = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCls) return null;

  try {
    return new AudioContextCls();
  } catch (_) {
    return null;
  }
};

const scheduleTone = (ctx, {
  startAt,
  frequency,
  duration,
  type = "triangle",
  peak = 0.08,
  attack = 0.008,
  endFrequency,
}) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration);
  }

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.015);
};

const playPattern = (notes, totalDurationMs) => {
  const { muted, profile } = getStoredSoundPreferences();
  if (muted) return;

  const profileMultiplier = profile === UI_SOUND_PROFILES.ARCADE ? 1.2 : 0.8;
  const adjustedNotes = notes.map((note) => ({
    ...note,
    peak: Math.max(0.01, Math.min(0.18, Number(note.peak || 0.08) * profileMultiplier)),
  }));

  const ctx = getAudioContext();
  if (!ctx) return;

  const runPattern = () => {
    const startAt = ctx.currentTime;
    adjustedNotes.forEach((note, index) => {
      scheduleTone(ctx, {
        startAt: startAt + (note.offset ?? index * 0.05),
        frequency: note.frequency,
        duration: note.duration ?? 0.1,
        type: note.type,
        peak: note.peak,
        attack: note.attack,
        endFrequency: note.endFrequency,
      });
    });

    window.setTimeout(() => {
      ctx.close().catch(() => null);
    }, totalDurationMs);
  };

  try {
    if (ctx.state === "suspended") {
      ctx.resume().then(runPattern).catch(() => null);
      return;
    }
    runPattern();
  } catch (_) {
    // Ignore browsers that block Web Audio in the current interaction context.
  }
};

export const playCartPickupSound = () => {
  playPattern([
    { frequency: 1318.51, endFrequency: 1364.66, offset: 0, duration: 0.11, peak: 0.11 },
    { frequency: 1760, endFrequency: 1820, offset: 0.055, duration: 0.11, peak: 0.11 },
  ], 220);
};

export const playSelectionFeedbackSound = () => {
  playPattern([
    { frequency: 880, endFrequency: 930, offset: 0, duration: 0.075, peak: 0.05, type: "sine" },
    { frequency: 1174.66, endFrequency: 1244.51, offset: 0.04, duration: 0.07, peak: 0.04, type: "triangle" },
  ], 170);
};

export const playCreationSuccessSound = () => {
  playPattern([
    { frequency: 1046.5, endFrequency: 1108.73, offset: 0, duration: 0.09, peak: 0.06, type: "triangle" },
    { frequency: 1318.51, endFrequency: 1396.91, offset: 0.05, duration: 0.1, peak: 0.07, type: "triangle" },
    { frequency: 1567.98, endFrequency: 1661.22, offset: 0.1, duration: 0.12, peak: 0.075, type: "triangle" },
  ], 260);
};

export const playCartRemoveSound = () => {
  playPattern([
    { frequency: 311.13, endFrequency: 277.18, offset: 0, duration: 0.11, peak: 0.07, type: "sawtooth" },
    { frequency: 233.08, endFrequency: 207.65, offset: 0.065, duration: 0.12, peak: 0.065, type: "triangle" },
  ], 240);
};

export const playCartQuantityChangeSound = () => {
  playPattern([
    { frequency: 659.25, endFrequency: 698.46, offset: 0, duration: 0.07, peak: 0.045, type: "triangle" },
    { frequency: 783.99, endFrequency: 830.61, offset: 0.045, duration: 0.065, peak: 0.04, type: "sine" },
  ], 180);
};