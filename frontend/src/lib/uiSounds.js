import { getStoredSoundPreferences, UI_SOUND_PROFILES } from "@/lib/userUiPreferences";

let sharedAudioContext = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextCls = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCls) return null;

  if (sharedAudioContext && sharedAudioContext.state !== "closed") {
    return sharedAudioContext;
  }

  try {
    sharedAudioContext = new AudioContextCls();
    return sharedAudioContext;
  } catch (_) {
    sharedAudioContext = null;
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
    const startAt = ctx.currentTime + 0.012;
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

export const playBarcodeScanSound = () => {
  playPattern([
    { frequency: 1567.98, endFrequency: 1760, offset: 0, duration: 0.08, peak: 0.09, type: "sine" },
    { frequency: 2093, endFrequency: 2349.32, offset: 0.045, duration: 0.1, peak: 0.08, type: "triangle" },
  ], 180);
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

// Agudo: sumar unidad en carrito (ascending high notes)
export const playCartQuantityUpSound = () => {
  playPattern([
    { frequency: 880.0,  endFrequency: 987.77, offset: 0,     duration: 0.07,  peak: 0.05,  type: "triangle" },
    { frequency: 1174.66, endFrequency: 1318.51, offset: 0.05, duration: 0.065, peak: 0.04,  type: "sine" },
  ], 180);
};

// Grave: restar unidad en carrito (descending low notes)
export const playCartQuantityDownSound = () => {
  playPattern([
    { frequency: 329.63, endFrequency: 293.66, offset: 0,     duration: 0.08,  peak: 0.055, type: "triangle" },
    { frequency: 246.94, endFrequency: 220.0,  offset: 0.055, duration: 0.075, peak: 0.045, type: "sine" },
  ], 180);
};

// Kept for backward compatibility
export const playCartQuantityChangeSound = playCartQuantityUpSound;

// Undo action: descending sweep conveying "going back"
export const playUndoSound = () => {
  playPattern([
    { frequency: 523.25, endFrequency: 392.0,  offset: 0,     duration: 0.09,  peak: 0.055, type: "sine" },
    { frequency: 392.0,  endFrequency: 293.66, offset: 0.07,  duration: 0.1,   peak: 0.045, type: "triangle" },
    { frequency: 261.63, endFrequency: 220.0,  offset: 0.15,  duration: 0.11,  peak: 0.035, type: "sine" },
  ], 220);
};

export const playLoginPinpadSound = (kind = "key") => {
  if (kind === "success") {
    playPattern([
      { frequency: 820, endFrequency: 920, offset: 0, duration: 0.09, peak: 0.09, type: "triangle" },
      { frequency: 1032.0, endFrequency: 1174.66, offset: 0.055, duration: 0.1, peak: 0.08, type: "triangle" },
    ], 210);
    return;
  }

  if (kind === "warning") {
    playPattern([
      { frequency: 520, endFrequency: 460, offset: 0, duration: 0.12, peak: 0.1, type: "sawtooth" },
    ], 180);
    return;
  }

  if (kind === "error") {
    playPattern([
      { frequency: 180, endFrequency: 160, offset: 0, duration: 0.16, peak: 0.11, type: "square" },
      { frequency: 140, endFrequency: 120, offset: 0.085, duration: 0.17, peak: 0.1, type: "square" },
    ], 250);
    return;
  }

  playPattern([
    { frequency: 1320, endFrequency: 1396.91, offset: 0, duration: 0.075, peak: 0.085, type: "square" },
  ], 130);
};