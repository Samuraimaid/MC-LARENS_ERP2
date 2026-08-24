/**
 * MC-LARENS ERP: Sistema de Alertas Sonoras y Hápticas para Técnicos y KDS
 * ========================================================================
 * Utiliza Web Audio API nativa para sintetizar tonos y chimes distintivos de alta
 * audibilidad en talleres, sin depender de archivos de audio externos ni conexión lenta.
 */

class AudioAlertService {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastPlayedAt = 0;
  }

  _getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Tono de Nuevo Trabajo Asignado / Material Listo (Chime de 3 notas ascendentes)
   */
  playNewJobChime() {
    if (!this.enabled) return;

    // Evitar spam si se disparan varios eventos en menos de 1 segundo
    const now = Date.now();
    if (now - this.lastPlayedAt < 1200) return;
    this.lastPlayedAt = now;

    // Vibración en dispositivos móviles Android / PWA
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([120, 80, 150, 80, 200]);
      }
    } catch {
      // ignore
    }

    const ctx = this._getAudioContext();
    if (!ctx) return;

    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.18 }, // C5
      { freq: 659.25, time: 0.14, dur: 0.18 }, // E5
      { freq: 783.99, time: 0.28, dur: 0.35 }, // G5
      { freq: 1046.50, time: 0.44, dur: 0.45 }, // C6 (brillante)
    ];

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, ctx.currentTime);
    masterGain.connect(ctx.destination);

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      gain.gain.setValueAtTime(0.01, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + 0.05);
    });
  }

  /**
   * Tono de Material Listo en Mesa de Corte (Doble Beep Agradable)
   */
  playMaterialReadyChime() {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this.lastPlayedAt < 1000) return;
    this.lastPlayedAt = now;

    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 60, 180]);
      }
    } catch {
      // ignore
    }

    const ctx = this._getAudioContext();
    if (!ctx) return;

    const notes = [
      { freq: 587.33, time: 0.00, dur: 0.15 }, // D5
      { freq: 880.00, time: 0.12, dur: 0.35 }, // A5
    ];

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, ctx.currentTime);
    masterGain.connect(ctx.destination);

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      gain.gain.setValueAtTime(0.01, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + 0.05);
    });
  }
}

export const audioAlerts = new AudioAlertService();
