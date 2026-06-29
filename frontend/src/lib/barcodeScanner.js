import { Html5Qrcode } from "html5-qrcode";

const NATIVE_BARCODE_FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "upc_a",
  "upc_e",
  "codabar",
  "itf",
];

export function isBarcodeDetectorSupported() {
  return typeof window !== "undefined" && typeof window.BarcodeDetector === "function";
}

export async function getSupportedBarcodeFormats() {
  if (!isBarcodeDetectorSupported()) return [];
  try {
    return await window.BarcodeDetector.getSupportedFormats();
  } catch (error) {
    return [];
  }
}

function pickNativeFormats(supportedFormats = []) {
  if (!supportedFormats.length) return NATIVE_BARCODE_FORMATS;
  const allowed = new Set(supportedFormats);
  const picked = NATIVE_BARCODE_FORMATS.filter((format) => allowed.has(format));
  return picked.length ? picked : supportedFormats.slice(0, 8);
}

async function createBarcodeDetector() {
  const supportedFormats = await getSupportedBarcodeFormats();
  const formats = pickNativeFormats(supportedFormats);
  return new window.BarcodeDetector({ formats });
}

export function formatCameraLabel(camera = {}, index = 0) {
  const label = String(camera.label || "").trim();
  if (!label) return `Cámara ${index + 1}`;
  if (/back|rear|environment|trasera|trase/i.test(label)) return "Cámara trasera";
  if (/front|user|frontal|selfie/i.test(label)) return "Cámara frontal";
  if (label.length > 42) return `${label.slice(0, 39)}...`;
  return label;
}

export function getCameraDisplayName(cameras = [], activeCameraId = "") {
  if (!cameras.length) return "Sin cámara";
  const index = cameras.findIndex((camera) => camera.id === activeCameraId);
  if (index >= 0) return formatCameraLabel(cameras[index], index);
  const rearIndex = cameras.findIndex((camera) => /back|rear|environment|trasera|trase/i.test(camera.label || ""));
  if (rearIndex >= 0) return formatCameraLabel(cameras[rearIndex], rearIndex);
  return formatCameraLabel(cameras[0], 0);
}

export function getVideoTrackFromStream(stream) {
  return stream?.getVideoTracks?.()?.[0] || null;
}

export function isTorchSupported(stream) {
  const track = getVideoTrackFromStream(stream);
  if (!track?.getCapabilities) return false;
  try {
    return Boolean(track.getCapabilities().torch);
  } catch (error) {
    return false;
  }
}

export async function setTorchEnabled(stream, enabled = false) {
  const track = getVideoTrackFromStream(stream);
  if (!track || !isTorchSupported(stream)) return false;
  await track.applyConstraints({ advanced: [{ torch: Boolean(enabled) }] });
  return true;
}

export function getStreamDeviceId(stream) {
  const track = getVideoTrackFromStream(stream);
  return track?.getSettings?.()?.deviceId || "";
}

async function decodeWithBarcodeDetector(source) {
  if (!isBarcodeDetectorSupported()) return "";
  const detector = await createBarcodeDetector();
  const results = await detector.detect(source);
  return String(results?.[0]?.rawValue || "").trim();
}

export async function decodeBarcodeFromFile(file, regionId = "") {
  if (!file) return "";

  if (isBarcodeDetectorSupported()) {
    const bitmap = await createImageBitmap(file);
    try {
      const code = await decodeWithBarcodeDetector(bitmap);
      if (code) return code;
    } finally {
      bitmap.close?.();
    }
  }

  if (!regionId) {
    throw new Error("No se pudo leer la imagen en este navegador");
  }

  const scanner = new Html5Qrcode(regionId, { verbose: false });
  try {
    return String(await scanner.scanFile(file, false) || "").trim();
  } finally {
    try {
      scanner.clear();
    } catch (error) {
      // ignore cleanup races
    }
  }
}

function buildTorchControls(stream) {
  return {
    getStream: () => stream,
    isTorchSupported: () => isTorchSupported(stream),
    setTorch: (enabled) => setTorchEnabled(stream, enabled),
    getDeviceId: () => getStreamDeviceId(stream),
  };
}

export async function startNativeCameraScanner({
  regionElement,
  onScan,
  preferredCameraId = "",
  isActive = () => true,
}) {
  if (!regionElement) {
    throw new Error("No se encontró el visor de cámara");
  }

  const detector = await createBarcodeDetector();

  const videoConstraints = preferredCameraId
    ? { deviceId: { exact: preferredCameraId } }
    : { facingMode: { ideal: "environment" } };

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: videoConstraints,
  });

  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.setAttribute("autoplay", "true");
  video.muted = true;
  video.className = "h-full w-full object-cover";

  regionElement.replaceChildren(video);
  video.srcObject = stream;
  await video.play();

  let lastCode = "";
  let lastAt = 0;
  let frameHandle = 0;
  const torch = buildTorchControls(stream);

  const scanFrame = async () => {
    if (!isActive()) return;
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        const barcodes = await detector.detect(video);
        const code = String(barcodes?.[0]?.rawValue || "").trim();
        if (code) {
          const now = Date.now();
          if (code !== lastCode || now - lastAt > 1500) {
            lastCode = code;
            lastAt = now;
            onScan(code);
          }
        }
      }
    } catch (error) {
      // ignore intermittent detect errors while camera warms up
    }
    frameHandle = window.requestAnimationFrame(scanFrame);
  };

  frameHandle = window.requestAnimationFrame(scanFrame);

  return {
    stream,
    video,
    deviceId: torch.getDeviceId() || preferredCameraId || "",
    ...torch,
    async stop() {
      window.cancelAnimationFrame(frameHandle);
      try {
        await torch.setTorch(false);
      } catch (error) {
        // ignore torch cleanup errors
      }
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      regionElement.replaceChildren();
    },
  };
}

export function getHtml5VideoStream(regionId) {
  const region = document.getElementById(regionId);
  const video = region?.querySelector?.("video");
  return video?.srcObject || null;
}