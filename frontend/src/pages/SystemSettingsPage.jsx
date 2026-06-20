import React, { useState, useEffect, useCallback } from "react";
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
  CheckCircle2, ArrowRightLeft, Save, Download
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";

export function SystemSettingsPage() {
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

  return (
    <div className="p-6 space-y-6" data-testid="system-settings-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
          <p className="text-muted-foreground">Monedas, notificaciones e impresora</p>
        </div>
        <Button onClick={downloadExcelBackup} disabled={backingUp} data-testid="download-backup-btn-system">
          {backingUp ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Descargar Respaldo
        </Button>
      </div>

      <Tabs defaultValue="currency" className="space-y-6">
        <TabsList>
          <TabsTrigger value="currency" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Monedas
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="printer" className="gap-2">
            <Printer className="h-4 w-4" />
            Impresora
          </TabsTrigger>
        </TabsList>

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
