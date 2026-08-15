import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Shield,
  RefreshCw,
  Save,
  Clock,
  Users,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { ReauthPinDialog } from "@/components/auth/ReauthPinDialog";
import { requestReauthToken, withReauthHeader, parseReauthError } from "@/lib/reauth";

const EDITOR_ROLES = new Set(["gerencia", "programador"]);

function formatIdle(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const s = Math.max(0, Number(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function SessionSecuritySettingsPanel() {
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const canEdit = EDITOR_ROLES.has(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [idleVentas, setIdleVentas] = useState("5");
  const [idleDefault, setIdleDefault] = useState("60");
  const [ttlGerencia, setTtlGerencia] = useState("4");
  const [ttlVentas, setTtlVentas] = useState("12");
  const [ttlDefault, setTtlDefault] = useState("12");
  const [reauthTtl, setReauthTtl] = useState("120");
  const [singleSession, setSingleSession] = useState(true);
  const [reauthActions, setReauthActions] = useState({});
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthError, setReauthError] = useState(null);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/settings/session-security`, { withCredentials: true });
      const p = res.data?.policy || {};
      setPolicy(p);
      setCatalog(res.data?.reauth_catalog || []);
      const idle = p.idle_minutes || {};
      const ttl = p.ttl_hours || {};
      setIdleVentas(String(idle.ventas ?? 5));
      setIdleDefault(String(idle.default ?? 60));
      setTtlGerencia(String(ttl.gerencia ?? 4));
      setTtlVentas(String(ttl.ventas ?? 12));
      setTtlDefault(String(ttl.default ?? 12));
      setReauthTtl(String(p.reauth_ttl_seconds ?? 120));
      setSingleSession(p.single_session !== false);
      setReauthActions({ ...(p.reauth_actions || {}) });
    } catch (error) {
      toast.error(error?.response?.data?.detail?.message || error?.response?.data?.detail || "No se pudo cargar la política de sesión");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await axios.get(`${API}/auth/sessions`, { withCredentials: true });
      setSessions(res.data?.sessions || []);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudieron listar las sesiones");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    loadPolicy();
    loadSessions();
  }, [canEdit, loadPolicy, loadSessions]);

  const buildPayload = useMemo(() => {
    return () => ({
      idle_minutes: {
        ...(policy?.idle_minutes || {}),
        ventas: Number(idleVentas) || 5,
        default: Number(idleDefault) || 60,
      },
      ttl_hours: {
        ...(policy?.ttl_hours || {}),
        ventas: Number(ttlVentas) || 12,
        gerencia: Number(ttlGerencia) || 4,
        programador: Number(ttlGerencia) || 4,
        default: Number(ttlDefault) || 12,
      },
      reauth_actions: reauthActions,
      reauth_ttl_seconds: Number(reauthTtl) || 120,
      single_session: Boolean(singleSession),
    });
  }, [
    policy,
    idleVentas,
    idleDefault,
    ttlVentas,
    ttlGerencia,
    ttlDefault,
    reauthActions,
    reauthTtl,
    singleSession,
  ]);

  const runWithReauth = async (actionKey, requestFn) => {
    return new Promise((resolve, reject) => {
      setPendingAction({ actionKey, requestFn, resolve, reject });
      setReauthError(null);
      setReauthOpen(true);
    });
  };

  const handleReauthConfirm = async (pin) => {
    if (!pendingAction) return;
    setReauthLoading(true);
    setReauthError(null);
    try {
      const { reauth_token } = await requestReauthToken(pin, pendingAction.actionKey);
      const result = await pendingAction.requestFn(reauth_token);
      setReauthOpen(false);
      pendingAction.resolve(result);
      setPendingAction(null);
    } catch (error) {
      const info = parseReauthError(error);
      const msg =
        info.message ||
        error?.response?.data?.detail ||
        error?.message ||
        "PIN inválido";
      setReauthError(typeof msg === "string" ? msg : "Error de confirmación");
      // keep dialog open
    } finally {
      setReauthLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      await runWithReauth("settings.session_policy", async (token) => {
        const res = await axios.put(
          `${API}/settings/session-security`,
          payload,
          withReauthHeader({}, token),
        );
        setPolicy(res.data?.policy || payload);
        toast.success("Política de sesión guardada");
        return res.data;
      });
    } catch (error) {
      if (error?.code === "REAUTH_CANCELLED") return;
      toast.error(
        error?.response?.data?.detail?.message ||
          error?.response?.data?.detail ||
          "No se pudo guardar la política",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (sessionToken, userName) => {
    if (!canEdit || !sessionToken) return;
    if (!window.confirm(`¿Cerrar la sesión de ${userName || "este usuario"}?`)) return;
    try {
      await runWithReauth("sessions.revoke", async (token) => {
        await axios.delete(
          `${API}/auth/sessions/${encodeURIComponent(sessionToken)}`,
          withReauthHeader({}, token),
        );
        toast.success("Sesión cerrada");
        await loadSessions();
      });
    } catch (error) {
      if (error?.code === "REAUTH_CANCELLED") return;
      toast.error(error?.response?.data?.detail?.message || error?.response?.data?.detail || "No se pudo cerrar la sesión");
    }
  };

  const toggleReauthAction = (key, enabled) => {
    setReauthActions((prev) => ({ ...prev, [key]: enabled }));
  };

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Seguridad de sesión
          </CardTitle>
          <CardDescription>Solo gerencia y programador pueden configurar timeouts y re-PIN.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Cargando política de sesión…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeouts de inactividad y TTL
          </CardTitle>
          <CardDescription>
            Ventas (piso y VIP, mismo rol <code>ventas</code>): idle por defecto 5 min.
            Resto de roles: 60 min. El TTL absoluto cierra la cookie aunque haya actividad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Idle ventas (min)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={idleVentas}
                onChange={(e) => setIdleVentas(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Piso y VIP comparten rol ventas</p>
            </div>
            <div className="space-y-2">
              <Label>Idle otros roles (min)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={idleDefault}
                onChange={(e) => setIdleDefault(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Default para cajero, bodega, gerencia, etc.</p>
            </div>
            <div className="space-y-2">
              <Label>TTL ventas (horas)</Label>
              <Input
                type="number"
                min={1}
                max={336}
                value={ttlVentas}
                onChange={(e) => setTtlVentas(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>TTL gerencia/programador (horas)</Label>
              <Input
                type="number"
                min={1}
                max={336}
                value={ttlGerencia}
                onChange={(e) => setTtlGerencia(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>TTL default (horas)</Label>
              <Input
                type="number"
                min={1}
                max={336}
                value={ttlDefault}
                onChange={(e) => setTtlDefault(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vida del token re-PIN (seg)</Label>
              <Input
                type="number"
                min={30}
                max={900}
                value={reauthTtl}
                onChange={(e) => setReauthTtl(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Sesión única por usuario</p>
              <p className="text-xs text-muted-foreground">
                Al iniciar sesión se invalidan las sesiones previas del mismo usuario
              </p>
            </div>
            <Switch checked={singleSession} onCheckedChange={setSingleSession} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar política
            </Button>
            <Button variant="outline" onClick={loadPolicy}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
          </div>
          {policy?.updated_at ? (
            <p className="text-xs text-muted-foreground">
              Última actualización: {policy.updated_at}
              {policy.updated_by_name ? ` · ${policy.updated_by_name}` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Acciones que piden PIN de confirmación
          </CardTitle>
          <CardDescription>
            Aplica a todos los roles: al ejecutar la acción se exige reingresar el PIN (token de un solo uso).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {(catalog.length
              ? catalog
              : Object.keys(reauthActions).map((key) => ({ key, label: key, default: false }))
            ).map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{row.label || row.key}</p>
                  <p className="text-xs text-muted-foreground font-mono">{row.key}</p>
                </div>
                <Switch
                  checked={Boolean(reauthActions[row.key])}
                  onCheckedChange={(v) => toggleReauthAction(row.key, v)}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Guarda la política para aplicar cambios de re-PIN. Operaciones de limpieza E2E ya obtienen token automáticamente.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sesiones activas
            </CardTitle>
            <CardDescription>Cierra sesiones remotas (requiere re-PIN).</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions} disabled={sessionsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${sessionsLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No hay sesiones activas.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Idle</TableHead>
                    <TableHead>Límite idle</TableHead>
                    <TableHead>IP / UA</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.session_token || s.session_token_prefix}>
                      <TableCell>
                        <div className="font-medium">{s.user_name}</div>
                        <div className="text-xs text-muted-foreground">{s.email || s.user_id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.role || "—"}</Badge>
                      </TableCell>
                      <TableCell>{formatIdle(s.idle_seconds)}</TableCell>
                      <TableCell>{s.idle_minutes_limit != null ? `${s.idle_minutes_limit} min` : "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {s.ip || "—"}
                        <br />
                        {(s.user_agent || "").slice(0, 48)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRevoke(s.session_token, s.user_name)}
                        >
                          <LogOut className="h-3.5 w-3.5 mr-1" />
                          Cerrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ReauthPinDialog
        open={reauthOpen}
        onOpenChange={(open) => {
          setReauthOpen(open);
          if (!open && pendingAction) {
            const err = new Error("Reauth cancelled");
            err.code = "REAUTH_CANCELLED";
            pendingAction.reject(err);
            setPendingAction(null);
          }
        }}
        title="Confirmar con tu PIN"
        description="Para guardar la política o cerrar sesiones ajenas debes confirmar tu PIN de 8 dígitos."
        actionLabel={pendingAction?.actionKey}
        loading={reauthLoading}
        error={reauthError}
        onConfirm={handleReauthConfirm}
        onCancel={() => {
          if (pendingAction) {
            const err = new Error("Reauth cancelled");
            err.code = "REAUTH_CANCELLED";
            pendingAction.reject(err);
            setPendingAction(null);
          }
        }}
      />
    </div>
  );
}
