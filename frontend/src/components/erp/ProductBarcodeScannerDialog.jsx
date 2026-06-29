import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  Flashlight,
  FlashlightOff,
  ImageUp,
  ScanBarcode,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getCameraContextError,
  getSelfSignedHttpsNotice,
  isMobileLikeDevice,
  mapCameraStartError,
} from "@/lib/cameraAccess";
import {
  decodeBarcodeFromFile,
  formatCameraLabel,
  getCameraDisplayName,
  getHtml5VideoStream,
  getStreamDeviceId,
  isBarcodeDetectorSupported,
  isTorchSupported,
  setTorchEnabled,
  startNativeCameraScanner,
} from "@/lib/barcodeScanner";
import { playBarcodeScanSound } from "@/lib/uiSounds";

const SCAN_COOLDOWN_MS = 1800;
const MOBILE_CANDIDATE_DELAY_MS = 350;

const DESKTOP_CAMERA_CANDIDATES = [
  { facingMode: { ideal: "environment" } },
  { facingMode: "environment" },
  { facingMode: { ideal: "user" } },
  { facingMode: "user" },
];

function buildScanConfig() {
  const mobile = isMobileLikeDevice();
  return {
    fps: mobile ? 8 : 10,
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const width = Math.min(viewfinderWidth * 0.92, mobile ? 300 : 340);
      const height = Math.min(viewfinderHeight * 0.5, mobile ? 160 : 200);
      return {
        width: Math.max(width, 200),
        height: Math.max(height, 100),
      };
    },
    disableFlip: false,
  };
}

function shouldUseNativeScanner() {
  return isMobileLikeDevice() && isBarcodeDetectorSupported();
}

function buildCameraCandidates(devices, preferredCameraId = "") {
  if (preferredCameraId) return [preferredCameraId];

  const mobile = isMobileLikeDevice();
  if (mobile) {
    const rearCamera = devices.find((device) => /back|rear|environment|trasera|trase/i.test(device.label || ""));
    const frontCamera = devices.find((device) => /front|user|frontal|selfie/i.test(device.label || ""));
    const candidates = [];
    if (rearCamera?.id) candidates.push(rearCamera.id);
    candidates.push({ facingMode: { ideal: "environment" } }, { facingMode: "environment" });
    if (frontCamera?.id) candidates.push(frontCamera.id);
    candidates.push({ facingMode: { ideal: "user" } });
    return candidates;
  }

  const orderedCandidates = [...DESKTOP_CAMERA_CANDIDATES];
  const rearCamera = devices.find((device) => /back|rear|environment|trasera|trase/i.test(device.label || ""));
  const frontCamera = devices.find((device) => /front|user|frontal|selfie/i.test(device.label || ""));
  if (rearCamera?.id) orderedCandidates.push(rearCamera.id);
  if (frontCamera?.id) orderedCandidates.push(frontCamera.id);
  devices.forEach((device) => {
    if (device?.id) orderedCandidates.push(device.id);
  });
  return orderedCandidates;
}

async function waitForRegion(regionId) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const element = document.getElementById(regionId);
    if (element) return element;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return document.getElementById(regionId);
}

async function disposeHtml5Scanner(scanner) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
  } catch (error) {
    // ignore stop races while switching candidates
  }
  try {
    scanner.clear();
  } catch (error) {
    // ignore clear races when region is already reset
  }
}

function clearRegion(regionId) {
  const region = document.getElementById(regionId);
  if (region) region.replaceChildren();
}

function syncTorchState(regionId, nativeScanner, setTorchOn, setTorchSupported) {
  if (nativeScanner?.isTorchSupported) {
    setTorchSupported(nativeScanner.isTorchSupported());
    setTorchOn(false);
    return;
  }
  const stream = getHtml5VideoStream(regionId);
  setTorchSupported(isTorchSupported(stream));
  setTorchOn(false);
}

function ScanFrameOverlay({ pulse = false }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5 sm:p-7">
      <div
        className={cn(
          "relative h-44 w-full max-w-[92%] transition-transform duration-300 sm:h-52",
          pulse && "scale-[1.03]"
        )}
      >
        <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-lg border-l-[3px] border-t-[3px] border-white/90" />
        <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-lg border-r-[3px] border-t-[3px] border-white/90" />
        <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-lg border-b-[3px] border-l-[3px] border-white/90" />
        <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-lg border-b-[3px] border-r-[3px] border-white/90" />
        <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-emerald-300/90 to-transparent" />
      </div>
      {pulse ? (
        <div className="absolute inset-6 rounded-2xl border-2 border-emerald-400/80 bg-emerald-400/10 animate-pulse" />
      ) : null}
    </div>
  );
}

function LensControlButton({ active = false, disabled = false, label, onClick, children }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-11 w-11 rounded-full border-0 text-white shadow-lg backdrop-blur-sm",
        active ? "bg-emerald-500/85 hover:bg-emerald-500" : "bg-black/50 hover:bg-black/70"
      )}
    >
      {children}
    </Button>
  );
}

export default function ProductBarcodeScannerDialog({
  open = false,
  onOpenChange,
  onScan,
  title = "Escanear producto",
  description = "Apunta la cámara al código de barras o QR del producto.",
}) {
  const regionId = useId().replace(/:/g, "");
  const galleryInputRef = useRef(null);
  const scannerRef = useRef(null);
  const nativeScannerRef = useRef(null);
  const bootTokenRef = useRef(0);
  const scannerOpRef = useRef(Promise.resolve());
  const lastScanRef = useRef({ code: "", at: 0 });
  const [cameraError, setCameraError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isGalleryScanning, setIsGalleryScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [cameras, setCameras] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [needsUserActivation, setNeedsUserActivation] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanPulse, setScanPulse] = useState(false);
  const httpsNotice = getSelfSignedHttpsNotice();
  const activeCameraName = getCameraDisplayName(cameras, activeCameraId);
  const selectableCameras = cameras.filter((camera) => camera?.id);

  const withScannerLock = useCallback((operation) => {
    const run = scannerOpRef.current
      .catch(() => {})
      .then(() => operation());
    scannerOpRef.current = run.catch(() => {});
    return run;
  }, []);

  const stopScanner = useCallback(async () => {
    const nativeScanner = nativeScannerRef.current;
    nativeScannerRef.current = null;

    const html5Scanner = scannerRef.current;
    scannerRef.current = null;

    setCameraReady(false);
    setTorchOn(false);
    setTorchSupported(false);

    if (nativeScanner) {
      try {
        await nativeScanner.stop();
      } catch (error) {
        // ignore native cleanup races
      }
    }

    await disposeHtml5Scanner(html5Scanner);
    clearRegion(regionId);
  }, [regionId]);

  const triggerScanFeedback = useCallback(() => {
    playBarcodeScanSound();
    setScanPulse(true);
    window.setTimeout(() => setScanPulse(false), 550);
  }, []);

  const emitScan = useCallback((rawCode) => {
    const code = String(rawCode || "").trim();
    if (!code || typeof onScan !== "function") return;

    const now = Date.now();
    if (lastScanRef.current.code === code && now - lastScanRef.current.at < SCAN_COOLDOWN_MS) {
      return;
    }
    lastScanRef.current = { code, at: now };
    triggerScanFeedback();
    onScan(code);
  }, [onScan, triggerScanFeedback]);

  const startNativeScanner = useCallback(async (bootToken, preferredCameraId = "") => {
    const region = await waitForRegion(regionId);
    if (!region || bootTokenRef.current !== bootToken) return;

    const devices = await navigator.mediaDevices.enumerateDevices()
      .then((entries) => entries.filter((entry) => entry.kind === "videoinput"))
      .catch(() => []);
    if (bootTokenRef.current !== bootToken) return;

    setCameras(devices.map((device) => ({ id: device.deviceId, label: device.label })));

    const nativeScanner = await startNativeCameraScanner({
      regionElement: region,
      onScan: emitScan,
      preferredCameraId,
      isActive: () => bootTokenRef.current === bootToken && Boolean(nativeScannerRef.current),
    });

    if (bootTokenRef.current !== bootToken) {
      await nativeScanner.stop();
      return;
    }

    nativeScannerRef.current = nativeScanner;
    setActiveCameraId(nativeScanner.deviceId || preferredCameraId || "");
    setCameraReady(true);
    syncTorchState(regionId, nativeScanner, setTorchOn, setTorchSupported);
  }, [emitScan, regionId]);

  const startHtml5Scanner = useCallback(async (bootToken, preferredCameraId = "") => {
    const region = await waitForRegion(regionId);
    if (!region || bootTokenRef.current !== bootToken) return;

    const devices = await Html5Qrcode.getCameras().catch(() => []);
    if (bootTokenRef.current !== bootToken) return;
    setCameras(devices);

    const scanConfig = buildScanConfig();
    const orderedCandidates = buildCameraCandidates(devices, preferredCameraId);
    const mobile = isMobileLikeDevice();

    let lastError = null;
    const seen = new Set();
    for (const candidate of orderedCandidates) {
      const key = typeof candidate === "string" ? candidate : JSON.stringify(candidate);
      if (seen.has(key)) continue;
      seen.add(key);

      if (bootTokenRef.current !== bootToken) return;

      clearRegion(regionId);
      const scanner = new Html5Qrcode(regionId, { verbose: false });
      try {
        await scanner.start(
          candidate,
          scanConfig,
          (decodedText) => emitScan(decodedText),
          () => {}
        );
        scannerRef.current = scanner;
        const stream = getHtml5VideoStream(regionId);
        const resolvedId = getStreamDeviceId(stream) || (typeof candidate === "string" ? candidate : "");
        setActiveCameraId(resolvedId);
        setCameraReady(true);
        syncTorchState(regionId, null, setTorchOn, setTorchSupported);
        return;
      } catch (error) {
        lastError = error;
        await disposeHtml5Scanner(scanner);
        if (mobile) {
          await new Promise((resolve) => window.setTimeout(resolve, MOBILE_CANDIDATE_DELAY_MS));
        }
      }
    }

    throw lastError || new Error("No se pudo abrir ninguna cámara");
  }, [emitScan, regionId]);

  const startScanner = useCallback(async (preferredCameraId = "") => {
    const bootToken = bootTokenRef.current + 1;
    bootTokenRef.current = bootToken;

    await stopScanner();
    setCameraError("");
    setIsStarting(true);
    setCameraReady(false);
    setNeedsUserActivation(false);

    const contextError = getCameraContextError();
    if (contextError) {
      setCameraError(contextError);
      setNeedsUserActivation(true);
      setIsStarting(false);
      return;
    }

    try {
      if (shouldUseNativeScanner()) {
        await startNativeScanner(bootToken, preferredCameraId);
        return;
      }
      await startHtml5Scanner(bootToken, preferredCameraId);
    } catch (error) {
      if (bootTokenRef.current !== bootToken) return;
      const mapped = mapCameraStartError(error);
      setNeedsUserActivation(true);
      setCameraError(mapped);
    } finally {
      if (bootTokenRef.current === bootToken) {
        setIsStarting(false);
      }
    }
  }, [startHtml5Scanner, startNativeScanner, stopScanner]);

  const runStartScanner = useCallback((preferredCameraId = "") => {
    return withScannerLock(() => startScanner(preferredCameraId));
  }, [startScanner, withScannerLock]);

  const runStopScanner = useCallback(() => {
    return withScannerLock(() => stopScanner());
  }, [stopScanner, withScannerLock]);

  useEffect(() => {
    if (!open) {
      bootTokenRef.current += 1;
      void runStopScanner();
      setManualCode("");
      setCameraError("");
      setCameras([]);
      setActiveCameraId("");
      setNeedsUserActivation(false);
      setScanPulse(false);
      return undefined;
    }

    const contextError = getCameraContextError();
    if (contextError) {
      setCameraError(contextError);
      setNeedsUserActivation(true);
      return undefined;
    }

    if (isMobileLikeDevice()) {
      setNeedsUserActivation(true);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      void runStartScanner("");
    }, 300);

    return () => {
      window.clearTimeout(timerId);
      bootTokenRef.current += 1;
      void runStopScanner();
    };
  }, [open, runStartScanner, runStopScanner]);

  const handleActivateCamera = async () => {
    await runStartScanner(activeCameraId);
  };

  const handleCameraSelect = async (cameraId) => {
    if (!cameraId || cameraId === activeCameraId) return;
    setTorchOn(false);
    await runStartScanner(cameraId);
  };

  const handleTorchToggle = async () => {
    const nativeScanner = nativeScannerRef.current;
    const next = !torchOn;

    try {
      if (nativeScanner?.setTorch) {
        const ok = await nativeScanner.setTorch(next);
        if (ok) setTorchOn(next);
        return;
      }

      const stream = getHtml5VideoStream(regionId);
      const ok = await setTorchEnabled(stream, next);
      if (ok) setTorchOn(next);
      else toast.message("Este dispositivo no permite usar el flash como linterna");
    } catch (error) {
      toast.error("No se pudo cambiar la linterna");
    }
  };

  const handleGalleryPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsGalleryScanning(true);
    try {
      const code = await decodeBarcodeFromFile(file, regionId);
      if (code) {
        emitScan(code);
        return;
      }
      toast.warning("No se encontró un código en esa imagen");
    } catch (error) {
      toast.error("No se pudo leer la imagen seleccionada");
    } finally {
      setIsGalleryScanning(false);
    }
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) {
      toast.error("Ingresa un código para buscar");
      return;
    }
    emitScan(code);
    setManualCode("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4 overflow-hidden p-0 sm:max-w-xl">
        <div className="space-y-4 px-4 pb-4 pt-5 sm:px-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="inline-flex items-center gap-2">
              <ScanBarcode className="h-5 w-5" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {(needsUserActivation && !cameraReady) ? (
            <Button
              type="button"
              className="w-full"
              onClick={handleActivateCamera}
              disabled={isStarting}
            >
              <Camera className="mr-2 h-4 w-4" />
              Activar cámara
            </Button>
          ) : null}

          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-inner",
              (isStarting || isGalleryScanning) && "animate-pulse"
            )}
          >
            <div
              id={regionId}
              className="min-h-[320px] w-full bg-black [&_img]:hidden [&_video]:h-full [&_video]:min-h-[320px] [&_video]:w-full [&_video]:object-cover"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/65" />

            {cameraReady ? <ScanFrameOverlay pulse={scanPulse} /> : null}

            <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
              <LensControlButton
                label="Escanear imagen de galería"
                disabled={isGalleryScanning}
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageUp className="h-5 w-5" />
              </LensControlButton>

              {cameraReady && torchSupported ? (
                <LensControlButton
                  label={torchOn ? "Apagar linterna" : "Encender linterna"}
                  active={torchOn}
                  onClick={handleTorchToggle}
                >
                  {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                </LensControlButton>
              ) : (
                <div className="h-11 w-11" />
              )}
            </div>

            <div className="absolute inset-x-3 bottom-3 flex flex-col items-center gap-2">
              {cameraReady ? (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] text-white backdrop-blur-sm">
                  <ScanLine className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span className="truncate">Centra el código dentro del recuadro</span>
                </div>
              ) : null}

              {selectableCameras.length > 1 ? (
                <Select
                  value={activeCameraId || selectableCameras[0]?.id}
                  onValueChange={handleCameraSelect}
                  disabled={isStarting}
                >
                  <SelectTrigger className="h-9 w-full max-w-sm rounded-full border-white/20 bg-black/55 text-xs text-white backdrop-blur-sm focus:ring-emerald-400/40">
                    <SelectValue placeholder="Seleccionar cámara" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableCameras.map((camera, index) => (
                      <SelectItem key={camera.id} value={camera.id}>
                        {formatCameraLabel(camera, index)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : cameraReady ? (
                <div className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] text-white/90 backdrop-blur-sm">
                  {activeCameraName}
                </div>
              ) : null}
            </div>
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleGalleryPick}
          />

          {cameraError && !cameraReady ? (
            <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="inline-flex items-start gap-2">
                <Camera className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </p>
            </div>
          ) : null}

          {!cameraError && cameraReady && httpsNotice ? (
            <div className="rounded-lg border border-sky-200/80 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
              {httpsNotice}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => galleryInputRef.current?.click()}
              disabled={isGalleryScanning}
            >
              <ImageUp className="mr-2 h-4 w-4" />
              Galería
            </Button>
            {cameraReady && torchSupported ? (
              <Button type="button" variant="outline" size="sm" onClick={handleTorchToggle}>
                {torchOn ? <FlashlightOff className="mr-2 h-4 w-4" /> : <Flashlight className="mr-2 h-4 w-4" />}
                {torchOn ? "Apagar linterna" : "Linterna"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleActivateCamera}
              disabled={isStarting}
            >
              Reiniciar cámara
            </Button>
          </div>

          <form className="space-y-2 rounded-lg border bg-muted/20 p-3" onSubmit={handleManualSubmit}>
            <Label htmlFor="manual-barcode-code" className="text-xs text-muted-foreground">
              Entrada manual (SKU, EAN o QR)
            </Label>
            <div className="flex gap-2">
              <Input
                id="manual-barcode-code"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Escribe o pega el código"
                autoComplete="off"
              />
              <Button type="submit" variant="secondary">Buscar</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}