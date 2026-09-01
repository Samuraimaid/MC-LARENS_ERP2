import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Video, Plus, Trash2, Edit, Play, RefreshCw, Smartphone, Monitor, Globe, Check } from "lucide-react";

export function PromotionalVideosSettingsPanel() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [orientation, setOrientation] = useState("horizontal");
  const [allowWidescreenOnMobile, setAllowWidescreenOnMobile] = useState(true);
  const [sortOrder, setSortOrder] = useState(1);
  const [active, setActive] = useState(true);
  const [branchId, setBranchId] = useState("*");

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/settings/promotional-videos`, { withCredentials: true });
      const list = res.data?.videos || [];
      setVideos(list);
    } catch (err) {
      toast.error("Error al cargar videos promocionales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleOpenCreate = () => {
    setEditingVideo(null);
    setTitle("");
    setUrl("");
    setOrientation("horizontal");
    setAllowWidescreenOnMobile(true);
    setSortOrder(videos.length + 1);
    setActive(true);
    setBranchId("*");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (v) => {
    setEditingVideo(v);
    setTitle(v.title || "");
    setUrl(v.url || "");
    setOrientation(v.orientation || "horizontal");
    setAllowWidescreenOnMobile(v.allow_widescreen_on_mobile !== false);
    setSortOrder(v.sort_order || 1);
    setActive(v.active !== false);
    setBranchId(Array.isArray(v.branches) && v.branches.length ? v.branches[0] : "*");
    setIsDialogOpen(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!title.trim()) {
      toast.error("El título del video es requerido");
      return;
    }
    if (!url.trim()) {
      toast.error("La URL del video es requerida");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        url: url.trim(),
        orientation,
        allow_widescreen_on_mobile: allowWidescreenOnMobile,
        sort_order: parseInt(sortOrder, 10) || 1,
        active,
        branches: branchId === "*" ? ["*"] : [branchId],
        branch_id: branchId === "*" ? "" : branchId,
      };

      if (editingVideo?.id) {
        await axios.put(`${API}/settings/promotional-videos/${editingVideo.id}`, payload, { withCredentials: true });
        toast.success("Video promocional actualizado");
      } else {
        await axios.post(`${API}/settings/promotional-videos`, payload, { withCredentials: true });
        toast.success("Video promocional registrado");
      }
      setIsDialogOpen(false);
      loadVideos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar el video");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (v, newActive) => {
    try {
      await axios.put(
        `${API}/settings/promotional-videos/${v.id}`,
        { active: newActive },
        { withCredentials: true }
      );
      toast.success(`Video ${newActive ? "activado" : "desactivado"}`);
      setVideos((prev) => prev.map((item) => (item.id === v.id ? { ...item, active: newActive } : item)));
    } catch (err) {
      toast.error("No se pudo actualizar el estado");
    }
  };

  const handleSeedDefaults = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/settings/promotional-videos/seed-defaults`, {}, { withCredentials: true });
      toast.success(res.data?.message || "Videos preinstalados cargados correctamente");
      loadVideos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al cargar videos preinstalados");
      setLoading(false);
    }
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`¿Estás seguro de eliminar el video "${v.title}"?`)) return;
    try {
      await axios.delete(`${API}/settings/promotional-videos/${v.id}`, { withCredentials: true });
      toast.success("Video eliminado");
      setVideos((prev) => prev.filter((item) => item.id !== v.id));
    } catch (err) {
      toast.error("Error al eliminar el video");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-4 flex-wrap gap-3">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Video className="h-5 w-5 text-sky-500" />
              Videos de Fondo para Login y Tótems
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Configura los videos promocionales de alta definición que se reproducen en bucle continuo en la pantalla de inicio de sesión y tótems publicitarios.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={loading} title="Restaura o carga la lista de 11 videos de fábrica">
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Cargar Videos de Fábrica
            </Button>
            <Button variant="outline" size="sm" onClick={loadVideos} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button size="sm" className="bg-sky-600 hover:bg-sky-500 text-white font-medium" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar Video
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && videos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-sky-500" />
              Cargando catálogo de videos promocionales...
            </div>
          ) : videos.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-border rounded-xl space-y-4">
              <Video className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              <div>
                <p className="text-base font-semibold text-muted-foreground">No hay videos en la base de datos de administración</p>
                <p className="text-sm text-muted-foreground/80 mt-1 max-w-md mx-auto">
                  Carga los 11 videos promocionales preinstalados para poder administrarlos, cambiar su orden, desactivarlos o eliminarlos.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button className="bg-sky-600 hover:bg-sky-500 text-white" onClick={handleSeedDefaults} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Cargar los 11 Videos Preinstalados
                </Button>
                <Button variant="outline" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Registrar Nuevo Video
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((v) => (
                <div
                  key={v.id || v._id}
                  className={`flex flex-col rounded-xl border p-3 transition-all duration-200 ${
                    v.active ? "bg-background border-border/80 shadow-sm" : "bg-muted/30 border-dashed border-muted-foreground/30 opacity-70"
                  }`}
                >
                  {/* Video Thumbnail Preview */}
                  <div className="relative aspect-video w-full rounded-lg bg-black/90 overflow-hidden mb-3 group">
                    <video
                      src={v.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => e.target.play().catch(() => {})}
                      onMouseLeave={(e) => {
                        e.target.pause();
                        e.target.currentTime = 0;
                      }}
                    />
                    <div className="absolute top-2 left-2 flex gap-1">
                      <Badge variant="secondary" className="bg-black/60 text-white text-[10px] backdrop-blur-sm">
                        Orden #{v.sort_order || 1}
                      </Badge>
                      <Badge
                        className={`text-[10px] font-semibold text-white ${
                          v.orientation === "vertical"
                            ? "bg-purple-600"
                            : v.orientation === "universal"
                            ? "bg-emerald-600"
                            : "bg-blue-600"
                        }`}
                      >
                        {v.orientation === "vertical" ? "Vertical (9:16)" : v.orientation === "universal" ? "Universal" : "Horizontal (16:9)"}
                      </Badge>
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none text-white text-xs font-semibold">
                      <Play className="h-6 w-6 text-white drop-shadow-md mr-1" /> Pasar mouse para previsualizar
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-foreground line-clamp-1" title={v.title}>
                      {v.title}
                    </h4>
                    <p className="text-xs text-muted-foreground/80 font-mono truncate mt-0.5" title={v.url}>
                      {v.url}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center text-[11px] text-muted-foreground">
                      {v.allow_widescreen_on_mobile !== false ? (
                        <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                          <Smartphone className="h-3 w-3 mr-1" /> Móvil panorámico OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-600 dark:text-amber-400">
                          <Monitor className="h-3 w-3 mr-1" /> Solo tótems/escritorio
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Switch */}
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={v.active !== false}
                        onCheckedChange={(checked) => handleToggleActive(v, checked)}
                        id={`switch-${v.id}`}
                      />
                      <Label htmlFor={`switch-${v.id}`} className="text-xs font-medium cursor-pointer">
                        {v.active !== false ? "Activo" : "Inactivo"}
                      </Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(v)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => handleDelete(v)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogo para Crear / Editar Video */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-sky-500" />
                {editingVideo ? "Editar Video Promocional" : "Agregar Nuevo Video Promocional"}
              </DialogTitle>
              <DialogDescription>
                Define la URL (.mp4), título y reglas de orientación para la rotación automática en el login.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="vid-title" className="text-xs font-semibold">
                  Título descriptivo <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="vid-title"
                  placeholder="ej. Fox Racing Series 2026 Promo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="vid-url" className="text-xs font-semibold">
                  URL del archivo de video (.mp4) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="vid-url"
                  placeholder="/videos/promos/mi-video.mp4 o URL externa HTTPS"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mt-1 font-mono text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="vid-orientation" className="text-xs font-semibold">
                    Orientación Principal
                  </Label>
                  <Select value={orientation} onValueChange={setOrientation}>
                    <SelectTrigger id="vid-orientation" className="mt-1">
                      <SelectValue placeholder="Orientación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horizontal">Horizontal (16:9 Panorámico)</SelectItem>
                      <SelectItem value="vertical">Vertical (9:16 Tótem)</SelectItem>
                      <SelectItem value="universal">Universal (Todo formato)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vid-order" className="text-xs font-semibold">
                    Orden de Rotación
                  </Label>
                  <Input
                    id="vid-order"
                    type="number"
                    min="1"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allow-mobile" className="text-xs font-semibold cursor-pointer">
                      Permitir en pantallas móviles verticales
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Si está activo, el video panorámico se ajustará automáticamente a pantallas de celulares.
                    </p>
                  </div>
                  <Switch
                    id="allow-mobile"
                    checked={allowWidescreenOnMobile}
                    onCheckedChange={setAllowWidescreenOnMobile}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div className="space-y-0.5">
                    <Label htmlFor="vid-active" className="text-xs font-semibold cursor-pointer">
                      Estado Activo
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Solo los videos activos se incluirán en el carrusel de inicio.
                    </p>
                  </div>
                  <Switch id="vid-active" checked={active} onCheckedChange={setActive} />
                </div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-medium" disabled={submitting}>
                {submitting ? "Guardando..." : "Guardar Video"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PromotionalVideosSettingsPanel;
