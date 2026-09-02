/**
 * ==============================================================================
 * MC-LARENS ERP: Escáner Inteligente de Tarjetas de Circulación (Live Auto-Lock)
 * ==============================================================================
 * Inspirado en el flujo de escaneo instantáneo tipo Stripe/Amazon Card Scanner:
 * - Mantiene el feed de video continuo a 1280x720.
 * - Evalúa nitidez (Laplacian), deslumbramiento (glare) y encuadre (fill) cada ~200ms.
 * - Tras 3 lecturas óptimas consecutivas (~500-700ms), captura automáticamente
 *   el fotograma más nítido a resolución optimizada (JPEG <= 1600px, quality 0.72).
 * ==============================================================================
 */

/**
 * Inicia la cámara trasera en modo environment a resolución balanceada 720p/1080p
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("El navegador no soporta acceso directo a la cámara.");
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (videoEl) {
    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "true");
    videoEl.muted = true;
    try {
      await videoEl.play();
    } catch (e) {
      console.warn("Video play error (esperando interacción del usuario):", e);
    }
  }
  return stream;
}

/**
 * Detiene todos los tracks de la cámara de forma segura
 * @param {MediaStream} stream
 */
export function stopCamera(stream) {
  if (!stream) return;
  try {
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      try {
        track.stop();
      } catch (_) {}
    });
  } catch (e) {
    console.warn("Error deteniendo stream de cámara:", e);
  }
}

/**
 * Puntuación de detección real de documento:
 * - Recorta la zona del recuadro a un canvas ligero de 320px
 * - Evalúa si el fondo es claro tipo documento (Luma entre 90 y 230)
 * - Evalúa la presencia de múltiples transiciones horizontales de texto impreso
 * - Evalúa Nitidez y ausencia de deslumbramiento (glare)
 * 
 * @param {HTMLVideoElement} videoEl
 * @param {{ x: number, y: number, width: number, height: number } | null} guideRect
 * @returns {{ sharpness: number, fill: number, glare: number, textScore: number, ok: boolean, status: string }}
 */
export function scoreFrame(videoEl, guideRect) {
  if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
    return { sharpness: 0, fill: 0, glare: 1, textScore: 0, ok: false, status: "searching" };
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;

  let sx, sy, sw, sh;
  if (guideRect && guideRect.width > 0 && guideRect.height > 0) {
    const elWidth = videoEl.clientWidth || vw;
    const elHeight = videoEl.clientHeight || vh;
    const scaleX = vw / elWidth;
    const scaleY = vh / elHeight;

    sx = Math.max(0, guideRect.x * scaleX);
    sy = Math.max(0, guideRect.y * scaleY);
    sw = Math.min(vw - sx, guideRect.width * scaleX);
    sh = Math.min(vh - sy, guideRect.height * scaleY);
  } else {
    const targetAspect = 1.58;
    sw = Math.min(vw * 0.85, vh * 0.85 * targetAspect);
    sh = sw / targetAspect;
    sx = (vw - sw) / 2;
    sy = (vh - sh) / 2;
  }

  const targetW = 320;
  const targetH = Math.round(targetW / (sw / sh || 1.58));

  let canvas = scoreFrame._canvas;
  if (!canvas) {
    canvas = document.createElement("canvas");
    scoreFrame._canvas = canvas;
  }
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { sharpness: 0, fill: 0, glare: 1, textScore: 0, ok: false, status: "searching" };
  }

  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, targetW, targetH);
  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;
  const totalPixels = targetW * targetH;

  // 1. Escala a gris y cálculo de Luma + Reflejos
  const gray = new Uint8Array(totalPixels);
  let glareCount = 0;
  let darkCount = 0;
  let totalLuma = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    gray[p] = luma;
    totalLuma += luma;
    if (luma > 248) glareCount++;
    if (luma < 40) darkCount++;
  }

  const glareRatio = glareCount / totalPixels;
  const avgLuma = totalLuma / totalPixels;
  const darkRatio = darkCount / totalPixels;

  if (glareRatio > 0.10) {
    return { sharpness: 0, fill: 0, glare: glareRatio, textScore: 0, ok: false, status: "glare" };
  }

  // Una tarjeta de circulación es clara (fondo claro con texto oscuro)
  // Si está demasiado oscura o es un fondo de ropa/piel/mesa oscura, descartar
  if (avgLuma < 85 || darkRatio > 0.55) {
    return { sharpness: 0, fill: 0, glare: glareRatio, textScore: 0, ok: false, status: "closer" };
  }

  // 2. Detección de Líneas Horizontales de Texto Impreso
  // Las tarjetas oficiales tienen múltiples transiciones oscuro-claro por fila
  let textTransitions = 0;
  let evaluatedRows = 0;
  const yStart = Math.round(targetH * 0.18);
  const yEnd = Math.round(targetH * 0.82);
  const xStart = Math.round(targetW * 0.12);
  const xEnd = Math.round(targetW * 0.88);

  for (let y = yStart; y < yEnd; y += 3) {
    evaluatedRows++;
    const rowOffset = y * targetW;
    let rowTransitions = 0;
    for (let x = xStart; x < xEnd - 1; x++) {
      const diff = Math.abs(gray[rowOffset + x] - gray[rowOffset + x + 1]);
      if (diff > 25) {
        rowTransitions++;
      }
    }
    // Si la fila contiene patrón de caracteres
    if (rowTransitions >= 7) {
      textTransitions += rowTransitions;
    }
  }

  const textDensity = textTransitions / (evaluatedRows * (xEnd - xStart) || 1);
  const hasTextPattern = textDensity > 0.035 && textTransitions >= 50;

  // 3. Nitidez por varianza de Laplaciano
  let sumLap = 0;
  let sumLapSq = 0;
  let lapCount = 0;

  for (let y = yStart; y < yEnd; y += 2) {
    const rowIdx = y * targetW;
    for (let x = xStart; x < xEnd; x += 2) {
      const idx = rowIdx + x;
      const val =
        gray[idx - targetW] +
        gray[idx + targetW] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];

      const absVal = Math.abs(val);
      sumLap += absVal;
      sumLapSq += absVal * absVal;
      lapCount++;
    }
  }

  const meanLap = sumLap / (lapCount || 1);
  const variance = sumLapSq / (lapCount || 1) - meanLap * meanLap;
  const sharpness = Math.sqrt(Math.max(0, variance));

  // Criterios de documento verificado:
  // - Nitidez suficiente (> 16.0)
  // - Patrón de texto impreso verificado (hasTextPattern)
  // - Nivel de luz adecuado de documento
  let status = "searching";
  let isOk = false;

  if (glareRatio > 0.08) {
    status = "glare";
  } else if (avgLuma < 85 || textDensity < 0.02) {
    status = "closer";
  } else if (sharpness < 15.0 || !hasTextPattern) {
    status = "searching";
  } else {
    status = "hold";
    isOk = true;
  }

  return {
    sharpness,
    fill: Math.min(1.0, textDensity * 15),
    glare: glareRatio,
    textScore: textDensity,
    ok: isOk,
    status,
  };
}

/**
 * Captura un fotograma de alta calidad en formato JPEG optimizado recortado al recuadro guía
 * @param {HTMLVideoElement} videoEl
 * @param {number} maxW - Ancho máximo (ej: 1600px)
 * @param {number} quality - Calidad JPEG (ej: 0.85)
 * @param {{ x: number, y: number, width: number, height: number } | null} [guideRect]
 * @returns {string} DataURL base64 JPEG
 */
export function grabJpeg(videoEl, maxW = 1600, quality = 0.85, guideRect = null) {
  if (!videoEl || videoEl.videoWidth === 0) return null;

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;

  let sx = 0, sy = 0, sw = vw, sh = vh;

  if (guideRect && guideRect.width > 0 && guideRect.height > 0) {
    const elWidth = videoEl.clientWidth || vw;
    const elHeight = videoEl.clientHeight || vh;
    const scaleX = vw / elWidth;
    const scaleY = vh / elHeight;

    // Margen de seguridad del 10% para nunca cortar las esquinas ni el texto de la tarjeta
    const padX = guideRect.width * 0.10;
    const padY = guideRect.height * 0.10;

    const rawX = (guideRect.x - padX) * scaleX;
    const rawY = (guideRect.y - padY) * scaleY;
    const rawW = (guideRect.width + padX * 2) * scaleX;
    const rawH = (guideRect.height + padY * 2) * scaleY;

    sx = Math.max(0, Math.min(vw - 50, rawX));
    sy = Math.max(0, Math.min(vh - 50, rawY));
    sw = Math.min(vw - sx, rawW);
    sh = Math.min(vh - sy, rawH);
  }

  const scale = Math.min(1.0, maxW / sw);
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Motor de Auto-Lock reactivo:
 * - Monitorea el video cada `intervalMs` (ej: 200ms).
 * - Notifica cambios de estado en tiempo real.
 * - Al completar 5 lecturas OK consecutivas (~1.0s - 1.2s de estabilidad), captura el JPEG.
 * 
 * @param {Object} config
 * @param {HTMLVideoElement} config.videoEl
 * @param {() => { x: number, y: number, width: number, height: number } | null} [config.getGuideRect]
 * @param {(status: 'searching'|'closer'|'glare'|'hold'|'capturing'|'manual') => void} config.onStatus
 * @param {(dataUrl: string) => void} config.onCapture
 * @param {boolean} [config.autoTrigger=false]
 * @param {number} [config.intervalMs=200]
 * @returns {{ stop: () => void }}
 */
export function createAutoLock({
  videoEl,
  getGuideRect,
  onStatus,
  onCapture,
  autoTrigger = false,
  intervalMs = 200,
}) {
  let timerId = null;
  let consecutiveOkCount = 0;
  let bestCandidate = null;
  let bestCandidateSharpness = 0;
  let isStopped = false;
  let startTime = Date.now();

  const loop = () => {
    if (isStopped || !videoEl) return;

    try {
      const guide = typeof getGuideRect === "function" ? getGuideRect() : null;
      const score = scoreFrame(videoEl, guide);
      const elapsedSec = (Date.now() - startTime) / 1000;

      if (score.ok) {
        consecutiveOkCount++;
        // Almacenar el fotograma más nítido de la ráfaga recortado a la tarjeta
        if (score.sharpness > bestCandidateSharpness) {
          bestCandidate = grabJpeg(videoEl, 1600, 0.85, guide);
          bestCandidateSharpness = score.sharpness;
        }

        // Si autoTrigger está habilitado y hay 5 lecturas estables consecutivas (~1.2s)
        if (autoTrigger && consecutiveOkCount >= 5) {
          isStopped = true;
          if (onStatus) onStatus("capturing");
          const finalJpeg = bestCandidate || grabJpeg(videoEl, 1600, 0.85, guide);
          if (onCapture && finalJpeg) {
            onCapture(finalJpeg);
          }
          return;
        } else {
          if (onStatus) onStatus("hold");
        }
      } else {
        consecutiveOkCount = 0;
        bestCandidate = null;
        bestCandidateSharpness = 0;

        if (elapsedSec > 10.0) {
          if (onStatus) onStatus("manual");
        } else {
          if (onStatus) onStatus(score.status || "searching");
        }
      }
    } catch (err) {
      console.warn("Error en ciclo de auto-lock:", err);
    }

    if (!isStopped) {
      timerId = setTimeout(loop, intervalMs);
    }
  };

  timerId = setTimeout(loop, 150);

  return {
    stop() {
      isStopped = true;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}
