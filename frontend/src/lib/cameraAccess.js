export function isCameraApiAvailable() {
  return typeof navigator !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function isSecureCameraContext() {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function getRecommendedCameraUrl(hostname = "") {
  const host = String(hostname || (typeof window !== "undefined" ? window.location.hostname : "") || "localhost");
  return `https://${host}:3443`;
}

export function getCameraContextError() {
  if (!isCameraApiAvailable()) {
    return "Este navegador no permite acceso a la cámara.";
  }
  if (!isSecureCameraContext()) {
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : "";
    const secureUrl = getRecommendedCameraUrl(host);
    return `La cámara requiere HTTPS. Estás en http://${host}${port}. Abre ${secureUrl} y acepta el certificado.`;
  }
  return "";
}

export function getSelfSignedHttpsNotice() {
  if (!isSecureCameraContext()) return "";
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (!host || host === "localhost" || host === "127.0.0.1") return "";
  if (window.location.protocol !== "https:") return "";
  return `Si Chrome marca la IP en rojo como "No seguro", es el certificado local. La cámara puede funcionar igual; para quitar el aviso, usa ${getRecommendedCameraUrl(host)} con el certificado actualizado para tu IP.`;
}

export function isMobileLikeDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

async function waitForTrackEnded(track) {
  if (!track || track.readyState === "ended") return;
  await new Promise((resolve) => {
    track.addEventListener("ended", resolve, { once: true });
    window.setTimeout(resolve, 250);
  });
}

export async function ensureCameraPermission(options = {}) {
  const { facingMode = "environment" } = options;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
    },
  });
  const tracks = stream.getTracks();
  tracks.forEach((track) => track.stop());
  await Promise.all(tracks.map((track) => waitForTrackEnded(track)));
}

export function mapCameraStartError(error) {
  const message = String(error?.message || error || "");
  const name = String(error?.name || "");

  if (/secure|insecure|secure origins/i.test(message)) {
    const contextError = getCameraContextError();
    if (contextError && /HTTPS/i.test(contextError)) {
      return contextError;
    }
    return "La cámara requiere HTTPS. En móvil usa https://TU-IP:3443 y acepta el certificado.";
  }
  if (/gesture|transient activation|user agent|not allowed by the user agent/i.test(message)) {
    return "Toca Activar cámara para permitir el acceso. Chrome en móvil requiere un toque directo.";
  }
  if (/permission|notallowed|denied/i.test(message) || name === "NotAllowedError") {
    return "Permiso de cámara denegado. Toca Activar cámara o habilita Cámara en los permisos de Chrome.";
  }
  if (/notfound|devices not found|no camera/i.test(message) || name === "NotFoundError") {
    return "No se encontró cámara en este dispositivo.";
  }
  if (/notreadable|track|in use/i.test(message) || name === "NotReadableError") {
    return "La cámara está en uso por otra app. Ciérrala e intenta de nuevo.";
  }
  if (/overconstrained|constraint/i.test(message) || name === "OverconstrainedError") {
    return "No se pudo configurar la cámara trasera. Prueba Cambiar cámara o Reiniciar.";
  }
  if (/abort|interrupted|invalid state|could not start video stream|already under transition/i.test(message)) {
    return "La cámara se interrumpió al iniciar. Toca Activar cámara o Reiniciar cámara.";
  }
  if (message) {
    return `No se pudo iniciar la cámara: ${message}`;
  }
  return "No se pudo iniciar la cámara. Usa la entrada manual o un lector USB.";
}