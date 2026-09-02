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
 * Obtiene la lista de cámaras traseras disponibles, priorizando la lente principal 1x.
 */
export async function getBackCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === "videoinput");
    
    // Filtrar cámaras traseras
    const backCameras = videoDevices.filter((d) => {
      const label = (d.label || "").toLowerCase();
      return (
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("trasera") ||
        label.includes("environment") ||
        label.includes("camera2 0") || // Android standard main rear
        (!label.includes("front") && !label.includes("delantera") && !label.includes("selfie"))
      );
    });

    // Ordenar para priorizar lente principal (1x standard) sobre gran angular (wide / 0.5x / ultra)
    return (backCameras.length > 0 ? backCameras : videoDevices).sort((a, b) => {
      const la = (a.label || "").toLowerCase();
      const lb = (b.label || "").toLowerCase();
      const isUltraA = la.includes("ultra") || la.includes("wide") || la.includes("0.5") || la.includes("macro");
      const isUltraB = lb.includes("ultra") || lb.includes("wide") || lb.includes("0.5") || lb.includes("macro");
      if (isUltraA && !isUltraB) return 1;
      if (!isUltraA && isUltraB) return -1;
      return 0;
    });
  } catch (e) {
    console.warn("Error enumerando cámaras:", e);
    return [];
  }
}

/**
 * Inicia la cámara trasera forzando la lente principal 1x y auto-enfoque continuo.
 * @param {HTMLVideoElement} videoEl
 * @param {string|null} preferredDeviceId
 * @returns {Promise<{ stream: MediaStream, capabilities: Object, currentZoom: number }>}
 */
export async function startCamera(videoEl, preferredDeviceId = null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("El navegador no soporta acceso directo a la cámara.");
  }

  let deviceId = preferredDeviceId;
  if (!deviceId) {
    const backCams = await getBackCameras();
    if (backCams.length > 0) {
      deviceId = backCams[0].deviceId;
    }
  }

  const videoConstraints = {
    width: { ideal: 1920, max: 2560 },
    height: { ideal: 1080, max: 1440 },
  };

  if (deviceId) {
    videoConstraints.deviceId = { exact: deviceId };
  } else {
    videoConstraints.facingMode = { ideal: "environment" };
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: videoConstraints,
  });

  const track = stream.getVideoTracks()[0];
  let capabilities = {};
  let currentZoom = 1.0;

  if (track) {
    capabilities = track.getCapabilities ? track.getCapabilities() : {};
    const advanced = [];

    // 1. Forzar enfoque continuo (Continuous Auto-Focus)
    if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
      advanced.push({ focusMode: "continuous" });
    }
    // 2. Exposición y balance de blancos continuos
    if (capabilities.exposureMode && capabilities.exposureMode.includes("continuous")) {
      advanced.push({ exposureMode: "continuous" });
    }
    if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes("continuous")) {
      advanced.push({ whiteBalanceMode: "continuous" });
    }

    // 3. Forzar Lente 1x (evitando gran angular 0.5x si el track reporta zoom mínimo < 1.0)
    if (capabilities.zoom && capabilities.zoom.min !== undefined && capabilities.zoom.max !== undefined) {
      const targetZoom = Math.max(capabilities.zoom.min, 1.0);
      currentZoom = targetZoom;
      advanced.push({ zoom: targetZoom });
    }

    if (advanced.length > 0) {
      try {
        await track.applyConstraints({ advanced });
      } catch (err) {
        console.warn("No se pudieron aplicar restricciones avanzadas de lente 1x:", err);
      }
    }
  }

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

  return { stream, capabilities, currentZoom };
}

/**
 * Aplica nivel de Zoom óptico/digital a la cámara (1x, 1.5x, 2x)
 */
export async function applyZoom(stream, zoomValue) {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (!track || !track.getCapabilities) return;
  const caps = track.getCapabilities();
  if (!caps.zoom) return;

  const clamped = Math.min(Math.max(zoomValue, caps.zoom.min || 1), caps.zoom.max || 1);
  try {
    await track.applyConstraints({
      advanced: [{ zoom: clamped }],
    });
  } catch (e) {
    console.warn("Error aplicando zoom a la cámara:", e);
  }
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
 * Valida la calidad de una imagen estática (subida o capturada) antes de enviarla a la IA:
 * - Detecta reflejos molestos o sobreexposición (glare)
 * - Detecta desenfoque o borrosidad severa (blur)
 * - Detecta imágenes excesivamente oscuras
 * 
 * @param {string} dataUrl - DataURL base64 de la imagen
 * @returns {Promise<{ ok: boolean, reason?: 'glare'|'blur'|'dark'|'empty'|'error', message?: string, sharpness: number, glareRatio: number }>}
 */
export function validateImageQuality(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve({ ok: false, reason: "empty", message: "No se proporcionó imagen.", sharpness: 0, glareRatio: 0 });
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const targetW = 400;
        const targetH = Math.round(targetW / (img.width / img.height || 1.58));

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ ok: true, sharpness: 20, glareRatio: 0 });
          return;
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);
        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;
        const totalPixels = targetW * targetH;

        const gray = new Uint8Array(totalPixels);
        let glareCount = 0;
        let darkCount = 0;
        let totalLuma = 0;

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
          gray[p] = luma;
          totalLuma += luma;
          if (luma > 246) glareCount++;
          if (luma < 40) darkCount++;
        }

        const glareRatio = glareCount / totalPixels;
        const avgLuma = totalLuma / totalPixels;
        const darkRatio = darkCount / totalPixels;

        // 1. Reflejo severo (> 7% de píxeles quemados por flash o luz directa)
        if (glareRatio > 0.07) {
          resolve({
            ok: false,
            reason: "glare",
            message: "La imagen tiene reflejos de luz o flash excesivo que tapan el texto de la tarjeta.",
            sharpness: 0,
            glareRatio,
          });
          return;
        }

        // 2. Imagen muy oscura
        if (avgLuma < 55 || darkRatio > 0.60) {
          resolve({
            ok: false,
            reason: "dark",
            message: "La imagen está demasiado oscura para leer los caracteres con certeza.",
            sharpness: 0,
            glareRatio,
          });
          return;
        }

        // 3. Nitidez (Laplaciano)
        let sumLap = 0;
        let sumLapSq = 0;
        let lapCount = 0;

        for (let y = 2; y < targetH - 2; y += 2) {
          const rowIdx = y * targetW;
          for (let x = 2; x < targetW - 2; x += 2) {
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

        // 4. Imagen borrosa / fuera de foco
        if (sharpness < 13.5) {
          resolve({
            ok: false,
            reason: "blur",
            message: "La imagen está borrosa o desenfocada. Asegúrate de enfocar bien las letras.",
            sharpness,
            glareRatio,
          });
          return;
        }

        resolve({
          ok: true,
          sharpness,
          glareRatio,
        });
      } catch (err) {
        console.warn("Error evaluando calidad de imagen:", err);
        resolve({ ok: true, sharpness: 20, glareRatio: 0 });
      }
    };
    img.onerror = () => {
      resolve({ ok: false, reason: "error", message: "No se pudo procesar el archivo de imagen.", sharpness: 0, glareRatio: 0 });
    };
    img.src = dataUrl;
  });
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
