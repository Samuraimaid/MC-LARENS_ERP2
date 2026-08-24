import React, { useState, useRef } from "react";
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
  Car,
  Tag,
  Palette,
  FileText,
  RotateCcw,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { isCapacitorNative } from "@/lib/env";

export default function CirculationCardOcrScannerModal({ isOpen, onClose, onApply }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [ocrResult, setOcrResult] = useState(null);
  const [editedFields, setEditedFields] = useState({
    vin: "",
    plate: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    vehicle_type: "",
    vehicle_type_slug: "sedan",
    version_level: "intermedio",
    trim: "",
  });

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleCaptureNativeCamera = async () => {
    try {
      if (isCapacitorNative()) {
        const { Camera: CapCamera, CameraResultType, CameraSource } = await import("@capacitor/camera");
        const photo = await CapCamera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          quality: 90,
          allowEditing: false,
        });

        if (photo?.dataUrl) {
          setSelectedImage(photo.dataUrl);
          processOcr(photo.dataUrl);
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      if (err?.message !== "User cancelled photos app") {
        console.warn("Camera fallback to file input", err);
        fileInputRef.current?.click();
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      setSelectedImage(dataUrl);
      processOcr(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const processOcr = async (imageDataUrl) => {
    setProcessing(true);
    setOcrResult(null);
    setProgressStatus("Iniciando motor OCR óptico...");

    try {
      // 1. Cargar Tesseract.js dinámicamente
      setProgressStatus("Analizando texto de la tarjeta de circulación...");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("spa+eng");
      
      const ret = await worker.recognize(imageDataUrl);
      const extractedText = ret.data.text || "";
      await worker.terminate();

      setProgressStatus("Decodificando VIN y consultando catálogo...");

      // 2. Enviar texto e imagen al backend para parsing inteligente de Nicaragua y decodificación vPIC
      const res = await axios.post(
        `${API}/vehicles/ocr-circulation-card`,
        {
          raw_text: extractedText,
          image_base64: imageDataUrl,
        },
        { withCredentials: true }
      );

      const data = res.data || {};
      setOcrResult(data);
      setEditedFields({
        vin: data.vin || data.vin_chasis || "",
        plate: data.plate || data.placa || "",
        brand: data.brand || data.marca || "",
        model: data.model || data.modelo || "",
        year: data.year || data.anio ? String(data.year || data.anio) : "",
        color: data.color && data.color !== "No especificado" ? data.color : "Blanco",
        vehicle_type: data.vehicle_type || "Sedán / Automóvil",
        vehicle_type_slug: data.vehicle_type_slug || data.tipo_carroceria || "sedan",
        numero_motor: data.numero_motor || "",
        tipo_combustible: data.tipo_combustible || "Gasolina",
        propietario_cedula: data.propietario_cedula || "",
        origin_country: data.origin_country || "",
        version_level: data.version_level || "intermedio",
        trim: data.trim || "",
      });

      if (data.vin || data.vin_chasis) {
        toast.success(`Chasis/VIN detectado: ${data.vin || data.vin_chasis} (${data.origin_country || "Estándar"})`);
      } else if (data.placa || data.plate) {
        toast.success(`Placa detectada: ${data.placa || data.plate}`);
      } else {
        toast.info("Texto analizado. Por favor verifica los datos detectados.");
      }
    } catch (err) {
      console.error("Error OCR", err);
      toast.error("Error procesando la imagen. Intenta con una foto más clara e iluminada.");
    } finally {
      setProcessing(false);
      setProgressStatus("");
    }
  };

  const handleApplyToVehicle = () => {
    if (!editedFields.brand && !editedFields.model && !editedFields.plate && !editedFields.vin) {
      toast.error("Ingresa al menos la placa o el modelo del vehículo.");
      return;
    }

    if (onApply) {
      onApply({
        vin: editedFields.vin.trim().toUpperCase(),
        plate: editedFields.plate.trim().toUpperCase(),
        brand: editedFields.brand.trim().toUpperCase(),
        model: editedFields.model.trim(),
        year: editedFields.year ? parseInt(editedFields.year, 10) : new Date().getFullYear(),
        color: editedFields.color.trim(),
        vehicle_type: editedFields.vehicle_type,
        vehicle_type_slug: editedFields.vehicle_type_slug,
        version_level: editedFields.version_level,
        trim: editedFields.trim,
      });
    }
    toast.success("¡Datos del vehículo aplicados correctamente!");
    onClose();
  };

  const getVersionBadge = (level) => {
    if (level === "full") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Full / Premium
        </span>
      );
    }
    if (level === "base") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
          Base / Estándar
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" /> Intermedio / Mid
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Scan className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                Escáner OCR de Tarjeta de Circulación
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                  VIN + Placa
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Extrae automáticamente Chasis, Placa, Marca, Modelo, Color y Versión
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

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Body Content */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs">
          {!selectedImage ? (
            /* Vista Inicial: Captura / Carga */
            <div className="flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 text-center space-y-4">
              <div className="relative">
                <div className="p-4 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Camera className="h-10 w-10" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="space-y-1 max-w-sm">
                <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
                  Captura la Tarjeta de Circulación
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Apunta con la cámara hacia el número de Chasis (VIN) y la Placa en un lugar iluminado.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCaptureNativeCamera}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-xs text-white shadow-lg shadow-sky-600/25 flex items-center gap-2 transition"
                >
                  <Camera className="h-4 w-4" />
                  Abrir Cámara
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-semibold text-xs text-zinc-700 dark:text-zinc-200 flex items-center gap-2 transition"
                >
                  <Upload className="h-4 w-4" />
                  Subir Foto / Archivo
                </button>
              </div>
            </div>
          ) : (
            /* Vista de Procesamiento y Resultados */
            <div className="space-y-4">
              {/* Imagen Previa y Estado */}
              <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black/5 max-h-40 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Tarjeta de Circulación"
                  className="w-full h-40 object-cover opacity-80"
                />
                {processing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-2 p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
                    <span className="text-xs font-semibold">{progressStatus}</span>
                  </div>
                )}
                {!processing && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setOcrResult(null);
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-sm transition"
                  >
                    <RotateCcw className="h-3 w-3" /> Tomar otra foto
                  </button>
                )}
              </div>

              {/* Formulario de Confirmación de Datos */}
              {!processing && (
                <div className="space-y-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40">
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-sky-500" /> Datos Extraídos
                    </span>
                    {getVersionBadge(editedFields.version_level)}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Chasis / VIN */}
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                        <Tag className="h-3 w-3 text-sky-500" /> Número de Chasis (VIN de 17 caracteres):
                      </label>
                      <input
                        type="text"
                        value={editedFields.vin}
                        onChange={(e) => setEditedFields({ ...editedFields, vin: e.target.value })}
                        placeholder="Ej. 3N1AB7AP4HY123456"
                        maxLength={17}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono uppercase text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Placa */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Matrícula / Placa:
                      </label>
                      <input
                        type="text"
                        value={editedFields.plate}
                        onChange={(e) => setEditedFields({ ...editedFields, plate: e.target.value })}
                        placeholder="Ej. M 324-912"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono uppercase text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-sky-500"
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
                        placeholder="Ej. Blanco, Gris, Negro..."
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Marca */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Marca:
                      </label>
                      <input
                        type="text"
                        value={editedFields.brand}
                        onChange={(e) => setEditedFields({ ...editedFields, brand: e.target.value })}
                        placeholder="Ej. TOYOTA"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 uppercase text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Modelo */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Modelo:
                      </label>
                      <input
                        type="text"
                        value={editedFields.model}
                        onChange={(e) => setEditedFields({ ...editedFields, model: e.target.value })}
                        placeholder="Ej. COROLLA"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Año */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Año Modelo:
                      </label>
                      <input
                        type="number"
                        value={editedFields.year}
                        onChange={(e) => setEditedFields({ ...editedFields, year: e.target.value })}
                        placeholder="Ej. 2021"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Nivel de Versión / Trim */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Nivel de Equipamiento:
                      </label>
                      <select
                        value={editedFields.version_level}
                        onChange={(e) => setEditedFields({ ...editedFields, version_level: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="base">Base / Estándar</option>
                        <option value="intermedio">Intermedio / Mid</option>
                        <option value="full">Full / Premium / Limited</option>
                      </select>
                    </div>

                    {/* Número de Motor */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        No. de Motor:
                      </label>
                      <input
                        type="text"
                        value={editedFields.numero_motor || ""}
                        onChange={(e) => setEditedFields({ ...editedFields, numero_motor: e.target.value })}
                        placeholder="Ej. 1GD1234567"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono uppercase text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Tipo de Combustible */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Combustible:
                      </label>
                      <select
                        value={editedFields.tipo_combustible || "Gasolina"}
                        onChange={(e) => setEditedFields({ ...editedFields, tipo_combustible: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
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
                        Cédula Propietario (Nicaragua):
                      </label>
                      <input
                        type="text"
                        value={editedFields.propietario_cedula || ""}
                        onChange={(e) => setEditedFields({ ...editedFields, propietario_cedula: e.target.value })}
                        placeholder="Ej. 001-140588-0042K"
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-xs text-zinc-700 dark:text-zinc-200 transition"
          >
            Cancelar
          </button>

          {selectedImage && !processing && (
            <button
              type="button"
              onClick={handleApplyToVehicle}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              Aplicar al Vehículo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
