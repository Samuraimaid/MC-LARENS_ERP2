import React, { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Star, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import ValidatedInput, { VALIDATION_SUCCESS_SHORT } from "@/components/common/ValidatedInput";
import { requiredProductName, requiredPrice } from "@/lib/fieldValidators";
import { buildProductPricePayload } from "@/lib/priceTiers";
import { FileUploadQueue } from "@/components/uploads/FileUploadQueue";
import { API_BASE as API } from "@/lib/api";
import { humanApiError } from "@/lib/humanApiError";

export default function ProductEditDialog({
  product = null,
  open = false,
  onOpenChange,
  onProductUpdated,
  canEdit = true,
}) {
  const [formData, setFormData] = useState(product || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef(null);
  const priceRef = useRef(null);
  const editUploadIndexRef = useRef(0);

  useEffect(() => {
    if (product) {
      setFormData(product);
      editUploadIndexRef.current = product.images?.length || 0;
    }
  }, [product]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const removeProductImage = (url) => {
    setFormData((prev) => ({
      ...prev,
      images: (prev.images || []).filter((img) => img !== url),
    }));
  };

  const setPrimaryImage = (url) => {
    setFormData((prev) => {
      const rest = (prev.images || []).filter((img) => img !== url);
      return { ...prev, images: [url, ...rest] };
    });
  };

  const handleUploadFile = useCallback(async (file, { onProgress } = {}) => {
    const currentSku = formData.sku || "";
    const startIndex = editUploadIndexRef.current;
    editUploadIndexRef.current = startIndex + 1;

    const body = new FormData();
    body.append("files", file);
    if (currentSku) body.append("sku", currentSku);
    body.append("start_index", String(startIndex));

    const res = await axios.post(`${API}/products/images/upload`, body, {
      headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
      onUploadProgress: (evt) => {
        if (typeof onProgress === "function" && evt.total) {
          onProgress({ loaded: evt.loaded, total: evt.total });
        }
      },
    });
    return res.data;
  }, [formData.sku]);

  const handleFileDone = useCallback((result) => {
    const newUrls = result?.image_urls || [];
    if (!newUrls.length) return;
    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images || []), ...newUrls],
    }));
  }, []);

  const handleItemRemove = useCallback((item) => {
    const urls = item?.result?.image_urls || [];
    if (!urls.length) return;
    const drop = new Set(urls);
    setFormData((prev) => ({
      ...prev,
      images: (prev.images || []).filter((u) => !drop.has(u)),
    }));
  }, []);

  const handleSave = async () => {
    if (!formData || !formData.product_id) return;
    if (!canEdit) {
      toast.error("No tienes permiso para editar productos");
      return;
    }

    const nameOk = Boolean(String(formData.name || "").trim());
    const priceRaw = formData.precio1 || formData.price;
    const priceOk = Number(priceRaw) > 0;
    if (!nameOk || !priceOk) {
      nameRef.current?.markSubmitAttempted?.();
      priceRef.current?.markSubmitAttempted?.();
      toast.error("Completa nombre y precio del producto");
      return;
    }

    setIsSubmitting(true);
    try {
      const tier1 = parseFloat(formData.precio1 || formData.price) || 0;
      const tierPayload = buildProductPricePayload(formData, { precio1: tier1 });
      const payload = {
        name: formData.name,
        barcode: String(formData.barcode || "").trim() || null,
        description: formData.description,
        ...tierPayload,
        cost: parseFloat(formData.cost) || 0,
        category: formData.category,
        subcategory: formData.subcategory,
        brand: formData.brand,
        product_type: formData.product_type,
        images: formData.images,
        compatibility: formData.compatibility,
        installation_required: formData.installation_required,
        installation_type: formData.installation_type || "optional",
        installation_price: parseFloat(formData.installation_price) || 0,
        installation_time_minutes: parseInt(formData.installation_time_minutes, 10) || 0,
        low_stock_threshold: Math.max(1, parseInt(formData.low_stock_threshold, 10) || 5),
        warranty_months: parseInt(formData.warranty_months, 10) || 12,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      };

      await axios.put(`${API}/products/${formData.product_id}`, payload, { withCredentials: true });
      toast.success("Producto actualizado");
      onOpenChange(false);
      if (typeof onProductUpdated === "function") {
        onProductUpdated();
      }
    } catch (error) {
      toast.error(humanApiError(error, "No se pudo actualizar el producto — inténtalo de nuevo"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!formData || !open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[92vh] overflow-y-auto p-5 sm:p-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ValidatedInput
              ref={nameRef}
              label="Nombre"
              requiredMark
              value={formData.name || ""}
              onChange={(e) => updateField("name", e.target.value)}
              validate={requiredProductName}
              resetKey={formData.product_id || "edit"}
              successLabel="Se ve bien"
              data-testid="edit-product-name"
            />
            <div>
              <Label>Marca</Label>
              <Input
                value={formData.brand || ""}
                onChange={(e) => updateField("brand", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Código de barras</Label>
            <Input
              value={formData.barcode || ""}
              onChange={(e) => updateField("barcode", e.target.value)}
              placeholder="EAN / UPC para etiquetas y escáner"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ValidatedInput
              ref={priceRef}
              label="Precio 1"
              requiredMark
              type="number"
              step="0.01"
              value={formData.precio1 || formData.price || ""}
              onChange={(e) => setFormData((prev) => ({
                ...prev,
                price: e.target.value,
                precio1: e.target.value,
              }))}
              validate={requiredPrice}
              resetKey={formData.product_id || "edit"}
              successLabel={VALIDATION_SUCCESS_SHORT}
              data-testid="edit-product-price"
            />
            <div>
              <Label>Precio 2</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.precio2 || ""}
                onChange={(e) => updateField("precio2", e.target.value)}
              />
            </div>
            <div>
              <Label>Precio VIP</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.precio_vip || ""}
                onChange={(e) => updateField("precio_vip", e.target.value)}
              />
            </div>
            <div>
              <Label>Precio Casa Comercial</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.precio_casa_comercial || formData.precio3 || ""}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  precio_casa_comercial: e.target.value,
                  precio3: e.target.value,
                }))}
              />
            </div>
            <div>
              <Label>Costo</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cost ?? ""}
                onChange={(e) => updateField("cost", e.target.value)}
              />
            </div>
            <div>
              <Label>Umbral stock bajo</Label>
              <Input
                type="number"
                min="1"
                value={formData.low_stock_threshold ?? 5}
                onChange={(e) => updateField("low_stock_threshold", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Edit Product Images Section */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Imágenes del Producto ({formData.images?.length || 0})</Label>
            </div>
            <FileUploadQueue
              key={formData.product_id || "edit-uploads"}
              accept="image/*"
              multiple
              compact
              testId="inventory-edit-uploads"
              idleLabel="Suelta las imágenes aquí"
              idleHint="o haz clic para subir más fotos"
              onUploadFile={handleUploadFile}
              onFileDone={handleFileDone}
              onItemRemove={handleItemRemove}
            />

            {formData.images && formData.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 border rounded-lg bg-background/50">
                {formData.images.map((url, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border bg-muted/20 transition hover:shadow-md">
                    <img
                      src={url}
                      alt={`Producto ${idx + 1}`}
                      className="w-full h-24 object-cover"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Error'; }}
                    />
                    <div className="absolute top-1 left-1 flex gap-1">
                      {idx === 0 ? (
                        <Badge className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 shadow">
                          ⭐ Principal
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-black/70 text-white text-[9px] font-normal px-1 py-0.5 backdrop-blur-sm">
                          #{idx}
                        </Badge>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5">
                      {idx !== 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-6 text-[10px] px-1.5 shadow bg-white text-slate-800"
                          title="Hacer imagen principal"
                          onClick={() => setPrimaryImage(url)}
                        >
                          <Star className="h-3 w-3 mr-0.5 text-amber-500 fill-amber-500" />
                          Principal
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6 shadow"
                        title="Eliminar imagen"
                        onClick={() => removeProductImage(url)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSave} data-testid="update-product-btn" disabled={!canEdit || isSubmitting}>
              {isSubmitting ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
