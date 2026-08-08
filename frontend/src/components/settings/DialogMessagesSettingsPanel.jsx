import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useDialogMessages } from "@/context/DialogMessagesContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquareText, RefreshCw, Save, RotateCcw } from "lucide-react";

const EDITOR_ROLES = new Set(["gerencia", "programador"]);

const VARIANT_OPTIONS = [
  { id: "information", label: "Información" },
  { id: "warning", label: "Advertencia" },
  { id: "error", label: "Error" },
  { id: "question", label: "Pregunta" },
  { id: "success", label: "Éxito" },
];

export function DialogMessagesSettingsPanel() {
  const { user } = useAuth();
  const { refresh } = useDialogMessages();
  const role = String(user?.role || "").toLowerCase();
  const canEdit = EDITOR_ROLES.has(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/settings/dialog-messages`, { withCredentials: true });
      const rows = response.data?.messages || [];
      setMessages(rows);
      if (!selectedKey && rows[0]?.key) {
        setSelectedKey(rows[0].key);
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudieron cargar los mensajes de diálogo");
    } finally {
      setLoading(false);
    }
  }, [selectedKey]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => messages.find((row) => row.key === selectedKey) || null,
    [messages, selectedKey],
  );

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      title: selected.title || "",
      description: selected.description || "",
      description_supervisor: selected.description_supervisor || "",
      description_precio2: selected.description_precio2 || "",
      description_seller: selected.description_seller || "",
      description_other: selected.description_other || "",
      description_none: selected.description_none || "",
      description_pending: selected.description_pending || "",
      description_approved: selected.description_approved || "",
      description_rejected: selected.description_rejected || "",
      primary_label: selected.primary_label || "",
      primary_label_precio2: selected.primary_label_precio2 || "",
      primary_label_pending: selected.primary_label_pending || "",
      primary_label_rejected: selected.primary_label_rejected || "",
      secondary_label: selected.secondary_label || "",
      tertiary_label: selected.tertiary_label || "",
      submitting_label: selected.submitting_label || "",
      variant: selected.variant || "information",
      checklist: Array.isArray(selected.checklist) ? selected.checklist.join("\n") : "",
    });
  }, [selected]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((row) => {
      const hay = `${row.key} ${row.label || ""} ${row.category || ""} ${row.title || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [messages, filter]);

  const categories = useMemo(() => {
    return [...new Set(messages.map((m) => m.category || "General"))];
  }, [messages]);

  const save = async () => {
    if (!canEdit || !selectedKey || !draft) return;
    setSaving(true);
    try {
      const payload = {
        ...draft,
        checklist: draft.checklist
          ? draft.checklist.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
          : [],
      };
      // Drop empty optional fields so defaults can apply on reset of partial fields
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "" || payload[key] == null) delete payload[key];
      });
      await axios.put(
        `${API}/settings/dialog-messages/${encodeURIComponent(selectedKey)}`,
        payload,
        { withCredentials: true },
      );
      toast.success("Mensaje de diálogo guardado");
      await load();
      await refresh(true);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo guardar el mensaje");
    } finally {
      setSaving(false);
    }
  };

  const resetOne = async () => {
    if (!canEdit || !selectedKey) return;
    if (!window.confirm("¿Restablecer este mensaje a los valores por defecto del sistema?")) return;
    setSaving(true);
    try {
      await axios.post(
        `${API}/settings/dialog-messages/reset`,
        { keys: [selectedKey] },
        { withCredentials: true },
      );
      toast.success("Mensaje restablecido");
      await load();
      await refresh(true);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo restablecer");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Mensajes de diálogos
          </CardTitle>
          <CardDescription>
            Solo gerencia y programadores pueden editar los textos de los cuadros de diálogo.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" />
            Diálogos
          </CardTitle>
          <CardDescription>Elige un mensaje para editarlo.</CardDescription>
          <Input
            placeholder="Buscar…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-2"
          />
        </CardHeader>
        <CardContent className="max-h-[32rem] space-y-1 overflow-y-auto p-2">
          {loading ? (
            <p className="p-3 text-sm text-muted-foreground">Cargando…</p>
          ) : (
            filtered.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setSelectedKey(row.key)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selectedKey === row.key
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium leading-tight">{row.label || row.key}</span>
                  {row.is_customized ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">Editado</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{row.category}</p>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {selected?.label || "Selecciona un diálogo"}
            </CardTitle>
            <CardDescription className="font-mono text-xs">{selectedKey || "—"}</CardDescription>
            {selected?.category ? (
              <Badge variant="secondary" className="mt-2">{selected.category}</Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => load()} disabled={loading || saving}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetOne} disabled={!selectedKey || saving}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Default
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={!draft || saving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!draft ? (
            <p className="text-sm text-muted-foreground">Selecciona un diálogo de la lista.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Variante visual</Label>
                  <Select
                    value={draft.variant || "information"}
                    onValueChange={(value) => setDraft((prev) => ({ ...prev, variant: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VARIANT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Descripción principal</Label>
                <Textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Soporta variables: {count}, {tier}, {product_name}, {amount}…"
                />
                <p className="text-[11px] text-muted-foreground">
                  Variables disponibles según el diálogo: {"{count}"}, {"{tier}"}, {"{product_name}"}, {"{amount}"}.
                </p>
              </div>

              {/* Optional secondary description fields if present in default */}
              {[
                ["description_supervisor", "Texto extra (supervisor)"],
                ["description_precio2", "Texto extra (Precio 2)"],
                ["description_seller", "Descripción (vendedor)"],
                ["description_other", "Descripción (otros roles)"],
                ["description_none", "Banner Precio 2 — sin solicitud"],
                ["description_pending", "Banner Precio 2 — pendiente"],
                ["description_approved", "Banner Precio 2 — aprobado"],
                ["description_rejected", "Banner Precio 2 — rechazado"],
              ].map(([field, label]) => (
                selected && (selected[field] != null || draft[field]) ? (
                  <div key={field} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Textarea
                      rows={2}
                      value={draft[field] || ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [field]: e.target.value }))}
                    />
                  </div>
                ) : null
              ))}

              <div className="space-y-1.5">
                <Label>Checklist (una línea por ítem)</Label>
                <Textarea
                  rows={4}
                  value={draft.checklist}
                  onChange={(e) => setDraft((prev) => ({ ...prev, checklist: e.target.value }))}
                  placeholder={"Ítem 1\nÍtem 2"}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["primary_label", "Botón principal"],
                  ["primary_label_precio2", "Botón principal (Precio 2)"],
                  ["primary_label_pending", "Botón (pendiente)"],
                  ["primary_label_rejected", "Botón (rechazado)"],
                  ["secondary_label", "Botón secundario"],
                  ["tertiary_label", "Botón terciario"],
                  ["submitting_label", "Texto mientras envía"],
                ].map(([field, label]) => (
                  selected && (selected[field] != null || ["primary_label", "secondary_label"].includes(field)) ? (
                    <div key={field} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input
                        value={draft[field] || ""}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [field]: e.target.value }))}
                      />
                    </div>
                  ) : null
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Categorías en catálogo: {categories.join(" · ") || "—"}. Los cambios aplican en toda la app
                al recargar mensajes (automático al guardar).
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DialogMessagesSettingsPanel;
