import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Wifi,
  WifiOff,
  Clock,
  ShieldCheck,
  Smartphone,
  Laptop,
  RefreshCw,
  Save,
  Trash2,
  Users,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export function HotspotManagementPanel() {
  const [settings, setSettings] = useState({
    enabled: true,
    ssid_name: "MC-LARENS Clientes VIP",
    expiration_mode: "closing_time",
    closing_time_str: "19:00",
    duration_hours: 24,
    welcome_message: "¡Bienvenido a MC-LARENS! Disfrute de conexión WiFi de alta velocidad mientras atendemos su vehículo.",
    download_speed_limit_mbps: 15,
    upload_speed_limit_mbps: 5,
  });

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [settingsRes, clientsRes] = await Promise.all([
        axios.get(`${API}/hotspot/settings`, { withCredentials: true }),
        axios.get(`${API}/hotspot/clients`, { withCredentials: true }),
      ]);
      if (settingsRes.data) {
        setSettings((prev) => ({ ...prev, ...settingsRes.data }));
      }
      setClients(clientsRes.data?.clients || []);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) toast.error("Error al cargar configuración del Hotspot");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/hotspot/settings`, settings, { withCredentials: true });
      toast.success("Configuración del Hotspot guardada y sincronizada con el Mini PC");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectClient = async (mac) => {
    try {
      await axios.post(`${API}/hotspot/clients/${mac}/disconnect`, {}, { withCredentials: true });
      toast.success(`Dispositivo ${mac} desconectado`);
      setClients((prev) => prev.filter((c) => c.mac_address !== mac));
    } catch (err) {
      toast.error("Error al desconectar cliente");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-sky-600/10 via-indigo-600/10 to-transparent border border-sky-200 dark:border-sky-900 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/20">
            <Wifi className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Hotspot WiFi para Clientes (Mini PC HP)
              <Badge className={settings.enabled ? "bg-emerald-600 text-white" : "bg-zinc-500 text-white"}>
                {settings.enabled ? "Activo" : "Desactivado"}
              </Badge>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Control de acceso cautivo, límites de velocidad y políticas de expiración en sala de espera
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchData(false)}
            disabled={loading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={saving}
            className="h-9 gap-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-md shadow-sky-600/20"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form Column */}
        <Card className="lg:col-span-1 border-slate-200 dark:border-zinc-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-4 w-4 text-sky-600" />
              Parámetros de Red
            </CardTitle>
            <CardDescription className="text-xs">
              Configura el SSID, corte de sesión y ancho de banda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <Label htmlFor="hotspot-enabled" className="cursor-pointer">
                Habilitar Red de Clientes
              </Label>
              <Switch
                id="hotspot-enabled"
                checked={settings.enabled}
                onCheckedChange={(val) => setSettings({ ...settings, enabled: val })}
              />
            </div>

            <div>
              <Label>Nombre de la Red (SSID)</Label>
              <Input
                value={settings.ssid_name}
                onChange={(e) => setSettings({ ...settings, ssid_name: e.target.value })}
                placeholder="MC-LARENS Clientes VIP"
                className="mt-1 font-semibold"
              />
            </div>

            <div>
              <Label>Política de Expiración / Corte</Label>
              <Select
                value={settings.expiration_mode}
                onValueChange={(val) => setSettings({ ...settings, expiration_mode: val })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closing_time">Corte al Cierre de Sucursal (ej. 7:00 PM)</SelectItem>
                  <SelectItem value="duration_hours">Duración Fija (ej. 24 horas continuas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.expiration_mode === "closing_time" ? (
              <div>
                <Label>Hora de Corte Diario</Label>
                <Input
                  type="time"
                  value={settings.closing_time_str}
                  onChange={(e) => setSettings({ ...settings, closing_time_str: e.target.value })}
                  className="mt-1 font-mono"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Todos los clientes se desconectan automáticamente a las {settings.closing_time_str} hrs.
                </p>
              </div>
            ) : (
              <div>
                <Label>Duración de la Conexión (Horas)</Label>
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={settings.duration_hours}
                  onChange={(e) => setSettings({ ...settings, duration_hours: Number(e.target.value) })}
                  className="mt-1 font-mono"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  El cliente navegará durante {settings.duration_hours} horas desde su registro.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs">Descarga (Mbps)</Label>
                <Input
                  type="number"
                  value={settings.download_speed_limit_mbps}
                  onChange={(e) => setSettings({ ...settings, download_speed_limit_mbps: Number(e.target.value) })}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Subida (Mbps)</Label>
                <Input
                  type="number"
                  value={settings.upload_speed_limit_mbps}
                  onChange={(e) => setSettings({ ...settings, upload_speed_limit_mbps: Number(e.target.value) })}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Mensaje de Bienvenida del Portal</Label>
              <textarea
                value={settings.welcome_message}
                onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                rows={3}
                className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent"
              />
            </div>
          </CardContent>
        </Card>

        {/* Connected Clients Column */}
        <Card className="lg:col-span-2 border-slate-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                Clientes Conectados en Sala de Espera ({clients.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Dispositivos autenticados por el Mini PC HP en tiempo real
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-[11px]">
              Sync: {lastUpdated.toLocaleTimeString()}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {clients.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs">
                No hay clientes conectados al Hotspot en este momento.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispositivo / Cliente</TableHead>
                    <TableHead>Dirección MAC / IP</TableHead>
                    <TableHead>Conectado</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.mac_address}>
                      <TableCell>
                        <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                          {c.customer_name || "Cliente en Sala"}
                        </div>
                        {c.invoice_number ? (
                          <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 block">
                            Factura: {c.invoice_number}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 block">
                          {c.mac_address}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {c.ip_address || "DHCP Dinámico"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {c.connected_at ? new Date(c.connected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/D"}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {c.expires_at ? new Date(c.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Al cierre"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDisconnectClient(c.mac_address)}
                          className="h-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        >
                          <WifiOff className="h-3.5 w-3.5 mr-1" />
                          Desconectar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
