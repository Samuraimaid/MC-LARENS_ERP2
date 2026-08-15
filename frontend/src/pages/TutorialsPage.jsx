import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Route,
  Save,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEVEL_STYLES = {
  basico: "border-emerald-300 bg-emerald-50 text-emerald-900",
  intermedio: "border-sky-300 bg-sky-50 text-sky-900",
  avanzado: "border-violet-300 bg-violet-50 text-violet-900",
};

function assetUrl(src) {
  if (!src) return "/tutorials/login-pin.svg";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  if (src.startsWith("/api/")) return src;
  return src;
}

function emptyModule(order = 1) {
  return {
    id: `mod_${Date.now().toString(36)}`,
    order,
    level: "basico",
    duration_min: 5,
    title: "Nuevo modulo",
    summary: "",
    image: "",
    image_alt: "",
    objectives: [],
    steps: [{ title: "Paso 1", detail: "" }],
    dos: [],
    donts: [],
    scenarios: [],
    related_routes: [],
    shortcuts: [],
  };
}

function LevelBadge({ level }) {
  const key = String(level || "").toLowerCase();
  return (
    <Badge variant="outline" className={`capitalize ${LEVEL_STYLES[key] || ""}`}>
      {level || "modulo"}
    </Badge>
  );
}

function LinesEditor({ label, value, onChange, placeholder }) {
  const text = Array.isArray(value) ? value.join("\n") : "";
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea
        value={text}
        placeholder={placeholder || "Una linea por item"}
        rows={3}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean)
          )
        }
      />
    </div>
  );
}

export function TutorialsPage() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [track, setTrack] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [activeId, setActiveId] = useState(null);
  const [moduleDetail, setModuleDetail] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showOpinion, setShowOpinion] = useState(false);

  const canEdit = Boolean(catalog?.can_edit);
  const canViewAll = Boolean(catalog?.can_view_all_tracks);

  const loadCatalog = useCallback(
    async (trackRole) => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API}/tutorials`, {
          params: { full: true, track: trackRole || undefined },
          withCredentials: true,
        });
        const data = res.data || {};
        setCatalog(data);
        const selected = data.selected_track || trackRole || "";
        setTrack(selected);
        const modules = data.modules_full || data.modules || [];
        const sorted = [...modules].sort((a, b) => (a.order || 0) - (b.order || 0));
        if (sorted[0]?.id) {
          setActiveId((prev) =>
            sorted.some((m) => m.id === prev) ? prev : sorted[0].id
          );
        } else {
          setActiveId(null);
          setModuleDetail(null);
        }
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            "No se pudo cargar el curriculum de tutoriales."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const modules = useMemo(() => {
    const full = catalog?.modules_full;
    const list = Array.isArray(full) && full.length ? full : catalog?.modules || [];
    const sorted = [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (levelFilter === "all") return sorted;
    return sorted.filter((m) => String(m.level || "") === levelFilter);
  }, [catalog, levelFilter]);

  useEffect(() => {
    if (!activeId || !catalog) {
      setModuleDetail(null);
      return;
    }
    const fromFull = (catalog.modules_full || []).find((m) => m.id === activeId);
    if (fromFull) {
      setModuleDetail(fromFull);
      setDraft(JSON.parse(JSON.stringify(fromFull)));
      return;
    }
    const trackRole = catalog.selected_track;
    axios
      .get(`${API}/tutorials/tracks/${trackRole}/modules/${activeId}`, {
        withCredentials: true,
      })
      .then((res) => {
        const mod = res.data?.module || res.data;
        setModuleDetail(mod);
        setDraft(JSON.parse(JSON.stringify(mod)));
      })
      .catch(() => setModuleDetail(null));
  }, [activeId, catalog]);

  const onTrackChange = async (role) => {
    setEditMode(false);
    await loadCatalog(role);
  };

  const saveModule = async () => {
    if (!draft || !track) return;
    setSaving(true);
    try {
      await axios.put(
        `${API}/tutorials/tracks/${track}/modules/${draft.id}`,
        draft,
        { withCredentials: true }
      );
      toast.success("Modulo guardado");
      setEditMode(false);
      await loadCatalog(track);
      setActiveId(draft.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const createModule = async () => {
    if (!track) return;
    const order = (modules[modules.length - 1]?.order || 0) + 1;
    const body = emptyModule(order);
    try {
      const res = await axios.post(
        `${API}/tutorials/tracks/${track}/modules`,
        body,
        { withCredentials: true }
      );
      toast.success("Modulo creado");
      await loadCatalog(track);
      const id = res.data?.module?.id || body.id;
      setActiveId(id);
      setEditMode(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo crear");
    }
  };

  const deleteModule = async () => {
    if (!draft?.id || !track) return;
    if (!window.confirm(`Eliminar modulo "${draft.title}"?`)) return;
    try {
      await axios.delete(
        `${API}/tutorials/tracks/${track}/modules/${draft.id}`,
        { withCredentials: true }
      );
      toast.success("Modulo eliminado");
      setEditMode(false);
      await loadCatalog(track);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo eliminar");
    }
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/tutorials/assets?folder=uploads`, fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url;
      if (url) {
        setDraft((d) => ({ ...d, image: url, image_alt: d?.image_alt || file.name }));
        toast.success("Imagen subida y adjuntada al modulo");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  if (loading && !catalog) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        Cargando tutoriales multi-rol…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-6 text-rose-900">{error}</CardContent>
        </Card>
      </div>
    );
  }

  const opinion = catalog?.opinion || {};
  const golden = catalog?.golden_rules || [];
  const tracks = catalog?.available_tracks || [];
  const view = editMode ? draft : moduleDetail;

  return (
    <div
      className="p-4 md:p-6 space-y-5 bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 min-h-full rounded-xl"
      data-testid="tutorials-page"
    >
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-900 p-2.5 text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Academia multi-rol
              </p>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
                {catalog?.title || "Tutoriales"}
              </h1>
              <p className="text-slate-600 mt-1 max-w-3xl">
                {catalog?.subtitle}
                {canViewAll
                  ? " Puedes revisar y editar el contenido de todos los roles."
                  : ` Track de tu rol: ${user?.role || "—"}.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <Badge variant="outline" className="bg-slate-50">
                  v{catalog?.version || "—"}
                </Badge>
                <Badge variant="outline" className="bg-slate-50">
                  {catalog?.total_modules || 0} modulos
                </Badge>
                <Badge variant="outline" className="bg-slate-50 inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> ~{catalog?.estimated_minutes || "—"} min
                </Badge>
                {canEdit ? (
                  <Badge className="bg-amber-100 text-amber-900 border border-amber-300">
                    Editor activo
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewAll && tracks.length > 0 ? (
              <Select value={track} onValueChange={onTrackChange}>
                <SelectTrigger className="w-[220px] bg-white">
                  <SelectValue placeholder="Rol / track" />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t.role} value={t.role}>
                      {t.label || t.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {["all", "basico", "intermedio", "avanzado"].map((lvl) => (
              <Button
                key={lvl}
                size="sm"
                variant={levelFilter === lvl ? "default" : "outline"}
                className={levelFilter === lvl ? "bg-slate-900" : ""}
                onClick={() => setLevelFilter(lvl)}
              >
                {lvl === "all" ? "Todos" : lvl}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => setShowOpinion((v) => !v)}>
              <BookOpen className="h-4 w-4 mr-1.5" />
              Opinion
            </Button>
            {canEdit ? (
              <>
                <Button size="sm" variant="outline" onClick={createModule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Modulo
                </Button>
                <Button
                  size="sm"
                  variant={editMode ? "default" : "outline"}
                  className={editMode ? "bg-amber-700 hover:bg-amber-800" : ""}
                  onClick={() => {
                    if (!moduleDetail) return;
                    setDraft(JSON.parse(JSON.stringify(moduleDetail)));
                    setEditMode((v) => !v);
                  }}
                  disabled={!moduleDetail}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  {editMode ? "Viendo" : "Editar"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {showOpinion && opinion?.headline ? (
        <Card className="border-indigo-200 bg-indigo-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-indigo-950">{opinion.headline}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-indigo-950/90">
            <ul className="list-disc pl-5 space-y-1">
              {(opinion.points || []).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {opinion.recommendation ? (
              <p className="rounded-lg border border-indigo-200 bg-white/80 px-3 py-2">
                <strong>Recomendacion:</strong> {opinion.recommendation}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {golden.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-950">
              <ShieldAlert className="h-4 w-4" /> Reglas de oro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {golden.map((rule) => (
                <div
                  key={rule}
                  className="rounded-lg border border-amber-200 bg-white/90 px-3 py-2 text-sm text-amber-950"
                >
                  {rule}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4 border-slate-200 bg-white/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Ruta · {tracks.find((t) => t.role === track)?.label || track}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[min(70vh,720px)] px-3 pb-3">
              <div className="space-y-2">
                {modules.map((m) => {
                  const active = m.id === activeId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setEditMode(false);
                        setActiveId(m.id);
                      }}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            className={`text-[11px] uppercase tracking-wide ${
                              active ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            Modulo {m.order}
                          </div>
                          <div className="font-semibold leading-snug">{m.title}</div>
                          <div
                            className={`mt-1 text-xs line-clamp-2 ${
                              active ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {m.summary}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 mt-1 opacity-60" />
                      </div>
                    </button>
                  );
                })}
                {!modules.length ? (
                  <p className="text-sm text-slate-500 p-3">Sin modulos en este track.</p>
                ) : null}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="lg:col-span-8 space-y-4">
          {!view ? (
            <Card>
              <CardContent className="py-10 text-center text-slate-500">
                Selecciona un modulo.
              </CardContent>
            </Card>
          ) : editMode && canEdit ? (
            <Card className="border-amber-200 bg-white">
              <CardHeader>
                <CardTitle className="text-xl">Editando modulo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>ID</Label>
                    <Input value={draft.id} disabled />
                  </div>
                  <div className="space-y-1">
                    <Label>Orden</Label>
                    <Input
                      type="number"
                      value={draft.order}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, order: Number(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Titulo</Label>
                    <Input
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Resumen</Label>
                    <Textarea
                      rows={2}
                      value={draft.summary || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Nivel</Label>
                    <Select
                      value={draft.level || "basico"}
                      onValueChange={(v) => setDraft((d) => ({ ...d, level: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basico">basico</SelectItem>
                        <SelectItem value="intermedio">intermedio</SelectItem>
                        <SelectItem value="avanzado">avanzado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Minutos</Label>
                    <Input
                      type="number"
                      value={draft.duration_min || 5}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          duration_min: Number(e.target.value) || 5,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>URL imagen (captura real)</Label>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="flex-1 min-w-[200px]"
                        value={draft.image || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, image: e.target.value }))}
                        placeholder="/api/tutorials/assets/real/login.png"
                      />
                      <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => uploadImage(e.target.files?.[0])}
                          disabled={uploading}
                        />
                        <ImagePlus className="h-4 w-4" />
                        {uploading ? "Subiendo…" : "Subir captura"}
                      </label>
                    </div>
                    {draft.image ? (
                      <img
                        src={assetUrl(draft.image)}
                        alt="preview"
                        className="mt-2 max-h-48 rounded-lg border object-cover"
                      />
                    ) : null}
                  </div>
                </div>

                <LinesEditor
                  label="Objetivos (una por linea)"
                  value={draft.objectives}
                  onChange={(objectives) => setDraft((d) => ({ ...d, objectives }))}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Pasos del procedimiento</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          steps: [
                            ...(d.steps || []),
                            { title: `Paso ${(d.steps || []).length + 1}`, detail: "" },
                          ],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Paso
                    </Button>
                  </div>
                  {(draft.steps || []).map((step, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2 bg-slate-50">
                      <div className="flex gap-2">
                        <Input
                          value={step.title}
                          onChange={(e) => {
                            const steps = [...(draft.steps || [])];
                            steps[idx] = { ...steps[idx], title: e.target.value };
                            setDraft((d) => ({ ...d, steps }));
                          }}
                          placeholder="Titulo del paso"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              steps: (d.steps || []).filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        value={step.detail}
                        onChange={(e) => {
                          const steps = [...(draft.steps || [])];
                          steps[idx] = { ...steps[idx], detail: e.target.value };
                          setDraft((d) => ({ ...d, steps }));
                        }}
                        placeholder="Detalle del procedimiento"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LinesEditor
                    label="Si haz"
                    value={draft.dos}
                    onChange={(dos) => setDraft((d) => ({ ...d, dos }))}
                  />
                  <LinesEditor
                    label="No hagas"
                    value={draft.donts}
                    onChange={(donts) => setDraft((d) => ({ ...d, donts }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Escenarios</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          scenarios: [
                            ...(d.scenarios || []),
                            { name: "Nuevo escenario", procedure: "" },
                          ],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Escenario
                    </Button>
                  </div>
                  {(draft.scenarios || []).map((sc, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2 bg-amber-50/40">
                      <Input
                        value={sc.name}
                        onChange={(e) => {
                          const scenarios = [...(draft.scenarios || [])];
                          scenarios[idx] = { ...scenarios[idx], name: e.target.value };
                          setDraft((d) => ({ ...d, scenarios }));
                        }}
                      />
                      <Textarea
                        rows={2}
                        value={sc.procedure}
                        onChange={(e) => {
                          const scenarios = [...(draft.scenarios || [])];
                          scenarios[idx] = {
                            ...scenarios[idx],
                            procedure: e.target.value,
                          };
                          setDraft((d) => ({ ...d, scenarios }));
                        }}
                      />
                    </div>
                  ))}
                </div>

                <LinesEditor
                  label="Rutas relacionadas"
                  value={draft.related_routes}
                  onChange={(related_routes) =>
                    setDraft((d) => ({ ...d, related_routes }))
                  }
                  placeholder="/sales"
                />

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={saveModule} disabled={saving} className="bg-slate-900">
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditMode(false)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={deleteModule}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar modulo
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden border-slate-200 bg-white/95">
                <div className="relative aspect-[16/9] bg-slate-100">
                  <img
                    src={assetUrl(view.image)}
                    alt={view.image_alt || view.title}
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = "/tutorials/login-pin.svg";
                    }}
                  />
                </div>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={view.level} />
                    <Badge variant="outline">Modulo {view.order}</Badge>
                    <Badge variant="outline" className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {view.duration_min} min
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl">{view.title}</CardTitle>
                  <p className="text-slate-600">{view.summary}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {view.objectives?.length ? (
                    <section>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Objetivos
                      </h3>
                      <ul className="grid gap-1.5 md:grid-cols-2">
                        {view.objectives.map((o) => (
                          <li
                            key={o}
                            className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm"
                          >
                            {o}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <section>
                    <h3 className="text-sm font-semibold mb-3">
                      Procedimiento correcto (paso a paso)
                    </h3>
                    <ol className="space-y-3">
                      {(view.steps || []).map((step, idx) => (
                        <li
                          key={`${view.id}-s-${idx}`}
                          className="flex gap-3 rounded-xl border bg-slate-50/60 p-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-semibold">{step.title}</div>
                            <p className="text-sm text-slate-600 mt-0.5">{step.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                      <h3 className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Si haz
                      </h3>
                      <ul className="space-y-1 text-sm">
                        {(view.dos || []).map((d) => (
                          <li key={d}>• {d}</li>
                        ))}
                      </ul>
                    </section>
                    <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                      <h3 className="text-sm font-semibold text-rose-900 mb-2 flex items-center gap-1.5">
                        <XCircle className="h-4 w-4" /> No hagas
                      </h3>
                      <ul className="space-y-1 text-sm">
                        {(view.donts || []).map((d) => (
                          <li key={d}>• {d}</li>
                        ))}
                      </ul>
                    </section>
                  </div>

                  {view.scenarios?.length ? (
                    <section>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Escenarios
                      </h3>
                      <div className="space-y-2">
                        {view.scenarios.map((sc) => (
                          <div
                            key={sc.name}
                            className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"
                          >
                            <div className="font-semibold text-amber-950">{sc.name}</div>
                            <p className="text-sm mt-1 text-amber-950/85">{sc.procedure}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {view.related_routes?.length ? (
                    <section className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Route className="h-3.5 w-3.5" />
                      {view.related_routes.join(" · ")}
                    </section>
                  ) : null}
                </CardContent>
              </Card>

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={modules.findIndex((m) => m.id === activeId) <= 0}
                  onClick={() => {
                    const idx = modules.findIndex((m) => m.id === activeId);
                    if (idx > 0) setActiveId(modules[idx - 1].id);
                  }}
                >
                  Anterior
                </Button>
                <Button
                  className="bg-slate-900"
                  disabled={
                    modules.findIndex((m) => m.id === activeId) >= modules.length - 1
                  }
                  onClick={() => {
                    const idx = modules.findIndex((m) => m.id === activeId);
                    if (idx < modules.length - 1) setActiveId(modules[idx + 1].id);
                  }}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TutorialsPage;
