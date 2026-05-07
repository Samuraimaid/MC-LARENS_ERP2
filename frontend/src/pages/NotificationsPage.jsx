import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { FollowupsPage } from "./FollowupsPage";
import { ApprovalsPage } from "./ApprovalsPage";
import { useTheme } from "@/context/ThemeContext";
import { THEME_SKINS } from "@/lib/themeSkins";
import {
  DEFAULT_UI_SOUND_MUTED,
  DEFAULT_UI_SOUND_PROFILE,
  extractSoundPreferencesFromThemeCustom,
  getStoredSoundPreferences,
  mergeSoundPreferencesIntoThemeCustom,
  persistSoundPreferencesToLocalStorage,
  UI_SOUND_PROFILES,
} from "@/lib/userUiPreferences";
import { Monitor, Moon, Sun, Volume2, VolumeX } from "lucide-react";

export function NotificationsPage() {
  const [notes, setNotes] = useState([]);
  const [processingAction, setProcessingAction] = useState("");
  const [sectionTab, setSectionTab] = useState("notifications");
  const [savingUiPrefs, setSavingUiPrefs] = useState(false);
  const [themeCustom, setThemeCustom] = useState({});
  const { mode, skin, setMode, setSkin, setSystemTheme } = useTheme();
  const [soundMuted, setSoundMuted] = useState(() => getStoredSoundPreferences().muted);
  const [soundProfile, setSoundProfile] = useState(() => getStoredSoundPreferences().profile);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotes();
    fetchUiSettings();
  }, []);

  const fetchUiSettings = async () => {
    try {
      const res = await axios.get(`${API}/settings/theme`, { withCredentials: true });
      const custom = res?.data?.custom && typeof res.data.custom === "object" ? res.data.custom : {};
      setThemeCustom(custom);
      const soundFromServer = extractSoundPreferencesFromThemeCustom(custom);
      const nextMuted = soundFromServer.muted ?? DEFAULT_UI_SOUND_MUTED;
      const nextProfile = soundFromServer.profile || DEFAULT_UI_SOUND_PROFILE;
      setSoundMuted(nextMuted);
      setSoundProfile(nextProfile);
      persistSoundPreferencesToLocalStorage({ muted: nextMuted, profile: nextProfile });
      window.dispatchEvent(new Event("ui:sound-sync"));
    } catch (_) {
      const fallback = getStoredSoundPreferences();
      setSoundMuted(fallback.muted);
      setSoundProfile(fallback.profile);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`${API}/notifications`, { withCredentials: true });
      // already filtered by backend for recipient
      setNotes(res.data || []);
    } catch (e) {
      toast.error("Error al cargar notificaciones");
    }
  };

  const markRead = async (id) => {
    // Optimistic update: mark locally first, update badge via event, then call API
    const prev = notes;
    setNotes(notes.map(n => n.notification_id === id ? { ...n, read: true } : n));
    // notify other components (Sidebar) to refresh unread badge
    try {
      window.dispatchEvent(new CustomEvent('notifications:changed'));
    } catch (_) { /* ignore cross-window dispatch errors */ }
    try {
      await axios.put(`${API}/notifications/${id}/read`, null, { withCredentials: true });
      // refresh list to ensure server state
      fetchNotes();
    } catch (e) {
      toast.error("Error al marcar leída");
      setNotes(prev);
      try { window.dispatchEvent(new CustomEvent('notifications:changed')); } catch(_) { /* ignore */ }
    }
  };

  const deleteNote = async (id) => {
    const prev = notes;
    setNotes(notes.filter(n => n.notification_id !== id));
    try {
      await axios.delete(`${API}/notifications/${id}`, { withCredentials: true });
      try { window.dispatchEvent(new CustomEvent('notifications:changed')); } catch (_) { /* ignore cross-window dispatch errors */ }
      toast.success('Notificación eliminada');
    } catch (e) {
      toast.error('Error al eliminar notificación');
      setNotes(prev);
    }
  };

  const approveSaleRequest = async (notification, actionType) => {
    const metadata = notification?.metadata || {};
    const requestId = metadata.request_id;
    if (!requestId) {
      toast.error("La notificación no tiene request_id");
      return;
    }
    setProcessingAction(requestId + actionType);
    try {
      const endpoint = actionType === "edit"
        ? `${API}/sales/requests/${requestId}/approve-edit`
        : `${API}/sales/requests/${requestId}/approve-cancel`;
      await axios.post(endpoint, {}, { withCredentials: true });
      toast.success(actionType === "edit" ? "Solicitud de edición aprobada" : "Solicitud de anulación aprobada");
      await fetchNotes();
      try { window.dispatchEvent(new CustomEvent('notifications:changed')); } catch (_) { /* ignore */ }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo procesar la solicitud");
    } finally {
      setProcessingAction("");
    }
  };

  const openSaleFromNotification = (notification) => {
    const saleId = notification?.metadata?.sale_id;
    if (!saleId) {
      toast.error("No se encontró sale_id en esta notificación");
      return;
    }
    navigate(`/sales?sale_id=${encodeURIComponent(saleId)}`);
  };

  const persistUiPreferences = async ({ nextMode = mode, nextSkin = skin, nextMuted = soundMuted, nextProfile = soundProfile }) => {
    setSavingUiPrefs(true);
    try {
      const mergedCustom = mergeSoundPreferencesIntoThemeCustom(themeCustom, {
        muted: nextMuted,
        profile: nextProfile,
      });

      await axios.put(
        `${API}/settings/theme`,
        {
          mode: nextMode,
          skin: nextSkin,
          custom: mergedCustom,
        },
        { withCredentials: true }
      );

      setThemeCustom(mergedCustom);
      persistSoundPreferencesToLocalStorage({ muted: nextMuted, profile: nextProfile });
      window.dispatchEvent(new Event("theme:sync"));
      window.dispatchEvent(new Event("ui:sound-sync"));
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudieron guardar las preferencias");
    } finally {
      setSavingUiPrefs(false);
    }
  };

  const handleThemeModeChange = (nextMode) => {
    if (nextMode === "system") {
      setSystemTheme();
    } else {
      setMode(nextMode);
    }
    persistUiPreferences({ nextMode });
  };

  const handleThemeSkinChange = (nextSkin) => {
    setSkin(nextSkin);
    persistUiPreferences({ nextSkin });
  };

  const handleSoundMutedChange = (nextMuted) => {
    setSoundMuted(nextMuted);
    persistUiPreferences({ nextMuted });
  };

  const handleSoundProfileChange = (nextProfile) => {
    setSoundProfile(nextProfile);
    persistUiPreferences({ nextProfile });
  };

  return (
    <div className="p-6 space-y-6">
      <Tabs value={sectionTab} onValueChange={setSectionTab} className="space-y-3">
        <TabsList className="grid h-11 w-full grid-cols-4 rounded-full border bg-card/95 p-1">
          <TabsTrigger value="notifications" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Notificaciones</TabsTrigger>
          <TabsTrigger value="followups" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Seguimientos</TabsTrigger>
          <TabsTrigger value="approvals" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Aprobaciones</TabsTrigger>
          <TabsTrigger value="preferences" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-3">
        {notes.length === 0 ? (
          <div className="text-muted-foreground">No hay notificaciones</div>
        ) : notes.map(n => {
          const requestType = n?.metadata?.type;
          const isSaleRequest = requestType === "sale_edit_request" || requestType === "sale_cancel_request";
          const requestStatus = String(n?.metadata?.request_status || "pending").toLowerCase();
          const canProcessRequest = isSaleRequest && !n.read && requestStatus === "pending";
          return (
          <Card key={n.notification_id}>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="font-medium">{n.message}</div>
                <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                {n?.metadata?.invoice_number ? (
                  <div className="text-xs text-muted-foreground">Factura: {n.metadata.invoice_number}</div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                {!n.read && <Button variant="outline" onClick={() => markRead(n.notification_id)}>Marcar leída</Button>}
                {canProcessRequest && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => openSaleFromNotification(n)}
                    >
                      Abrir factura
                    </Button>
                    {requestType === "sale_edit_request" ? (
                      <Button
                        onClick={() => approveSaleRequest(n, "edit")}
                        disabled={processingAction === `${n?.metadata?.request_id}edit`}
                      >
                        Aprobar edición
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => approveSaleRequest(n, "cancel")}
                        disabled={processingAction === `${n?.metadata?.request_id}cancel`}
                      >
                        Aprobar anulación
                      </Button>
                    )}
                  </>
                )}
                {n.read && <Button variant="ghost" onClick={() => deleteNote(n.notification_id)}>Eliminar</Button>}
              </div>
            </CardContent>
          </Card>
          );
        })}
        </TabsContent>

        <TabsContent value="followups" className="mt-0">
          <div className="rounded-md border bg-background p-1">
            <FollowupsPage />
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-0">
          <div className="rounded-md border bg-background p-1">
            <ApprovalsPage />
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-0">
          <div className="rounded-md border bg-background p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Tema visual</Label>
                  <p className="text-xs text-muted-foreground">Solo aplica después de iniciar sesión y queda guardado en tu perfil.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant={mode === "light" ? "default" : "outline"} onClick={() => handleThemeModeChange("light")} disabled={savingUiPrefs}>
                  <Sun className="mr-2 h-4 w-4" /> Claro
                </Button>
                <Button variant={mode === "dark" ? "default" : "outline"} onClick={() => handleThemeModeChange("dark")} disabled={savingUiPrefs}>
                  <Moon className="mr-2 h-4 w-4" /> Oscuro
                </Button>
                <Button variant={mode === "system" ? "default" : "outline"} onClick={() => handleThemeModeChange("system")} disabled={savingUiPrefs}>
                  <Monitor className="mr-2 h-4 w-4" /> Sistema
                </Button>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Skin</Label>
                <Select value={skin} onValueChange={handleThemeSkinChange} disabled={savingUiPrefs}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un skin" />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_SKINS.map((themeSkin) => (
                      <SelectItem key={themeSkin.id} value={themeSkin.id}>
                        {themeSkin.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Sonidos de interfaz</Label>
                  <p className="text-xs text-muted-foreground">Feedback al seleccionar, agregar o modificar items.</p>
                </div>
                <div className="flex items-center gap-2">
                  {soundMuted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-muted-foreground" />}
                  <Switch checked={soundMuted} onCheckedChange={handleSoundMutedChange} disabled={savingUiPrefs} />
                  <span className="text-xs text-muted-foreground">Silencio total</span>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Perfil de sonido</Label>
                <Select value={soundProfile} onValueChange={handleSoundProfileChange} disabled={savingUiPrefs || soundMuted}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UI_SOUND_PROFILES.SUBTLE}>Sutil</SelectItem>
                    <SelectItem value={UI_SOUND_PROFILES.ARCADE}>Arcade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
