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
 * Puntuación heurística de un fotograma sin necesidad de OpenCV ni librerías pesadas:
 * - Recorta la zona del recuadro a un canvas ligero de 320px
 * - Evalúa Nitidez (Varianza aproximada de Laplaciano 3x3)
 * - Evalúa Reflejos/Brillo (Porcentaje de píxeles con luma > 245)
 * - Evalúa Cobertura/Fill (Densidad de contraste/bordes en bordes y centro)
 * 
 * @param {HTMLVideoElement} videoEl
 * @param {{ x: number, y: number, width: number, height: number } | null} guideRect
 * @returns {{ sharpness: number, fill: number, glare: number, ok: boolean, status: string }}
 */
export function scoreFrame(videoEl, guideRect) {
  if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
    return { sharpness: 0, fill: 0, glare: 1, ok: false, status: "searching" };
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;

  // Si no se especifica guideRect, usar el 75% central con aspecto de tarjeta (1.58)
  let sx, sy, sw, sh;
  if (guideRect && guideRect.width > 0 && guideRect.height > 0) {
    // Proporciones relativas al contenedor de video renderizado
    const elWidth = videoEl.clientWidth || vw;
    const elHeight = videoEl.clientHeight || vh;
    const scaleX = vw / elWidth;
    const scaleY = vh / elHeight;

    sx = Math.max(0, guideRect.x * scaleX);
    sy = Math.max(0, guideRect.y * scaleY);
    sw = Math.min(vw - sx, guideRect.width * scaleX);
    sh = Math.min(vh - sy, guideRect.height * scaleY);
  } else {
    // Recuadro por defecto al centro (aspecto ~1.58)
    const targetAspect = 1.58;
    sw = Math.min(vw * 0.85, vh * 0.85 * targetAspect);
    sh = sw / targetAspect;
    sx = (vw - sw) / 2;
    sy = (vh - sh) / 2;
  }

  const targetW = 320;
  const targetH = Math.round(targetW / (sw / sh || 1.58));

  // Canvas offscreen reutilizable
  let canvas = scoreFrame._canvas;
  if (!canvas) {
    canvas = document.createElement("canvas");
    scoreFrame._canvas = canvas;
  }
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { sharpness: 0, fill: 0, glare: 1, ok: false, status: "searching" };
  }

  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, targetW, targetH);
  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;
  const totalPixels = targetW * targetH;

  // 1. Escala a gris y cálculo de Luma + Reflejos (Glare)
  const gray = new Uint8Array(totalPixels);
  let glareCount = 0;
  let darkCount = 0;
  let totalLuma = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Coeficientes BT.601
    const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    gray[p] = luma;
    totalLuma += luma;
    if (luma > 242) glareCount++;
    if (luma < 35) darkCount++;
  }

  const glareRatio = glareCount / totalPixels;
  const avgLuma = totalLuma / totalPixels;

  // Si hay demasiado brillo blanco que tapa los textos
  if (glareRatio > 0.08) {
    return { sharpness: 0, fill: 0, glare: glareRatio, ok: false, status: "glare" };
  }

  // Si la escena está demasiado oscura
  if (avgLuma < 45 || darkCount / totalPixels > 0.65) {
    return { sharpness: 0, fill: 0, glare: glareRatio, ok: false, status: "searching" };
  }

  // 2. Cálculo de Nitidez (Varianza aproximada de Laplaciano 3x3)
  // Kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
  let sumLap = 0;
  let sumLapSq = 0;
  let lapCount = 0;
  let borderEdgeCount = 0;
  let centerEdgeCount = 0;

  const borderMarginX = Math.round(targetW * 0.15);
  const borderMarginY = Math.round(targetH * 0.15);

  for (let y = 1; y < targetH - 1; y += 2) {
    const rowIdx = y * targetW;
    const isNearBorder = y < borderMarginY || y > targetH - borderMarginY;

    for (let x = 1; x < targetW - 1; x += 2) {
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

      // Evaluar presencia de bordes y texto
      if (absVal > 22) {
        if (isNearBorder || x < borderMarginX || x > targetW - borderMarginX) {
          borderEdgeCount++;
        } else {
          centerEdgeCount++;
        }
      }
    }
  }

  const meanLap = sumLap / (lapCount || 1);
  const variance = sumLapSq / (lapCount || 1) - meanLap * meanLap;
  const sharpness = Math.sqrt(Math.max(0, variance));

  // 3. Fill ratio (tarjeta encuadrada y abarcando el recuadro con texto)
  const edgeDensity = (borderEdgeCount + centerEdgeCount) / (lapCount || 1);
  const fillScore = Math.min(1.0, edgeDensity * 4.5);

  // Criterio de validación
  // Sharpness > 12.0 indica texto legible enfocado
  // Glare < 0.08 descarta reflejos molestos
  // Fill > 0.35 asegura que la tarjeta está dentro del visor
  let status = "searching";
  let isOk = false;

  if (glareRatio > 0.07) {
    status = "glare";
  } else if (fillScore < 0.30) {
    status = "closer";
  } else if (sharpness < 11.0) {
    status = "searching";
  } else {
    // Cumple todas las condiciones de nitidez y encuadre
    status = "hold";
    isOk = true;
  }

  return {
    sharpness,
    fill: fillScore,
    glare: glareRatio,
    ok: isOk,
    status,
  };
}

/**
 * Captura un fotograma de alta calidad en formato JPEG optimizado
 * @param {HTMLVideoElement} videoEl
 * @param {number} maxW - Ancho máximo (ej: 1600px)
 * @param {number} quality - Calidad JPEG (ej: 0.72)
 * @returns {string} DataURL base64 JPEG
 */
export function grabJpeg(videoEl, maxW = 1600, quality = 0.72) {
  if (!videoEl || videoEl.videoWidth === 0) return null;

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const scale = Math.min(1.0, maxW / vw);
  const width = Math.round(vw * scale);
  const height = Math.round(vh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(videoEl, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Motor de Auto-Lock reactivo:
 * - Monitorea el video cada `intervalMs` (ej: 180-220ms).
 * - Notifica cambios de estado en tiempo real.
 * - Al completar 3 lecturas OK consecutivas (~500-700ms), captura y entrega el JPEG.
 * 
 * @param {Object} config
 * @param {HTMLVideoElement} config.videoEl
 * @param {() => { x: number, y: number, width: number, height: number } | null} [config.getGuideRect]
 * @param {(status: 'searching'|'closer'|'glare'|'hold'|'capturing'|'manual') => void} config.onStatus
 * @param {(dataUrl: string) => void} config.onCapture
 * @param {number} [config.intervalMs=200]
 * @returns {{ stop: () => void }}
 */
export function createAutoLock({
  videoEl,
  getGuideRect,
  onStatus,
  onCapture,
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
        // Almacenar el fotograma más nítido de la ráfaga
        if (score.sharpness > bestCandidateSharpness) {
          bestCandidate = grabJpeg(videoEl, 1600, 0.75);
          bestCandidateSharpness = score.sharpness;
        }

        if (consecutiveOkCount >= 3) {
          // Bloqueo exitoso (Lock confirmado)
          isStopped = true;
          if (onStatus) onStatus("capturing");
          const finalJpeg = bestCandidate || grabJpeg(videoEl, 1600, 0.75);
          if (onCapture && finalJpeg) {
            onCapture(finalJpeg);
          }
          return;
        } else {
          if (onStatus) onStatus("hold");
        }
      } else {
        // Se perdió el enfoque o se movió la tarjeta -> reiniciar racha
        consecutiveOkCount = 0;
        bestCandidate = null;
        bestCandidateSharpness = 0;

        if (elapsedSec > 8.0) {
          // Si han pasado más de 8 segundos sin lock, sugerir manual
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

  // Iniciar ciclo de evaluación
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
