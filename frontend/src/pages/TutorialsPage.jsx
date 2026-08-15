import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Lightbulb,
  Loader2,
  Route,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const LEVEL_STYLES = {
  basico: "border-emerald-300 bg-emerald-50 text-emerald-900",
  intermedio: "border-sky-300 bg-sky-50 text-sky-900",
  avanzado: "border-violet-300 bg-violet-50 text-violet-900",
};

function LevelBadge({ level }) {
  const key = String(level || "").toLowerCase();
  return (
    <Badge variant="outline" className={`capitalize ${LEVEL_STYLES[key] || ""}`}>
      {level || "módulo"}
    </Badge>
  );
}

export function TutorialsPage() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [activeId, setActiveId] = useState(null);
  const [moduleDetail, setModuleDetail] = useState(null);
  const [loadingModule, setLoadingModule] = useState(false);
  const [showOpinion, setShowOpinion] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await axios.get(`${API}/tutorials`, {
          params: { full: true },
          withCredentials: true,
        });
        if (!mounted) return;
        const data = res.data || {};
        setCatalog(data);
        const first =
          (data.modules_full || data.modules || []).sort(
            (a, b) => (a.order || 0) - (b.order || 0)
          )[0] || null;
        if (first?.id) setActiveId(first.id);
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.detail ||
            "No se pudo cargar el currículo de tutoriales. Verifica sesión y API."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const modules = useMemo(() => {
    const full = catalog?.modules_full;
    const list = Array.isArray(full) && full.length ? full : catalog?.modules || [];
    const sorted = [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (levelFilter === "all") return sorted;
    return sorted.filter((m) => String(m.level || "") === levelFilter);
  }, [catalog, levelFilter]);

  useEffect(() => {
    if (!activeId) {
      setModuleDetail(null);
      return;
    }
    // Prefer full payload already loaded
    const fromFull = (catalog?.modules_full || []).find((m) => m.id === activeId);
    if (fromFull && fromFull.steps) {
      setModuleDetail(fromFull);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setLoadingModule(true);
        const res = await axios.get(`${API}/tutorials/modules/${activeId}`, {
          withCredentials: true,
        });
        if (mounted) setModuleDetail(res.data || null);
      } catch {
        if (mounted) setModuleDetail(null);
      } finally {
        if (mounted) setLoadingModule(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeId, catalog]);

  useEffect(() => {
    if (!modules.length) return;
    if (!modules.some((m) => m.id === activeId)) {
      setActiveId(modules[0].id);
    }
  }, [modules, activeId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        Cargando academia del vendedor…
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
                Academia del vendedor
              </p>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
                {catalog?.title || "Tutoriales"}
              </h1>
              <p className="text-slate-600 mt-1 max-w-3xl">
                {catalog?.subtitle ||
                  "Aprende el ERP desde cero hasta el envío a caja, con escenarios reales."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <Badge variant="outline" className="bg-slate-50">
                  v{catalog?.version || "—"}
                </Badge>
                <Badge variant="outline" className="bg-slate-50">
                  {catalog?.total_modules || modules.length} módulos
                </Badge>
                <Badge variant="outline" className="bg-slate-50 inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{catalog?.estimated_minutes || "—"} min
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
              Opinión del endpoint
            </Button>
          </div>
        </div>
      </div>

      {showOpinion && opinion?.headline ? (
        <Card className="border-indigo-200 bg-indigo-50/70" data-testid="tutorials-opinion">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-indigo-950">{opinion.headline}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-indigo-950/90">
            <ul className="list-disc pl-5 space-y-1">
              {(opinion.points || []).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {opinion.risks?.length ? (
              <div>
                <div className="font-semibold mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Riesgos
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {opinion.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {opinion.recommendation ? (
              <p className="rounded-lg border border-indigo-200 bg-white/80 px-3 py-2">
                <strong>Recomendación:</strong> {opinion.recommendation}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {golden.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-950">
              <ShieldAlert className="h-4 w-4" /> Reglas de oro del vendedor
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
            <CardTitle className="text-base">Ruta de aprendizaje</CardTitle>
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
                      onClick={() => setActiveId(m.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      data-testid={`tutorial-module-${m.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={`text-[11px] uppercase tracking-wide ${active ? "text-slate-300" : "text-slate-500"}`}>
                            Módulo {m.order}
                          </div>
                          <div className="font-semibold leading-snug">{m.title}</div>
                          <div className={`mt-1 text-xs line-clamp-2 ${active ? "text-slate-300" : "text-slate-500"}`}>
                            {m.summary}
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 mt-1 ${active ? "text-white" : "text-slate-400"}`} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] capitalize ${
                            active ? "border-slate-600 text-slate-200" : LEVEL_STYLES[m.level] || ""
                          }`}
                        >
                          {m.level}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] ${active ? "text-slate-300" : "text-slate-500"}`}>
                          <Clock className="h-3 w-3" />
                          {m.duration_min} min
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="lg:col-span-8 space-y-4">
          {loadingModule && !moduleDetail ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando módulo…
            </div>
          ) : moduleDetail ? (
            <>
              <Card className="overflow-hidden border-slate-200 bg-white/95">
                <div className="relative aspect-[16/9] bg-slate-100">
                  <img
                    src={moduleDetail.image}
                    alt={moduleDetail.image_alt || moduleDetail.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = "/tutorials/login-pin.svg";
                    }}
                  />
                </div>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={moduleDetail.level} />
                    <Badge variant="outline" className="bg-slate-50">
                      Módulo {moduleDetail.order}
                    </Badge>
                    <Badge variant="outline" className="bg-slate-50 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {moduleDetail.duration_min} min
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl text-slate-900">{moduleDetail.title}</CardTitle>
                  <p className="text-slate-600">{moduleDetail.summary}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {moduleDetail.objectives?.length ? (
                    <section>
                      <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Objetivos
                      </h3>
                      <ul className="grid gap-1.5 md:grid-cols-2">
                        {moduleDetail.objectives.map((o) => (
                          <li
                            key={o}
                            className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm text-slate-700"
                          >
                            {o}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <section>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">
                      Procedimiento correcto (paso a paso)
                    </h3>
                    <ol className="space-y-3">
                      {(moduleDetail.steps || []).map((step, idx) => (
                        <li
                          key={`${moduleDetail.id}-step-${idx}`}
                          className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{step.title}</div>
                            <p className="text-sm text-slate-600 mt-0.5">{step.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                      <h3 className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Sí haz
                      </h3>
                      <ul className="space-y-1.5 text-sm text-emerald-950/90">
                        {(moduleDetail.dos || []).map((d) => (
                          <li key={d}>• {d}</li>
                        ))}
                      </ul>
                    </section>
                    <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                      <h3 className="text-sm font-semibold text-rose-900 mb-2 flex items-center gap-1.5">
                        <XCircle className="h-4 w-4" /> No hagas
                      </h3>
                      <ul className="space-y-1.5 text-sm text-rose-950/90">
                        {(moduleDetail.donts || []).map((d) => (
                          <li key={d}>• {d}</li>
                        ))}
                      </ul>
                    </section>
                  </div>

                  {moduleDetail.scenarios?.length ? (
                    <section>
                      <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                        Escenarios y cómo resolverlos
                      </h3>
                      <div className="space-y-2">
                        {moduleDetail.scenarios.map((sc) => (
                          <div
                            key={sc.name}
                            className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"
                          >
                            <div className="font-semibold text-amber-950">{sc.name}</div>
                            <p className="text-sm text-amber-950/85 mt-1">{sc.procedure}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {moduleDetail.shortcuts?.length ? (
                    <section>
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">Atajos</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {moduleDetail.shortcuts.map((s) => (
                          <div
                            key={`${s.keys}-${s.action}`}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <span className="font-mono text-xs font-semibold">{s.keys}</span>
                            <span className="text-slate-600 text-right ml-2">{s.action}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {moduleDetail.related_routes?.length ? (
                    <section className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Route className="h-3.5 w-3.5" />
                      Rutas: {moduleDetail.related_routes.join(" · ")}
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
                  Módulo anterior
                </Button>
                <Button
                  className="bg-slate-900 hover:bg-slate-800"
                  disabled={
                    modules.findIndex((m) => m.id === activeId) >= modules.length - 1
                  }
                  onClick={() => {
                    const idx = modules.findIndex((m) => m.id === activeId);
                    if (idx < modules.length - 1) setActiveId(modules[idx + 1].id);
                  }}
                >
                  Siguiente módulo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-slate-500">
                Selecciona un módulo de la ruta de aprendizaje.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default TutorialsPage;
