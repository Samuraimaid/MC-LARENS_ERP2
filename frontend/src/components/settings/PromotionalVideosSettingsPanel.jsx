import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
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
import {
  Video, Plus, Trash2, Edit, Play, RefreshCw, Smartphone, Monitor,
  Upload, Link as LinkIcon, FileVideo, CheckCircle2, Loader2
} from "lucide-react";

function PromoVideoCardThumbnail({ video, onPreviewFull }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Time fragment #t=1.5 to automatically skip 0s black fade-in intro
  const videoSrc = React.useMemo(() => {
    if (!video?.url) return "";
    return video.url.includes("#") ? video.url : `${video.url}#t=1.5`;
  }, [video?.url]);

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        setIsPlaying(false);
        // Reset to 1.5s attractive thumbnail frame
        if (videoRef.current.duration) {
          videoRef.current.currentTime = Math.min(1.5, videoRef.current.duration * 0.1);
        }
      } catch (_) {}
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.currentTime < 0.5) {
      try {
        videoRef.current.currentTime = Math.min(1.5, (videoRef.current.duration || 10) * 0.1);
      } catch (_) {}
    }
  };

  return (
    <div
      className="relative aspect-video w-full rounded-lg bg-black/90 overflow-hidden mb-3 group cursor-pointer select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onPreviewFull && onPreviewFull(video)}
      title="Clic para reproducir en pantalla completa con audio"
    >
      <video
        ref={videoRef}
        src={videoSrc}
        preload="metadata"
        className="w-full h-full object-cover transition-opacity duration-300"
        muted
        loop
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onError={(e) => {
          console.warn("[PromoVideoCardThumbnail] Error cargando video preview:", video?.url);
        }}
      />
      <div className="absolute top-2 left-2 flex gap-1 z-10 pointer-events-none">
        <Badge variant="secondary" className="bg-black/70 text-white text-[10px] backdrop-blur-sm shadow">
          Orden #{video.sort_order || 1}
        </Badge>
        <Badge
          className={`text-[10px] font-semibold text-white shadow ${
            video.orientation === "vertical"
              ? "bg-purple-600"
              : video.orientation === "universal"
              ? "bg-emerald-600"
              : "bg-blue-600"
          }`}
        >
          {video.orientation === "vertical" ? "Vertical (9:16)" : video.orientation === "universal" ? "Universal" : "Horizontal (16:9)"}
        </Badge>
      </div>

      {!isPlaying && (
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-all pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-white text-xs font-semibold shadow-lg group-hover:scale-105 transition-transform">
            <Play className="h-3.5 w-3.5 fill-white text-white" />
            <span>Previsualizar</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PromotionalVideosSettingsPanel() {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const canDelete = ["gerencia", "programador"].includes(userRole);

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewModalVideo, setPreviewModalVideo] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [inputMode, setInputMode] = useState("upload"); // "upload" | "url"
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [orientation, setOrientation] = useState("horizontal");
  const [allowWidescreenOnMobile, setAllowWidescreenOnMobile] = useState(true);
  const [sortOrder, setSortOrder] = useState(1);
  const [active, setActive] = useState(true);
  const [branchId, setBranchId] = useState("*");

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

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
    setInputMode("upload");
    setTitle("");
    setUrl("");
    setSelectedFile(null);
    setUploadProgress(0);
    setOrientation("horizontal");
    setAllowWidescreenOnMobile(true);
    setSortOrder(videos.length + 1);
    setActive(true);
    setBranchId("*");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (v) => {
    setEditingVideo(v);
    setInputMode("url");
    setTitle(v.title || "");
    setUrl(v.url || "");
    setSelectedFile(null);
    setUploadProgress(0);
    setOrientation(v.orientation || "horizontal");
    setAllowWidescreenOnMobile(v.allow_widescreen_on_mobile !== false);
    setSortOrder(v.sort_order || 1);
    setActive(v.active !== false);
    setBranchId(Array.isArray(v.branches) && v.branches.length ? v.branches[0] : "*");
    setIsDialogOpen(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().match(/\.(mp4|webm|mov|m4v|mkv)$/i)) {
      toast.error("Formato no compatible. Por favor sube un archivo .mp4, .webm o .mov");
      return;
    }

    setSelectedFile(file);
    if (!title.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setTitle(nameWithoutExt);
    }

    // Subida por fragmentos (Chunked Upload) para evadir el límite de 32MB de Cloud Run
    setUploading(true);
    setUploadProgress(5);
    try {
      const CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5 MB por chunk
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      let finalUrl = "";

      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const start = chunkIdx * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunkBlob, file.name);
        formData.append("upload_id", uploadId);
        formData.append("chunk_index", chunkIdx);
        formData.append("total_chunks", totalChunks);
        formData.append("filename", file.name);

        const res = await axios.post(`${API}/settings/promotional-videos/upload-chunk`, formData, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        });

        const percent = Math.round(((chunkIdx + 1) / totalChunks) * 100);
        setUploadProgress(percent);

        if (res.data?.status === "complete" && res.data?.url) {
          finalUrl = res.data.url;
        }
      }

      if (finalUrl) {
        setUrl(finalUrl);
        setUploadProgress(100);
        toast.success("Archivo de video subido y sincronizado exitosamente");
      } else {
        throw new Error("No se recibió la URL final del video procesado");
      }
    } catch (err) {
      console.error("Error en subida de video:", err);
      toast.error(err.response?.data?.detail || err.message || "Error al subir el archivo de video");
      setSelectedFile(null);
    } finally {
      setUploading(false);
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

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!title.trim()) {
      toast.error("El título del video es requerido");
      return;
    }
    if (!url.trim()) {
      toast.error("El archivo de video o URL es requerido");
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

  const handleDelete = async (v) => {
    if (!canDelete) {
      toast.error("Tu rol no tiene permisos para eliminar videos");
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar el video "${v.title}"?`)) return;
    try {
      await axios.delete(`${API}/settings/promotional-videos/${v.id}`, { withCredentials: true });
      toast.success("Video eliminado");
      setVideos((prev) => prev.filter((item) => item.id !== v.id));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar el video");
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
            <Button size="sm" className="bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm" onClick={handleOpenCreate}>
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
                  Carga los 11 videos promocionales preinstalados o sube uno nuevo directamente desde tu dispositivo.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button className="bg-sky-600 hover:bg-sky-500 text-white" onClick={handleSeedDefaults} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Cargar los 11 Videos Preinstalados
                </Button>
                <Button variant="outline" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Subir Video Local
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
                  <PromoVideoCardThumbnail
                    video={v}
                    onPreviewFull={(vid) => setPreviewModalVideo(vid)}
                  />

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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(v)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => handleDelete(v)} title="Eliminar Video">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogo para Crear / Editar Video con Subida de Archivos Locales */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-sky-500" />
                {editingVideo ? "Editar Video Promocional" : "Agregar Video Promocional"}
              </DialogTitle>
              <DialogDescription>
                Sube un video desde tu dispositivo o ingresa una URL para reproducir en el login.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Selector de Modo: Archivo Local vs URL */}
              {!editingVideo && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-lg border border-border">
                  <Button
                    type="button"
                    variant={inputMode === "upload" ? "default" : "ghost"}
                    size="sm"
                    className={`h-8 text-xs font-semibold ${inputMode === "upload" ? "bg-sky-600 text-white" : "text-muted-foreground"}`}
                    onClick={() => setInputMode("upload")}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Subir Archivo Local (.mp4)
                  </Button>
                  <Button
                    type="button"
                    variant={inputMode === "url" ? "default" : "ghost"}
                    size="sm"
                    className={`h-8 text-xs font-semibold ${inputMode === "url" ? "bg-sky-600 text-white" : "text-muted-foreground"}`}
                    onClick={() => setInputMode("url")}
                  >
                    <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                    Enlace / URL Directa
                  </Button>
                </div>
              )}

              {/* Subida de Archivo Local */}
              {inputMode === "upload" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Seleccionar archivo desde tu dispositivo</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                      url ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:border-sky-500/50 hover:bg-sky-500/5"
                    }`}
                  >
                    {uploading ? (
                      <div className="py-2 space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-sky-500" />
                        <p className="text-xs font-semibold text-foreground">Subiendo video al servidor ({uploadProgress}%)...</p>
                      </div>
                    ) : url && selectedFile ? (
                      <div className="py-1 space-y-1">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{selectedFile.name}</p>
                        <p className="text-[11px] text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Clic para cambiar archivo</p>
                      </div>
                    ) : (
                      <div className="py-2 space-y-1">
                        <FileVideo className="h-8 w-8 mx-auto text-muted-foreground/60" />
                        <p className="text-xs font-semibold text-foreground">Haz clic aquí para seleccionar un video (.mp4, .webm, .mov)</p>
                        <p className="text-[11px] text-muted-foreground">Máxima compatibilidad para pantallas HD y tótems</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* URL Directa */}
              {inputMode === "url" && (
                <div>
                  <Label htmlFor="vid-url" className="text-xs font-semibold">
                    URL del archivo de video (.mp4) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="vid-url"
                    placeholder="/videos/promos/mi-video.mp4 o https://storage.googleapis.com/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="mt-1 font-mono text-xs"
                    required
                  />
                </div>
              )}

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
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={submitting || uploading}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-medium" disabled={submitting || uploading || !url}>
                {submitting ? "Guardando..." : "Guardar Video"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Previsualización Completa con Audio y Controles */}
      <Dialog open={!!previewModalVideo} onOpenChange={(open) => !open && setPreviewModalVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 text-white border-white/20">
          <DialogHeader className="p-4 bg-zinc-900/90 border-b border-white/10">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-sky-400">
              <Video className="h-4 w-4" />
              {previewModalVideo?.title || "Previsualización de Video"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 truncate">
              {previewModalVideo?.url}
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video w-full bg-black flex items-center justify-center">
            {previewModalVideo && (
              <video
                key={previewModalVideo.url}
                src={previewModalVideo.url}
                className="w-full h-full object-contain max-h-[60vh]"
                controls
                autoPlay
                playsInline
                onError={(e) => {
                  console.warn("[ModalVideoPreview] Error en reproducción modal:", previewModalVideo?.url);
                }}
              />
            )}
          </div>
          <DialogFooter className="p-3 bg-zinc-900/90 border-t border-white/10 flex items-center justify-between sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>Orientación: <strong className="text-white capitalize">{previewModalVideo?.orientation || "horizontal"}</strong></span>
              <span>·</span>
              <span>Orden: <strong className="text-white">#{previewModalVideo?.sort_order || 1}</strong></span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setPreviewModalVideo(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PromotionalVideosSettingsPanel;
