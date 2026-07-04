import React, { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { 
  DollarSign, RefreshCw, Globe, Bell, Printer, 
  CheckCircle2, ArrowRightLeft, Save, Download, AlertCircle, Barcode
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  fetchLabelPrinterSetup,
  installLabelPrinterStartupTask,
  printLabelPrinterTest,
  refreshLabelPrinterStatus,
} from "@/lib/labelPrinterSetup";

export function SystemSettingsContent({ forcedSection = null, showPageHeader = true, showBackupButton = true } = {}) {
  const { hasPermission } = useAuth();
  const canManageSystemSettings = hasPermission("system_settings", "view");
  const canInstallLabelPrinter = hasPermission("system_settings", "create");
  const [currencies, setCurrencies] = useState({});
  const [rates, setRates] = useState({});
  const [systemCurrency, setSystemCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  
  // Convert form
  const [convertFrom, setConvertFrom] = useState("USD");
  const [convertTo, setConvertTo] = useState("EUR");
  const [convertAmount, setConvertAmount] = useState("100");
  const [convertResult, setConvertResult] = useState(null);
  
  // Rate update form
  const [editingRate, setEditingRate] = useState({ from: "USD", to: "EUR", rate: "" });
  const [labelPrinterSetup, setLabelPrinterSetup] = useState(null);
  const [labelPrinterLoading, setLabelPrinterLoading] = useState(false);
  const [labelPrinterInstalling, setLabelPrinterInstalling] = useState(false);
  const [labelPrinterTesting, setLabelPrinterTesting] = useState(false);
  const [stationName, setStationName] = useState("PC Bodega");
  const [labelPrinterWarehouseId, setLabelPrinterWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [currenciesRes, settingsRes, ratesRes] = await Promise.all([
        axios.get(`${API}/currencies`, { withCredentials: true }),
        axios.get(`${API}/settings/currency`, { withCredentials: true }),
        axios.get(`${API}/currencies/rates?base=USD`, { withCredentials: true }),
      ]);
      setCurrencies(currenciesRes.data.currencies);
      setSystemCurrency(settingsRes.data.currency);
      setRates(ratesRes.data.rates || {});
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    checkPushSupport();
  }, [fetchData]);

  const checkPushSupport = () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      // Check if already subscribed
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          setPushEnabled(!!subscription);
        });
      });
    }
  };

  const togglePushNotifications = async () => {
    if (!pushSupported) {
      toast.error("Tu navegador no soporta notificaciones push");
      return;
    }

    try {
      if (pushEnabled) {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await axios.delete(`${API}/push/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, { withCredentials: true });
        }
        setPushEnabled(false);
        toast.success("Notificaciones desactivadas");
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error("Permiso de notificaciones denegado");
          return;
        }
        
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
        });
        
        await axios.post(`${API}/push/subscribe`, {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
          }
        }, { withCredentials: true });
        
        setPushEnabled(true);
        toast.success("Notificaciones activadas");
      }
    } catch (error) {
      toast.error("Error al configurar notificaciones");
      console.error(error);
    }
  };

  const setDefaultCurrency = async (currency) => {
    try {
      await axios.put(`${API}/settings/currency?currency=${currency}`, {}, { withCredentials: true });
      setSystemCurrency(currency);
      toast.success(`Moneda del sistema: ${currency}`);
    } catch (error) {
      toast.error("Error al cambiar moneda");
    }
  };

  const convertCurrency = async () => {
    if (!convertAmount || parseFloat(convertAmount) <= 0) return;
    try {
      const res = await axios.get(
        `${API}/currencies/convert?amount=${convertAmount}&from_currency=${convertFrom}&to_currency=${convertTo}`,
        { withCredentials: true }
      );
      setConvertResult(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al convertir");
    }
  };

  const updateRate = async () => {
    if (!editingRate.rate || parseFloat(editingRate.rate) <= 0) {
      toast.error("Ingresa una tasa válida");
      return;
    }
    try {
      await axios.put(`${API}/currencies/rates`, {
        from_currency: editingRate.from,
        to_currency: editingRate.to,
        rate: parseFloat(editingRate.rate)
      }, { withCredentials: true });
      toast.success("Tasa actualizada");
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar tasa");
    }
  };

  const loadLabelPrinterSetup = useCallback(async () => {
    if (!canManageSystemSettings) return;
    setLabelPrinterLoading(true);
    try {
      const data = await fetchLabelPrinterSetup();
      setLabelPrinterSetup(data);
      if (data?.stored?.station_name) {
        setStationName(data.stored.station_name);
      }
      if (data?.stored?.warehouse_id) {
        setLabelPrinterWarehouseId(data.stored.warehouse_id);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo cargar configuración de etiquetas");
    } finally {
      setLabelPrinterLoading(false);
    }
  }, [canManageSystemSettings]);

  const loadWarehouses = useCallback(async () => {
    if (!canManageSystemSettings) return;
    try {
      const response = await axios.get(`${API}/warehouses`, { withCredentials: true });
      const rows = Array.isArray(response.data) ? response.data : response.data?.warehouses || [];
      setWarehouses(rows);
      setLabelPrinterWarehouseId((current) => current || rows[0]?.warehouse_id || "");
    } catch (error) {
      console.error("Error loading warehouses:", error);
    }
  }, [canManageSystemSettings]);

  useEffect(() => {
    loadLabelPrinterSetup();
    loadWarehouses();
  }, [loadLabelPrinterSetup, loadWarehouses]);

  const handleRefreshLabelPrinter = async () => {
    setLabelPrinterLoading(true);
    try {
      await refreshLabelPrinterStatus();
      await loadLabelPrinterSetup();
      toast.success("Estado de impresora actualizado");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo verificar la impresora");
    } finally {
      setLabelPrinterLoading(false);
    }
  };

  const handleTestLabelPrint = async () => {
    if (!canInstallLabelPrinter) {
      toast.error("No tienes permiso para probar la impresora de bodega");
      return;
    }
    setLabelPrinterTesting(true);
    try {
      const result = await printLabelPrinterTest({
        station_name: stationName.trim() || "PC Bodega",
        warehouse_id: labelPrinterWarehouseId || undefined,
      });
      await loadLabelPrinterSetup();
      toast.success(result.message || "Etiqueta de prueba enviada");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo imprimir la etiqueta de prueba");
    } finally {
      setLabelPrinterTesting(false);
    }
  };

  const handleInstallLabelStartupTask = async () => {
    if (!canInstallLabelPrinter) {
      toast.error("No tienes permiso para configurar la impresora de bodega");
      return;
    }
    setLabelPrinterInstalling(true);
    try {
      const result = await installLabelPrinterStartupTask({
        station_name: stationName.trim() || "PC Bodega",
        warehouse_id: labelPrinterWarehouseId || undefined,
      });
      setLabelPrinterSetup((prev) => ({
        ...(prev || {}),
        setup: result.setup,
        stored: result.stored,
        steps: (prev?.steps || []).map((step) =>
          step.id === "autostart" ? { ...step, complete: true } : step
        ),
      }));
      toast.success(result.message || "Inicio automático configurado");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo registrar la tarea automática");
    } finally {
      setLabelPrinterInstalling(false);
    }
  };

  const testThermalPrint = async () => {
    try {
      const res = await axios.get(`${API}/print/thermal/test`, { withCredentials: true });
      toast.success("Comandos de prueba generados");
      
      // Show instructions
      toast.info("Copia los comandos y envíalos a tu impresora térmica", { duration: 5000 });
      console.log("Print commands (base64):", res.data.commands_base64);
    } catch (error) {
      toast.error("Error al generar prueba de impresión");
    }
  };

  const downloadExcelBackup = async () => {
    setBackingUp(true);
    try {
      const response = await axios.get(`${API}/backup/excel`, {
        withCredentials: true,
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `erp_full_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Respaldo Excel descargado");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo descargar respaldo");
    } finally {
      setBackingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const sectionMap = {
    monedas: "currency",
    notificaciones: "notifications",
    impresoras: "printer",
  };
  const resolvedSection = forcedSection ? sectionMap[forcedSection] || forcedSection : "currency";

  return (
    <div className={showPageHeader ? "p-6 space-y-6" : "space-y-6"} data-testid="system-settings-page">
      {showPageHeader ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
            <p className="text-muted-foreground">Monedas, notificaciones e impresora</p>
          </div>
          {showBackupButton ? (
            <Button onClick={downloadExcelBackup} disabled={backingUp} data-testid="download-backup-btn-system">
              {backingUp ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Descargar Respaldo
            </Button>
          ) : null}
        </div>
      ) : null}

      <Tabs value={resolvedSection} className="space-y-6 animate-fade-up-soft">
        {!forcedSection ? (
          <TabsList className="flex h-auto w-full flex-wrap gap-2 rounded-md border bg-card p-1.5">
            <TabsTrigger value="currency" className="gap-2 rounded-full">
              <DollarSign className="h-4 w-4" />
              Monedas
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 rounded-full">
              <Bell className="h-4 w-4" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger value="printer" className="gap-2 rounded-full">
              <Printer className="h-4 w-4" />
              Impresora
            </TabsTrigger>
          </TabsList>
        ) : null}

        {/* Currency Tab */}
        <TabsContent value="currency" className="space-y-6">
          {/* System Currency */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Moneda del Sistema
              </CardTitle>
              <CardDescription>Moneda predeterminada para precios y reportes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select value={systemCurrency} onValueChange={setDefaultCurrency}>
                  <SelectTrigger className="w-64" data-testid="system-currency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(currencies).map(([code, info]) => (
                      <SelectItem key={code} value={code}>
                        {info.symbol} {code} - {info.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {currencies[systemCurrency]?.symbol} {systemCurrency}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Currency Converter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Convertidor de Monedas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div>
                  <Label>De</Label>
                  <Select value={convertFrom} onValueChange={setConvertFrom}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(currencies).map(code => (
                        <SelectItem key={code} value={code}>{code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>A</Label>
                  <Select value={convertTo} onValueChange={setConvertTo}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(currencies).map(code => (
                        <SelectItem key={code} value={code}>{code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={convertCurrency}>Convertir</Button>
                {convertResult && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Resultado:</p>
                    <p className="text-xl font-bold">
                      {convertResult.symbol}{convertResult.converted.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tasa: 1 {convertFrom} = {convertResult.rate} {convertTo}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Exchange Rates */}
          <Card>
            <CardHeader>
              <CardTitle>Tasas de Cambio</CardTitle>
              <CardDescription>Actualizar tasas de conversión (base USD)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tasa (1 USD =)</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(currencies).filter(([code]) => code !== "USD").map(([code, info]) => (
                    <TableRow key={code}>
                      <TableCell className="font-mono font-medium">{info.symbol} {code}</TableCell>
                      <TableCell>{info.name}</TableCell>
                      <TableCell className="font-mono">
                        {rates[code] ? rates[code].toFixed(info.decimal_places === 0 ? 0 : 2) : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingRate({ from: "USD", to: code, rate: rates[code]?.toString() || "" })}
                            >
                              Editar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Actualizar Tasa: USD → {code}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>1 USD equivale a:</Label>
                                <div className="flex items-center gap-2 mt-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editingRate.rate}
                                    onChange={(e) => setEditingRate({ ...editingRate, rate: e.target.value })}
                                    placeholder="0.00"
                                  />
                                  <span className="font-mono font-medium">{code}</span>
                                </div>
                              </div>
                              <Button onClick={updateRate} className="w-full">
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Tasa
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificaciones Push
              </CardTitle>
              <CardDescription>
                Recibe alertas en tiempo real sobre órdenes de trabajo, entregas y más
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notificaciones Push</p>
                  <p className="text-sm text-muted-foreground">
                    {pushSupported 
                      ? "Recibe notificaciones incluso cuando la app está cerrada"
                      : "Tu navegador no soporta notificaciones push"}
                  </p>
                </div>
                <Switch
                  checked={pushEnabled}
                  onCheckedChange={togglePushNotifications}
                  disabled={!pushSupported}
                />
              </div>
              
              {pushEnabled && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700">Notificaciones Activas</p>
                    <p className="text-sm text-green-600">Recibirás alertas de órdenes de trabajo y actualizaciones</p>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Tipos de notificaciones:</p>
                <ul className="text-sm space-y-1">
                  <li>• Nuevas órdenes de trabajo asignadas</li>
                  <li>• Cambios de estado en órdenes</li>
                  <li>• Entregas asignadas (rol transporte)</li>
                  <li>• Alertas de stock bajo (supervisores)</li>
                  <li>• Reclamos de garantía</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Printer Tab */}
        <TabsContent value="printer" className="space-y-6">
          {canManageSystemSettings ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Barcode className="h-5 w-5" />
                  Impresora de Etiquetas (Bodega / Almacén)
                </CardTitle>
                <CardDescription>
                  Instalación de Xprinter XP-460B con etiquetas 50×100 mm horizontales e inicio automático del puente USB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">Puente local</div>
                    <div className="mt-2">
                      {labelPrinterSetup?.setup?.bridge_reachable ? (
                        <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                          <AlertCircle className="mr-1 h-3.5 w-3.5" />
                          No detectado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">Impresora USB</div>
                    <div className="mt-2">
                      {labelPrinterSetup?.setup?.connected ? (
                        <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          {labelPrinterSetup?.setup?.printer_name || "Conectada"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                          <AlertCircle className="mr-1 h-3.5 w-3.5" />
                          No conectada
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bodega asociada</Label>
                    <Select
                      value={labelPrinterWarehouseId || undefined}
                      onValueChange={(value) => {
                        setLabelPrinterWarehouseId(value);
                        const selected = warehouses.find((entry) => entry.warehouse_id === value);
                        if (selected?.name) {
                          setStationName(selected.name);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar bodega" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de estación / PC de bodega</Label>
                    <Input
                      value={stationName}
                      onChange={(event) => setStationName(event.target.value)}
                      placeholder="Ej: PC-Bodega-Central"
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <h4 className="font-medium mb-3">Checklist de instalación</h4>
                  <ol className="space-y-2 text-sm">
                    {(labelPrinterSetup?.steps || []).map((step) => (
                      <li key={step.id} className="flex items-start gap-2">
                        {step.complete ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                        )}
                        <span>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {labelPrinterSetup?.setup?.port_issue === "virtual_file_port" ? (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                    <p className="font-medium">Puerto FILE detectado — no imprimirá físicamente</p>
                    <p className="mt-1">
                      Windows abre un cuadro para guardar archivo. En Propiedades de la impresora Xprinter XP-460B,
                      pestaña <strong>Puertos</strong>, activa <strong>USB00x</strong> y desactiva <strong>FILE:</strong>.
                    </p>
                  </div>
                ) : null}

                {!labelPrinterSetup?.setup?.bridge_reachable ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Paso previo en la PC del almacén</p>
                    <p className="mt-1">
                      Ejecuta una vez: <code>scripts/start-label-print-bridge.ps1</code>
                    </p>
                    <p className="mt-1">
                      Luego vuelve aquí para registrar el inicio automático.
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRefreshLabelPrinter}
                    disabled={labelPrinterLoading}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${labelPrinterLoading ? "animate-spin" : ""}`} />
                    Verificar conexión
                  </Button>
                  <Button
                    onClick={handleInstallLabelStartupTask}
                    disabled={
                      !canInstallLabelPrinter
                      || labelPrinterInstalling
                      || !labelPrinterSetup?.setup?.bridge_reachable
                      || labelPrinterSetup?.setup?.autostart_configured
                    }
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    {labelPrinterSetup?.setup?.autostart_configured
                      ? "Inicio automático ya configurado"
                      : "Registrar inicio automático"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleTestLabelPrint}
                    disabled={
                      !canInstallLabelPrinter
                      || labelPrinterTesting
                      || !labelPrinterSetup?.setup?.bridge_reachable
                      || !labelPrinterSetup?.setup?.connected
                    }
                  >
                    <Barcode className="mr-2 h-4 w-4" />
                    {labelPrinterTesting ? "Imprimiendo prueba..." : "Imprimir etiqueta de prueba"}
                  </Button>
                </div>

                {labelPrinterSetup?.stored?.startup_task_installed_at ? (
                  <p className="text-xs text-muted-foreground">
                    Última configuración: {labelPrinterSetup.stored.installed_by_name || "Sistema"} ·{" "}
                    {new Date(labelPrinterSetup.stored.startup_task_installed_at).toLocaleString()}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Impresora Térmica (80mm)
              </CardTitle>
              <CardDescription>
                Configuración para impresora de tickets ESC/POS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Impresoras Soportadas</h4>
                <p className="text-sm text-muted-foreground">
                  Compatible con impresoras térmicas de 80mm que usen protocolo ESC/POS:
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• Epson TM-T88</li>
                  <li>• Star TSP100/TSP650</li>
                  <li>• Bixolon SRP-350</li>
                  <li>• Genéricas ESC/POS</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Prueba de Impresión</h4>
                <p className="text-sm text-muted-foreground">
                  Genera comandos de prueba para verificar la configuración
                </p>
                <Button onClick={testThermalPrint} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Generar Prueba
                </Button>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Documentos Imprimibles</h4>
                <ul className="text-sm space-y-1">
                  <li>• <strong>Recibos de Venta:</strong> Desde la página de ventas</li>
                  <li>• <strong>Órdenes de Trabajo:</strong> Desde órdenes de trabajo</li>
                  <li>• <strong>Tickets Personalizados:</strong> Vía API</li>
                </ul>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Conexión de Impresora</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Para conectar la impresora a este sistema:
                </p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Conecta la impresora por USB o red</li>
                  <li>Instala el driver de tu impresora</li>
                  <li>Usa una aplicación puente (como QZ Tray) para enviar comandos</li>
                  <li>O copia los comandos generados y envíalos manualmente</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function SystemSettingsPage() {
  return <Navigate to="/settings?tab=monedas" replace />;
}
