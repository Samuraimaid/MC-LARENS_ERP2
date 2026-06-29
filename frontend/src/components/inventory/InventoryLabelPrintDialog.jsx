import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Barcode, CheckCircle2, Download, Eye, Printer, Ruler, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  downloadBlob,
  fetchLabelConfig,
  fetchLabelPrinterStatus,
  openBlobInNewTab,
  previewInventoryLabels,
  printInventoryLabels,
} from "@/lib/inventoryLabels";

const DEFAULT_CONFIG = {
  templates: [],
  printers: [],
  default_printer_id: "xprinter_xp460b",
  default_template_id: "col_50x100",
  printer_status: null,
};

export default function InventoryLabelPrintDialog({
  open = false,
  onOpenChange,
  product = null,
  warehouseId = "",
  warehouses = [],
  initialQuantity = 1,
  canPrint = false,
  canPreview = false,
}) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [templateId, setTemplateId] = useState(DEFAULT_CONFIG.default_template_id);
  const [printerId, setPrinterId] = useState(DEFAULT_CONFIG.default_printer_id);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [showPrice, setShowPrice] = useState(true);
  const [customWidthMm, setCustomWidthMm] = useState("");
  const [customHeightMm, setCustomHeightMm] = useState("");
  const [shape, setShape] = useState("rect");
  const [printerStatus, setPrinterStatus] = useState(null);
  const [checkingPrinter, setCheckingPrinter] = useState(false);

  const selectedTemplate = useMemo(
    () => config.templates.find((entry) => entry.id === templateId) || config.templates[0],
    [config.templates, templateId]
  );

  const selectedWarehouse = useMemo(
    () => warehouses.find((entry) => entry.warehouse_id === warehouseId),
    [warehouses, warehouseId]
  );

  const printerPortIssue = printerStatus?.port_issue;
  const printerConnected = Boolean(printerStatus?.connected || printerStatus?.ready_for_labels);
  const canDirectPrint = canPrint && printerConnected && !printerPortIssue;

  const refreshPrinterStatus = useCallback(async () => {
    setCheckingPrinter(true);
    try {
      const status = await fetchLabelPrinterStatus();
      setPrinterStatus(status);
      return status;
    } catch {
      setPrinterStatus({
        connected: false,
        available: false,
        message: "No se pudo verificar la impresora USB",
      });
      return null;
    } finally {
      setCheckingPrinter(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setQuantity(Math.max(1, parseInt(initialQuantity, 10) || 1));
    setLoadingConfig(true);
    Promise.all([fetchLabelConfig(), fetchLabelPrinterStatus()])
      .then(([data, status]) => {
        setConfig(data);
        setPrinterStatus(status || data.printer_status || null);
        setTemplateId(data.default_template_id || "col_50x100");
        setPrinterId(data.default_printer_id || "xprinter_xp460b");
        const template = (data.templates || []).find((entry) => entry.id === data.default_template_id);
        if (template) {
          setCustomWidthMm(String(template.width_mm || ""));
          setCustomHeightMm(String(template.height_mm || ""));
          setShape(template.shape || "rect");
        }
      })
      .catch(() => toast.error("No se pudo cargar la configuración de etiquetas"))
      .finally(() => setLoadingConfig(false));

    const intervalId = window.setInterval(() => {
      refreshPrinterStatus();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [open, initialQuantity, refreshPrinterStatus]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setCustomWidthMm(String(selectedTemplate.width_mm || ""));
    setCustomHeightMm(String(selectedTemplate.height_mm || ""));
    setShape(selectedTemplate.shape || "rect");
  }, [selectedTemplate]);

  const buildPayload = () => ({
    product_id: product?.product_id,
    warehouse_id: warehouseId,
    template_id: templateId,
    printer_id: printerId,
    quantity: Math.max(1, parseInt(quantity, 10) || 1),
    show_price: showPrice,
    template_overrides: {
      width_mm: Number(customWidthMm) || undefined,
      height_mm: Number(customHeightMm) || undefined,
      shape,
    },
  });

  const handlePreview = async () => {
    if (!canPreview) {
      toast.error("No tienes permiso para previsualizar etiquetas");
      return;
    }
    if (!product?.product_id || !warehouseId) {
      toast.error("Selecciona producto y bodega");
      return;
    }
    setBusyAction("preview");
    try {
      const blob = await previewInventoryLabels(buildPayload());
      openBlobInNewTab(blob);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo generar la vista previa");
    } finally {
      setBusyAction("");
    }
  };

  const handlePrint = async (outputFormat = "pdf") => {
    if (!canPrint) {
      toast.error("No tienes permiso para imprimir etiquetas");
      return;
    }
    if (["usb", "direct", "usb_direct"].includes(outputFormat) && !printerConnected) {
      toast.error(printerStatus?.message || "Impresora USB no detectada");
      return;
    }
    if (!product?.product_id || !warehouseId) {
      toast.error("Selecciona producto y bodega");
      return;
    }
    setBusyAction(outputFormat);
    try {
      const response = await printInventoryLabels({ ...buildPayload(), output_format: outputFormat });
      if (["usb", "direct", "usb_direct"].includes(outputFormat)) {
        toast.success(response.data?.message || "Etiquetas enviadas a la impresora USB");
        return;
      }
      const extension = outputFormat === "tspl" ? "tspl" : "pdf";
      downloadBlob(response.data, `etiquetas-${product.sku || product.product_id}.${extension}`);
      toast.success(
        outputFormat === "tspl"
          ? "Archivo TSPL generado para Xprinter XP-460B"
          : "PDF de etiquetas listo para imprimir"
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo generar la impresión");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-4">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Imprimir etiquetas
          </DialogTitle>
          <DialogDescription>
            Etiquetas 50×100 mm horizontales (logo de tu tienda a la izquierda), monocromáticas, con impresión directa USB cuando la XP-460B está conectada.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="font-medium">{product?.name || "Producto"}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            SKU: {product?.sku || "-"}
            {product?.barcode ? ` · Barras: ${product.barcode}` : ""}
            {" · "}Bodega: {selectedWarehouse?.name || warehouseId || "-"}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <div className="inline-flex items-center gap-2 text-sm font-medium">
            <Settings2 className="h-4 w-4" />
            Estado impresora USB
          </div>
          <div className="flex items-center gap-2">
            {printerConnected ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Conectada
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertCircle className="mr-1 h-3.5 w-3.5" />
                No disponible
              </Badge>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={refreshPrinterStatus} disabled={checkingPrinter}>
              {checkingPrinter ? "Verificando..." : "Revisar"}
            </Button>
          </div>
          <p className="w-full text-xs text-muted-foreground">
            {printerStatus?.message || "Verificando puente local de impresión..."}
            {printerStatus?.port_name ? ` · Puerto: ${printerStatus.port_name}` : ""}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Plantilla</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={loadingConfig}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plantilla" />
              </SelectTrigger>
              <SelectContent>
                {config.templates.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Impresora</Label>
            <Select value={printerId} onValueChange={setPrinterId} disabled={loadingConfig}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar impresora" />
              </SelectTrigger>
              <SelectContent>
                {config.printers.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="inline-flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Ancho (mm)
            </Label>
            <Input
              type="number"
              min="20"
              max="120"
              value={customWidthMm}
              onChange={(event) => setCustomWidthMm(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Alto (mm)</Label>
            <Input
              type="number"
              min="15"
              max="150"
              value={customHeightMm}
              onChange={(event) => setCustomHeightMm(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Forma</Label>
            <Select value={shape} onValueChange={setShape}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rect">Rectangular</SelectItem>
                <SelectItem value="round">Circular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cantidad de etiquetas</Label>
            <Input
              type="number"
              min="1"
              max="500"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <div className="text-sm font-medium">Mostrar precio en etiqueta</div>
            <div className="text-xs text-muted-foreground">Incluye el precio base del producto.</div>
          </div>
          <Switch checked={showPrice} onCheckedChange={setShowPrice} />
        </div>

        {!canPrint ? (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No tienes permiso de impresión de etiquetas. Solicita el permiso <strong>Etiquetas de inventario</strong> a gerencia.
          </div>
        ) : null}

        {printerPortIssue === "virtual_file_port" ? (
          <div className="rounded-lg border border-red-300/80 bg-red-50 px-3 py-2 text-sm text-red-900">
            <strong>Puerto incorrecto (FILE).</strong> Windows mostrará un cuadro para guardar archivo en lugar de imprimir.
            Abre <strong>Configuración → Impresoras → Xprinter XP-460B → Propiedades → Puertos</strong> y selecciona
            el puerto <strong>USB00x</strong>. Desmarca <strong>FILE:</strong>.
          </div>
        ) : null}

        {!printerConnected && canPrint ? (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            La impresión directa USB está deshabilitada hasta que se detecte la Xprinter. Ejecuta{" "}
            <code className="rounded bg-white/80 px-1">scripts/start-label-print-bridge.ps1</code> en este equipo.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => handlePrint("usb_direct")}
            disabled={!canDirectPrint || busyAction !== ""}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir en USB
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={!canPreview || busyAction !== ""}
          >
            <Eye className="mr-2 h-4 w-4" />
            Vista previa
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handlePrint("pdf")}
            disabled={!canPrint || busyAction !== ""}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handlePrint("tspl")}
            disabled={!canPrint || busyAction !== ""}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar TSPL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}