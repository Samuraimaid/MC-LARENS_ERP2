import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Upload,
  Scan,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  ShieldCheck,
  Palette,
  FileText,
  RotateCcw,
  Zap,
  Check,
  AlertTriangle,
  Info,
  Plus,
  ArrowRight,
  Layers,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import {
  startCamera,
  stopCamera,
  grabJpeg,
  createAutoLock,
} from "@/lib/liveDocumentScan";

export default function CirculationCardOcrScannerModal({ isOpen, onClose, onApply }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scanStatus, setScanStatus] = useState("searching"); // searching, closer, glare, hold, capturing, manual
  const [scanSide, setScanSide] = useState("front"); // "front" | "back"
  
  const [capturedFrontImage, setCapturedFrontImage] = useState(null);
  const [capturedBackImage, setCapturedBackImage] = useState(null);
  const [scanningBackMode, setScanningBackMode] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [ocrResult, setOcrResult] = useState(null);
  const [needsReviewFields, setNeedsReviewFields] = useState([]);
  const [confidenceScores, setConfidenceScores] = useState({});
  const [yearSource, setYearSource] = useState("no_detectado");

  const [editedFields, setEditedFields] = useState({
    vin: "",
    plate: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    vehicle_type: "Sedán / Automóvil",
    vehicle_type_slug: "sedan",
    version_level: "intermedio",
    trim: "",
    numero_motor: "",
    tipo_combustible: "Gasolina",
    propietario_cedula: "",
    origin_country: "",
  });

  const videoRef = useRef(null);
  const guideRef = useRef(null);
  const streamRef = useRef(null);
  const autoLockRef = useRef(null);
  const frontFileInputRef = useRef(null);
  const backFileInputRef = useRef(null);

  // Iniciar / Detener cámara según estado del modal
  const stopLiveCamera = useCallback(() => {
    if (autoLockRef.current) {
      autoLockRef.current.stop();
      autoLockRef.current = null;
    }
    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startLiveCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraError(null);
    setScanStatus("searching");

    try {
      stopLiveCamera();
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      setCameraActive(true);

      // Iniciar detector y motor de Auto-Lock inteligente
      autoLockRef.current = createAutoLock({
        videoEl: videoRef.current,
        getGuideRect: () => {
          if (!guideRef.current || !videoRef.current) return null;
          const rect = guideRef.current.getBoundingClientRect();
          const videoRect = videoRef.current.getBoundingClientRect();
          return {
            x: Math.max(0, rect.left - videoRect.left),
            y: Math.max(0, rect.top - videoRect.top),
            width: rect.width,
            height: rect.height,
          };
        },
        onStatus: (status) => {
          setScanStatus(status);
        },
        onCapture: (jpegDataUrl) => {
          // Feedback háptico en móvil
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([40, 60, 40]);
            } catch (_) {}
          }
          stopLiveCamera();
          if (scanSide === "back" || scanningBackMode) {
            setCapturedBackImage(jpegDataUrl);
            setScanningBackMode(false);
            processOcrV2(capturedFrontImage, jpegDataUrl);
          } else {
            setCapturedFrontImage(jpegDataUrl);
            processOcrV2(jpegDataUrl, capturedBackImage);
          }
        },
        intervalMs: 200,
      });
    } catch (err) {
      console.warn("[OCR Live Camera] No se pudo iniciar la cámara en vivo:", err);
      setCameraError("No se pudo acceder a la cámara. Puedes subir una foto directamente.");
      setCameraActive(false);
    }
  }, [stopLiveCamera, scanSide, scanningBackMode, capturedFrontImage, capturedBackImage]);

  useEffect(() => {
    const isCameraNeeded = isOpen && (!capturedFrontImage || scanningBackMode);
    if (isCameraNeeded) {
      const timer = setTimeout(() => {
        startLiveCamera();
      }, 120);
      return () => {
        clearTimeout(timer);
        stopLiveCamera();
      };
    } else {
      stopLiveCamera();
    }
  }, [isOpen, capturedFrontImage, scanningBackMode, startLiveCamera, stopLiveCamera]);

  if (!isOpen) return null;

  // Procesamiento Vision OCR v2 en Backend (Frente + Reverso opcional)
  const processOcrV2 = async (frontImg, backImg) => {
    if (!frontImg && !backImg) return;
    setProcessing(true);
    setProgressStatus(
      backImg
        ? "Analizando Frente y Reverso (Confirmando Año de Fabricación)..."
        : "Analizando Frente de Tarjeta de Circulación..."
    );

    try {
      const res = await axios.post(
        `${API}/vehicles/ocr-circulation-card-v2`,
        {
          image_base64: frontImg,
          image_back_base64: backImg,
        },
        { withCredentials: true }
      );

      const data = res.data || {};
      setOcrResult(data);

      const confidence = data.confidence || {};
      const needsReview = Array.isArray(data.needs_review) ? data.needs_review : [];
      setConfidenceScores(confidence);
      setNeedsReviewFields(needsReview);
      setYearSource(data.year_source || (backImg ? "reverso_tarjeta" : "inferido_vin"));

      const detectedVin = data.vin || data.vin_chasis || "";
      const detectedPlate = data.plate || data.placa || "";
      const detectedBrand = data.brand || data.marca || "";
      const detectedModel = data.model || data.modelo || "";
      const detectedYear = data.year || data.anio ? String(data.year || data.anio) : "";
      const detectedColor = data.color && data.color !== "No especificado" ? data.color : "Blanco";
      const detectedType = data.vehicle_type || "Sedán / Automóvil";
      const detectedTypeSlug = data.vehicle_type_slug || data.tipo_carroceria || "sedan";

      setEditedFields({
        vin: detectedVin,
        plate: detectedPlate,
        brand: detectedBrand,
        model: detectedModel,
        year: detectedYear,
        color: detectedColor,
        vehicle_type: detectedType,
        vehicle_type_slug: detectedTypeSlug,
        version_level: data.version_level || "intermedio",
        trim: data.trim || "",
        numero_motor: data.numero_motor || "",
        tipo_combustible: data.tipo_combustible || "Gasolina",
        propietario_cedula: data.propietario_cedula || "",
        origin_country: data.origin_country || "",
      });

      if (detectedVin) {
        toast.success(`Chasis/VIN: ${detectedVin} (${data.origin_country || "Estándar"})`);
      } else if (detectedPlate) {
        toast.success(`Placa detectada: ${detectedPlate}`);
      } else {
        toast.info("Lectura completada. Verifica los datos extraídos.");
      }
    } catch (err) {
      console.error("Error OCR v2:", err);
      toast.error("No se pudo leer la tarjeta con suficiente claridad. Intenta con mejor iluminación o sube un archivo.");
    } finally {
      setProcessing(false);
      setProgressStatus("");
    }
  };

  // Captura manual
  const handleManualCapture = () => {
    if (!videoRef.current) return;
    const jpeg = grabJpeg(videoRef.current, 1600, 0.75);
    if (jpeg) {
      stopLiveCamera();
      if (scanningBackMode || scanSide === "back") {
        setCapturedBackImage(jpeg);
        setScanningBackMode(false);
        processOcrV2(capturedFrontImage, jpeg);
      } else {
        setCapturedFrontImage(jpeg);
        processOcrV2(jpeg, capturedBackImage);
      }
    }
  };

  // Subir archivo Frontal
  const handleFrontFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      stopLiveCamera();
      setCapturedFrontImage(dataUrl);
      processOcrV2(dataUrl, capturedBackImage);
    };
    reader.readAsDataURL(file);
  };

  // Subir archivo Reverso (Opcional)
  const handleBackFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      stopLiveCamera();
      setCapturedBackImage(dataUrl);
      setScanningBackMode(false);
      processOcrV2(capturedFrontImage, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleStartScanBack = () => {
    setScanSide("back");
    setScanningBackMode(true);
  };

  const handleResetScan = () => {
    setCapturedFrontImage(null);
    setCapturedBackImage(null);
    setScanningBackMode(false);
    setScanSide("front");
    setOcrResult(null);
    setNeedsReviewFields([]);
    setConfidenceScores({});
    setYearSource("no_detectado");
    setEditedFields({
      vin: "",
      plate: "",
      brand: "",
      model: "",
      year: "",
      color: "",
      vehicle_type: "Sedán / Automóvil",
      vehicle_type_slug: "sedan",
      version_level: "intermedio",
      trim: "",
      numero_motor: "",
      tipo_combustible: "Gasolina",
      propietario_cedula: "",
      origin_country: "",
    });
  };

  // Aplicar datos al formulario padre
  const handleApplyToVehicle = () => {
    if (!editedFields.brand && !editedFields.model && !editedFields.plate && !editedFields.vin) {
      toast.error("Ingresa al menos la placa, chasis o el modelo del vehículo.");
      return;
    }

    if (onApply) {
      onApply({
        vin: editedFields.vin.trim().toUpperCase(),
        plate: editedFields.plate.trim().toUpperCase(),
        brand: editedFields.brand.trim().toUpperCase(),
        model: editedFields.model.trim(),
        year: editedFields.year ? parseInt(editedFields.year, 10) : new Date().getFullYear(),
        color: editedFields.color.trim() || "Blanco",
        vehicle_type: editedFields.vehicle_type,
        vehicle_type_slug: editedFields.vehicle_type_slug,
        version_level: editedFields.version_level,
        trim: editedFields.trim,
        numero_motor: editedFields.numero_motor.trim(),
        tipo_combustible: editedFields.tipo_combustible,
        propietario_cedula: editedFields.propietario_cedula.trim(),
      });
    }
    toast.success("¡Datos del vehículo aplicados correctamente!");
    onClose();
  };

  const isFieldInReview = (fieldKey) => {
    return needsReviewFields.includes(fieldKey) || (confidenceScores[fieldKey] !== undefined && confidenceScores[fieldKey] < 0.85);
  };

  const getStatusBadge = () => {
    switch (scanStatus) {
      case "hold":
        return {
          text: "Excelente, no te muevas...",
          color: "bg-emerald-500/90 text-white border-emerald-400",
          icon: <Check className="h-3.5 w-3.5 animate-pulse" />,
        };
      case "closer":
        return {
          text: "Acerca un poco más la tarjeta",
          color: "bg-amber-500/90 text-white border-amber-400",
          icon: <Info className="h-3.5 w-3.5" />,
        };
      case "glare":
        return {
          text: "Inclina para quitar el reflejo de luz",
          color: "bg-orange-500/90 text-white border-orange-400",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
        };
      case "capturing":
        return {
          text: "Capturando y analizando...",
          color: "bg-sky-500/90 text-white border-sky-400",
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        };
      case "manual":
        return {
          text: "Toca para capturar o sube un archivo",
          color: "bg-zinc-700/90 text-white border-zinc-500",
          icon: <Camera className="h-3.5 w-3.5" />,
        };
      default:
        return {
          text: (scanSide === "back" || scanningBackMode)
            ? "Enfoca el Reverso (Año de Fabricación)"
            : "Enfoca el Frente de la Tarjeta",
          color: "bg-zinc-900/80 text-zinc-100 border-zinc-600",
          icon: <Scan className="h-3.5 w-3.5 text-sky-400" />,
        };
    }
  };

  const statusInfo = getStatusBadge();
  const showCameraView = !capturedFrontImage || scanningBackMode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Scan className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                Escáner de Circulación Vehicular
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                  Nicaragua v2
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Frente (Placa, Chasis, Motor, Color) + Reverso Opcional (Año de Fabricación)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Inputs ocultos para subir archivos */}
        <input
          ref={frontFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFrontFileChange}
          className="hidden"
        />
        <input
          ref={backFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleBackFileChange}
          className="hidden"
        />

        {/* Contenido Principal */}
        <div className="p-4 space-y-3.5 overflow-y-auto text-xs">
          {showCameraView ? (
            /* Vista 1: Visor de Cámara en Vivo con Auto-Lock */
            <div className="space-y-3">
              {/* Indicador de cara a escanear */}
              <div className="flex items-center justify-between px-1">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 text-xs flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-sky-500" />
                  {scanningBackMode
                    ? "Paso 2: Escaneando Reverso (Opcional - Año de Fabricación)"
                    : "Paso 1: Escaneando Frente (Placa, Chasis, Motor, Color)"}
                </span>
                {scanningBackMode && (
                  <button
                    type="button"
                    onClick={() => setScanningBackMode(false)}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
                  >
                    Volver a datos
                  </button>
                )}
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center border border-zinc-800 shadow-inner">
                {/* Elemento de Video */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />

                {/* Recuadro Guía (Aspecto Tarjeta ~1.58) */}
                <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                  <div
                    ref={guideRef}
                    className={`w-[86%] sm:w-[80%] aspect-[1.58/1] rounded-2xl border-2 transition-all duration-300 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ${
                      scanStatus === "hold"
                        ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5),0_0_0_9999px_rgba(0,0,0,0.55)]"
                        : scanStatus === "closer" || scanStatus === "glare"
                        ? "border-amber-400"
                        : "border-sky-400/80"
                    }`}
                  >
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white rounded-br-lg" />
                  </div>
                </div>

                {/* Chip de Estado Dinámico */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border shadow-lg flex items-center gap-1.5 transition-all duration-200 ${statusInfo.color}`}
                  >
                    {statusInfo.icon}
                    <span>{statusInfo.text}</span>
                  </div>
                </div>

                {/* Mensaje de Error de Cámara si aplica */}
                {cameraError && (
                  <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                    <AlertCircle className="h-8 w-8 text-amber-400" />
                    <p className="text-xs text-zinc-300 max-w-xs">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() =>
                        scanningBackMode
                          ? backFileInputRef.current?.click()
                          : frontFileInputRef.current?.click()
                      }
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-xs text-white shadow-lg flex items-center gap-2 transition"
                    >
                      <Upload className="h-4 w-4" /> Subir Foto
                    </button>
                  </div>
                )}
              </div>

              {/* Botones de Control Inferiores */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    scanningBackMode
                      ? backFileInputRef.current?.click()
                      : frontFileInputRef.current?.click()
                  }
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-semibold text-xs text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 transition"
                >
                  <Upload className="h-3.5 w-3.5" /> Subir archivo
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualCapture}
                    disabled={!cameraActive}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 font-bold text-xs text-white shadow-md shadow-sky-600/20 flex items-center gap-1.5 transition"
                  >
                    <Camera className="h-3.5 w-3.5" /> Captura manual
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Vista 2: Procesamiento y Formulario de Confirmación */
            <div className="space-y-3.5">
              {/* Miniaturas de las Caras (Frente + Reverso) */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Miniatura Frente */}
                <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black/5 h-24 flex items-center justify-center">
                  {capturedFrontImage ? (
                    <img
                      src={capturedFrontImage}
                      alt="Frente Tarjeta"
                      className="w-full h-full object-cover opacity-90"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-400">Sin foto de frente</span>
                  )}
                  <span className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                    Frente (Datos)
                  </span>
                </div>

                {/* Miniatura Reverso (Opcional) */}
                <div className="relative rounded-xl overflow-hidden border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 h-24 flex flex-col items-center justify-center p-2 text-center">
                  {capturedBackImage ? (
                    <>
                      <img
                        src={capturedBackImage}
                        alt="Reverso Tarjeta"
                        className="w-full h-full object-cover opacity-90"
                      />
                      <span className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-emerald-700/80 text-white text-[9px] font-bold flex items-center gap-1">
                        <Check className="h-2.5 w-2.5" /> Reverso (Año)
                      </span>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                        Foto Reverso (Opcional)
                      </p>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleStartScanBack}
                          className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-bold flex items-center gap-1 transition"
                        >
                          <Camera className="h-2.5 w-2.5" /> Cámara
                        </button>
                        <button
                          type="button"
                          onClick={() => backFileInputRef.current?.click()}
                          className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[9px] font-bold flex items-center gap-1 transition"
                        >
                          <Upload className="h-2.5 w-2.5" /> Subir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Botón para reiniciar fotos */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Info className="h-3 w-3 text-sky-500" />
                  La fecha de "Emisión" del frente no es el año del auto.
                </span>
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold flex items-center gap-1 transition"
                >
                  <RotateCcw className="h-2.5 w-2.5" /> Escanear otra tarjeta
                </button>
              </div>

              {processing && (
                <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{progressStatus}</span>
                </div>
              )}

              {/* Formulario Editable con Verificación de Confianza */}
              {!processing && (
                <div className="space-y-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
                  {/* Banner de Traspaso si el vehículo ya existía en base de datos */}
                  {ocrResult?.existing_vehicle && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Vehículo previamente registrado</p>
                        <p className="text-[11px] opacity-90">
                          Este vehículo (Placa: {ocrResult.existing_vehicle.plate || "N/A"} · Chasis: {ocrResult.existing_vehicle.vin || "N/A"}) pertenecía a <strong>{ocrResult.existing_vehicle.customer_name}</strong>. Al aplicar, se registrará el traspaso a este cliente conservando el histórico anterior.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-sky-500" /> Datos Extraídos de la Circulación
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Revisa los campos en ámbar antes de aplicar
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Chasis / VIN */}
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">Chasis / VIN (17 caracteres):</span>
                        {isFieldInReview("vin") && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> Revisar
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={editedFields.vin}
                        onChange={(e) => setEditedFields({ ...editedFields, vin: e.target.value })}
                        placeholder="Ej. 3N1AB7AP4HY123456"
                        maxLength={17}
                        className={`w-full px-3 py-1.5 rounded-lg border font-mono uppercase text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-sky-500 transition ${
                          isFieldInReview("vin")
                            ? "border-amber-400 bg-amber-50/20 dark:bg-amber-950/10"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      />
                    </div>

                    {/* Placa */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                        <span>Placa (Nicaragua):</span>
                        {isFieldInReview("plate") && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> Revisar
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={editedFields.plate}
                        onChange={(e) => setEditedFields({ ...editedFields, plate: e.target.value })}
                        placeholder="Ej. M 324-912"
                        className={`w-full px-3 py-1.5 rounded-lg border font-mono uppercase text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-sky-500 transition ${
                          isFieldInReview("plate")
                            ? "border-amber-400 bg-amber-50/20 dark:bg-amber-950/10"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      />
                    </div>

                    {/* Marca */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                        <span>Marca:</span>
                        {isFieldInReview("brand") && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={editedFields.brand}
                        onChange={(e) => setEditedFields({ ...editedFields, brand: e.target.value })}
                        placeholder="Ej. TOYOTA"
                        className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-sky-500 transition ${
                          isFieldInReview("brand")
                            ? "border-amber-400 bg-amber-50/20"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      />
                    </div>

                    {/* Modelo */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                        <span>Modelo:</span>
                        {isFieldInReview("model") && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={editedFields.model}
                        onChange={(e) => setEditedFields({ ...editedFields, model: e.target.value })}
                        placeholder="Ej. Hilux"
                        className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-sky-500 transition ${
                          isFieldInReview("model")
                            ? "border-amber-400 bg-amber-50/20"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      />
                    </div>

                    {/* Año de Fabricación con origen */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                        <span>Año de Fabricación:</span>
                        {yearSource === "reverso_tarjeta" ? (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            <Check className="h-3 w-3" /> Reverso ✓
                          </span>
                        ) : yearSource === "inferido_vin" ? (
                          <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-0.5" title="Decodificado del 10mo dígito del VIN">
                            <Info className="h-3 w-3" /> Del VIN
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> Revisa
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        value={editedFields.year}
                        onChange={(e) => setEditedFields({ ...editedFields, year: e.target.value })}
                        placeholder="Ej. 2017"
                        className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-sky-500 transition ${
                          yearSource === "reverso_tarjeta"
                            ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10"
                            : isFieldInReview("year")
                            ? "border-amber-400 bg-amber-50/20"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      />
                    </div>

                    {/* Color */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                        <Palette className="h-3 w-3 text-purple-500" /> Color:
                      </label>
                      <input
                        type="text"
                        value={editedFields.color}
                        onChange={(e) => setEditedFields({ ...editedFields, color: e.target.value })}
                        placeholder="Ej. Blanco"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Tipo de Carrocería */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Tipo de Carrocería:
                      </label>
                      <select
                        value={editedFields.vehicle_type_slug}
                        onChange={(e) => {
                          const slug = e.target.value;
                          const labels = {
                            sedan: "Sedán / Automóvil",
                            hatchback: "Hatchback",
                            pickup: "Camioneta / Pickup",
                            suv: "SUV / Camioneta Cerrada",
                            van: "Microbús / Van",
                            truck: "Camión / Cabezal",
                            moto: "Motocicleta",
                          };
                          setEditedFields({
                            ...editedFields,
                            vehicle_type_slug: slug,
                            vehicle_type: labels[slug] || "Sedán / Automóvil",
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="sedan">Sedán / Automóvil</option>
                        <option value="hatchback">Hatchback</option>
                        <option value="pickup">Camioneta / Pickup</option>
                        <option value="suv">SUV / Camioneta Cerrada</option>
                        <option value="van">Microbús / Van</option>
                        <option value="truck">Camión / Cabezal</option>
                        <option value="moto">Motocicleta</option>
                      </select>
                    </div>

                    {/* Número de Motor */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Número de Motor:
                      </label>
                      <input
                        type="text"
                        value={editedFields.numero_motor}
                        onChange={(e) => setEditedFields({ ...editedFields, numero_motor: e.target.value })}
                        placeholder="Ej. 1GD-FTV"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono uppercase text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Combustible */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Combustible:
                      </label>
                      <select
                        value={editedFields.tipo_combustible}
                        onChange={(e) => setEditedFields({ ...editedFields, tipo_combustible: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="Gasolina">Gasolina</option>
                        <option value="Diésel">Diésel</option>
                        <option value="Híbrido">Híbrido</option>
                        <option value="Eléctrico">Eléctrico</option>
                      </select>
                    </div>

                    {/* Cédula del Propietario */}
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Cédula de Identidad (Propietario):
                      </label>
                      <input
                        type="text"
                        value={editedFields.propietario_cedula}
                        onChange={(e) => setEditedFields({ ...editedFields, propietario_cedula: e.target.value })}
                        placeholder="001-010180-0000A"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono uppercase text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con Botón de Confirmación */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-semibold text-xs text-zinc-700 dark:text-zinc-300 transition"
          >
            Cancelar
          </button>

          {capturedFrontImage && !processing && !scanningBackMode && (
            <button
              type="button"
              onClick={handleApplyToVehicle}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 transition active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" /> Aplicar al Vehículo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
