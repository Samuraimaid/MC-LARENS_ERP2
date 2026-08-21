import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { RefreshCw, Building2, Warehouse, KeyRound, Trash2, Eye, EyeOff, Shield } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { formatPhone } from "@/lib/formatters";
import { UserDirectoryPicker } from "@/components/users/UserDirectoryPicker";
import { UserDirectoryFilters } from "@/components/users/UserDirectoryFilters";
import { FilterCombobox } from "@/components/users/FilterCombobox";
import { DirectoryPagination } from "@/components/users/DirectoryPagination";
import { useUserDirectory } from "@/hooks/useUserDirectory";
import { SELLER_TYPES } from "@/lib/priceTiers";

// Roles will be loaded from backend `/api/roles` when available; fall back to local `ROLES`.
const PERMISSION_ACTIONS = ["create", "view", "edit", "delete"];
const ACTION_LABELS = {
  create: "Crear",
  view: "Ver",
  edit: "Editar",
  delete: "Eliminar",
};

const getErrorMessage = (error, fallback = "Ocurrió un error inesperado") => {
  const detail = error?.response?.data?.detail ?? error?.message;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    return detail.message || detail.error || JSON.stringify(detail);
  }
  return fallback;
};

export function UsersAdminPage() {
  const { user, loading: authLoading, hasPermission, hasRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [pinUsers, setPinUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [rolesMap, setRolesMap] = useState(ROLES);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pin");

  const pinDirectory = useUserDirectory({
    active: activeTab === "pin",
    pageSize: 25,
    pinOnly: true,
  });
  
  // (Google auth removed)
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editSellerType, setEditSellerType] = useState("piso");
  const [editBranch, setEditBranch] = useState("");
  const [editWarehouse, setEditWarehouse] = useState("");
  const [editBaseSalary, setEditBaseSalary] = useState("");
  const [editEarnsCommissions, setEditEarnsCommissions] = useState(false);
  const [editHasSocialSecurity, setEditHasSocialSecurity] = useState(false);
  const [editEligibleAttendanceBonus, setEditEligibleAttendanceBonus] = useState(false);
  
  // PIN user dialogs
  const [showCreatePin, setShowCreatePin] = useState(false);
  const [pinForm, setPinForm] = useState({
    name: "",
    last_name: "",
    phone: "",
    role: "ventas",
    seller_type: "piso",
    pin: "",
    login_pin: "",
    branch_id: "",
    warehouse_id: "",
    base_salary: "",
    earns_commissions: false,
    has_social_security: false,
    eligible_for_attendance_bonus: false,
  });
  const [showPin, setShowPin] = useState(false);
  const [editingPinUser, setEditingPinUser] = useState(null);
  const [newPin, setNewPin] = useState("");
  const [editingKioskPinUser, setEditingKioskPinUser] = useState(null);
  const [newKioskPin, setNewKioskPin] = useState("");
  const [kioskPinsTable, setKioskPinsTable] = useState([]);
  const [loadingKioskPins, setLoadingKioskPins] = useState(false);
  const [syncingKioskPins, setSyncingKioskPins] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Permissions panel
  const [permissionsCatalog, setPermissionsCatalog] = useState(null);
  const [rolePermissionsMap, setRolePermissionsMap] = useState({});
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState("ventas");
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState("");
  const [rolePermissionsDraft, setRolePermissionsDraft] = useState(null);
  const [userEffectiveDraft, setUserEffectiveDraft] = useState(null);
  const [userRoleBaseline, setUserRoleBaseline] = useState(null);
  const [userPermissionsOverlay, setUserPermissionsOverlay] = useState(null);
  const [hasUserOverrides, setHasUserOverrides] = useState(false);
  const [permissionsTargetLabel, setPermissionsTargetLabel] = useState("");
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingRolePermissions, setSavingRolePermissions] = useState(false);
  const [savingUserPermissions, setSavingUserPermissions] = useState(false);
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState(false);

  const canCreateUsers = hasPermission("users", "create");
  const canEditUsers = hasPermission("users", "edit");
  const canDeleteUsers = hasPermission("users", "delete");
  const canManagePermissions = canEditUsers && hasRole(["gerencia"]);
  const selectedRoleIsBase = Boolean(ROLES?.[selectedRoleForPermissions]);

  const loadRolesCatalog = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/roles`, { withCredentials: true });
      if (res?.data) setRolesMap(res.data);
    } catch (e) {
      // ignore, fallback to local ROLES
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, branchesRes, warehousesRes, kioskPinsRes] = await Promise.all([
        axios.get(`${API}/users`, { withCredentials: true }),
        axios.get(`${API}/branches`, { withCredentials: true }),
        axios.get(`${API}/warehouses`, { withCredentials: true }),
        axios.get(`${API}/users/pin/kiosk-table`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);
      const allPinUsers = usersRes.data.filter(u => u.is_pin_user);
      setUsers(allPinUsers);
      setPinUsers(allPinUsers);
      setBranches(branchesRes.data);
      setWarehouses(warehousesRes.data);
      setKioskPinsTable(Array.isArray(kioskPinsRes.data) ? kioskPinsRes.data : []);
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (status === 403) {
        toast.error(
          typeof detail === "string"
            ? detail
            : "No tienes permiso para ver usuarios. Contacta a soporte si eres gerencia."
        );
      } else {
        toast.error("Error al cargar usuarios");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPermissionsBase = useCallback(async () => {
    setLoadingPermissions(true);
    try {
      const [catalogRes, roleRes] = await Promise.all([
        axios.get(`${API}/permissions/catalog`, { withCredentials: true }),
        axios.get(`${API}/permissions/roles`, { withCredentials: true }),
      ]);
      setPermissionsCatalog(catalogRes.data || null);
      setRolePermissionsMap(roleRes.data || {});
    } catch (error) {
      toast.error("Error al cargar catálogo de permisos");
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  const beginRolePermissionEdit = useCallback((role) => {
    setSelectedRoleForPermissions(role);
    const matrix = rolePermissionsMap?.[role];
    setRolePermissionsDraft(matrix ? JSON.parse(JSON.stringify(matrix)) : null);
    setPermissionsTargetLabel(`Rol: ${(rolesMap && rolesMap[role]?.label) || role}`);
  }, [rolePermissionsMap, rolesMap]);

  useEffect(() => {
    if (authLoading) return;
    // If user is not authenticated, avoid calling protected endpoints that require session cookies
    if (!user) {
      setUsers([]);
      setPinUsers([]);
      setBranches([]);
      setWarehouses([]);
      setLoading(false);
      // still attempt to fetch roles (public) but do not block UI
      loadRolesCatalog();
      return;
    }

    fetchData();
    // fetch roles catalog from backend
    loadRolesCatalog();

    if (canManagePermissions) {
      loadPermissionsBase();
    }
  }, [authLoading, canManagePermissions, fetchData, loadPermissionsBase, loadRolesCatalog, user]);

  useEffect(() => {
    if (
      activeTab === "role-permissions" &&
      canManagePermissions &&
      !rolePermissionsDraft
    ) {
      beginRolePermissionEdit(selectedRoleForPermissions || "ventas");
    }
  }, [
    activeTab,
    canManagePermissions,
    rolePermissionsDraft,
    selectedRoleForPermissions,
    beginRolePermissionEdit,
  ]);

  const beginUserPermissionEdit = async (userId) => {
    if (!userId) {
      setSelectedUserForPermissions("");
      setUserEffectiveDraft(null);
      setUserRoleBaseline(null);
      setUserPermissionsOverlay(null);
      setHasUserOverrides(false);
      setPermissionsTargetLabel("Selecciona un usuario");
      return;
    }
    setSelectedUserForPermissions(userId);
    setLoadingPermissions(true);
    try {
      const res = await axios.get(`${API}/permissions/users/${userId}`, { withCredentials: true });
      const effective = res?.data?.effective_permissions || null;
      setUserEffectiveDraft(effective ? JSON.parse(JSON.stringify(effective)) : null);
      setUserRoleBaseline(
        res?.data?.role_permissions
          ? JSON.parse(JSON.stringify(res.data.role_permissions))
          : null
      );
      setUserPermissionsOverlay(
        res?.data?.user_permissions
          ? JSON.parse(JSON.stringify(res.data.user_permissions))
          : null
      );
      setHasUserOverrides(Boolean(res?.data?.has_user_overrides));
      const targetUser =
        pinDirectory.rows.find((u) => u.user_id === userId)
        || pinUsers.find((u) => u.user_id === userId)
        || users.find((u) => u.user_id === userId);
      const displayName = targetUser?.display_name || targetUser?.name || userId;
      setPermissionsTargetLabel(
        `Usuario: ${displayName} · Rol: ${res?.data?.role || "sin rol"}`
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar permisos del usuario"));
    } finally {
      setLoadingPermissions(false);
    }
  };

  const updatePermissionDraft = (setter, moduleKey, functionKey, action, checked) => {
    setter((prev) => {
      if (!prev?.[moduleKey]?.[functionKey]) return prev;
      return {
        ...prev,
        [moduleKey]: {
          ...prev[moduleKey],
          [functionKey]: {
            ...prev[moduleKey][functionKey],
            [action]: Boolean(checked),
          },
        },
      };
    });
  };

  const toggleRolePermission = (moduleKey, functionKey, action, checked) => {
    updatePermissionDraft(setRolePermissionsDraft, moduleKey, functionKey, action, checked);
  };

  const toggleUserPermission = (moduleKey, functionKey, action, checked) => {
    updatePermissionDraft(setUserEffectiveDraft, moduleKey, functionKey, action, checked);
  };

  const isUserPermissionOverridden = (moduleKey, functionKey, action) => {
    const overlayAction = userPermissionsOverlay?.[moduleKey]?.[functionKey]?.[action];
    if (overlayAction !== undefined) {
      return true;
    }
    const roleValue = Boolean(userRoleBaseline?.[moduleKey]?.[functionKey]?.[action]);
    const effectiveValue = Boolean(userEffectiveDraft?.[moduleKey]?.[functionKey]?.[action]);
    return roleValue !== effectiveValue;
  };

  const saveRolePermissions = async () => {
    if (!canEditUsers) {
      toast.error("No tienes permiso para editar permisos");
      return;
    }
    if (!rolePermissionsDraft || !selectedRoleForPermissions) return;
    setSavingRolePermissions(true);
    try {
      const res = await axios.put(
        `${API}/permissions/roles/${selectedRoleForPermissions}`,
        { permissions: rolePermissionsDraft },
        { withCredentials: true }
      );
      toast.success("Permisos de rol actualizados");
      await loadPermissionsBase();
      const refreshed = res?.data?.effective_permissions;
      if (refreshed) {
        setRolePermissionsDraft(JSON.parse(JSON.stringify(refreshed)));
      } else {
        beginRolePermissionEdit(selectedRoleForPermissions);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar permisos de rol"));
    } finally {
      setSavingRolePermissions(false);
    }
  };

  const saveUserPermissions = async () => {
    if (!canEditUsers) {
      toast.error("No tienes permiso para editar permisos");
      return;
    }
    if (!userEffectiveDraft || !selectedUserForPermissions) return;
    setSavingUserPermissions(true);
    try {
      const res = await axios.put(
        `${API}/permissions/users/${selectedUserForPermissions}`,
        { effective_permissions: userEffectiveDraft },
        { withCredentials: true }
      );
      toast.success("Permisos personalizados del usuario actualizados");
      if (res?.data?.effective_permissions) {
        setUserEffectiveDraft(JSON.parse(JSON.stringify(res.data.effective_permissions)));
      }
      setUserPermissionsOverlay(
        res?.data?.user_permissions
          ? JSON.parse(JSON.stringify(res.data.user_permissions))
          : null
      );
      setHasUserOverrides(Boolean(res?.data?.has_user_overrides));
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar permisos de usuario"));
    } finally {
      setSavingUserPermissions(false);
    }
  };

  const resetUserPermissions = async () => {
    if (!canEditUsers) {
      toast.error("No tienes permiso para editar permisos");
      return;
    }
    if (!selectedUserForPermissions) return;
    try {
      await axios.delete(`${API}/permissions/users/${selectedUserForPermissions}`, { withCredentials: true });
      toast.success("Permisos del usuario restablecidos a los del rol");
      await beginUserPermissionEdit(selectedUserForPermissions);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al restablecer permisos"));
    }
  };

  const createRole = async () => {
    if (!canManagePermissions) {
      toast.error("No tienes permiso para crear roles");
      return;
    }
    if (!newRoleKey.trim()) {
      toast.error("Ingresa el identificador del rol");
      return;
    }

    setCreatingRole(true);
    try {
      await axios.post(
        `${API}/roles`,
        {
          role: newRoleKey,
          label: newRoleLabel,
          color: newRoleColor,
        },
        { withCredentials: true }
      );

      toast.success("Rol creado");
      const createdRole = newRoleKey.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, "_");
      setNewRoleKey("");
      setNewRoleLabel("");
      setNewRoleColor("");
      await loadRolesCatalog();
      await loadPermissionsBase();
      beginRolePermissionEdit(createdRole);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear rol"));
    } finally {
      setCreatingRole(false);
    }
  };

  const removeRole = async () => {
    if (!canManagePermissions) {
      toast.error("No tienes permiso para eliminar roles");
      return;
    }
    if (!selectedRoleForPermissions) {
      toast.error("Selecciona un rol");
      return;
    }
    if (selectedRoleIsBase) {
      toast.error("No puedes eliminar un rol base del sistema");
      return;
    }
    if (!window.confirm(`¿Eliminar rol ${selectedRoleForPermissions}?`)) {
      return;
    }

    setDeletingRole(true);
    try {
      await axios.delete(`${API}/roles/${selectedRoleForPermissions}`, { withCredentials: true });
      toast.success("Rol eliminado");
      await loadRolesCatalog();
      await loadPermissionsBase();
      beginRolePermissionEdit("ventas");
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar rol"));
    } finally {
      setDeletingRole(false);
    }
  };

  // promoteToAdmin removed (Google-based invites no longer supported)

  const updateUserRole = async () => {
    if (!editingUser) return;
    if (!editName.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!editLastName.trim()) {
      toast.error("Los apellidos son requeridos");
      return;
    }
    if (editEmail && !/^[^@\s]+@[^@\s]+$/.test(editEmail.trim())) {
      toast.error("El correo electrónico no es válido");
      return;
    }
    if (!/^\d{4}-\d{4}$/.test(editPhone)) {
      toast.error("El número de contacto es requerido y debe tener formato 0000-0000");
      return;
    }
    if (!editRole) {
      toast.error("El rol es requerido");
      return;
    }
    if (!editBranch) {
      toast.error("La sucursal es requerida");
      return;
    }
    try {
      await axios.put(`${API}/users/${editingUser.user_id}/role`, {
        name: editName.trim(),
        last_name: editLastName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim(),
        role: editRole,
        ...(editRole === "ventas" ? { seller_type: editSellerType || "piso" } : {}),
        branch_id: editBranch,
        warehouse_id: editWarehouse || null,
        base_salary: Number(editBaseSalary || 0),
        earns_commissions: editEarnsCommissions,
        has_social_security: editHasSocialSecurity,
        eligible_for_attendance_bonus: editEligibleAttendanceBonus,
      }, { withCredentials: true });
      toast.success("Rol actualizado");
      setEditingUser(null);
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar rol");
    }
  };

  

  // PIN User functions
  const createPinUser = async () => {
    if (!canCreateUsers) {
      toast.error("No tienes permiso para crear usuarios");
      return;
    }
    if (!pinForm.name.trim() || !pinForm.last_name.trim() || !pinForm.phone.trim() || !pinForm.role || !pinForm.branch_id || !pinForm.login_pin || pinForm.login_pin.length !== 8) {
      toast.error("Completa nombre, apellidos, contacto, rol, sucursal y PIN de inicio (8)");
      return;
    }
    if (!/^\d{4}-\d{4}$/.test(pinForm.phone)) {
      toast.error("El número de contacto debe tener formato 0000-0000");
      return;
    }
    if (!/^\d{8}$/.test(pinForm.login_pin)) {
      toast.error("El PIN de inicio debe ser de 8 dígitos numéricos");
      return;
    }
    
    try {
      await axios.post(`${API}/users/pin`, {
        name: pinForm.name.trim(),
        last_name: pinForm.last_name.trim(),
        phone: pinForm.phone.trim(),
        role: pinForm.role,
        ...(pinForm.role === "ventas" ? { seller_type: pinForm.seller_type || "piso" } : {}),
        pin: pinForm.pin || null,
        login_pin: pinForm.login_pin,
        branch_id: pinForm.branch_id,
        warehouse_id: pinForm.warehouse_id || null,
        base_salary: Number(pinForm.base_salary || 0),
        earns_commissions: pinForm.earns_commissions,
        has_social_security: pinForm.has_social_security,
        eligible_for_attendance_bonus: pinForm.eligible_for_attendance_bonus,
      }, { withCredentials: true });
      
      toast.success(`Usuario ${pinForm.name} creado con acceso PIN`);
      setShowCreatePin(false);
      setPinForm({
        name: "",
        last_name: "",
        phone: "",
        role: "ventas",
        pin: "",
        login_pin: "",
        branch_id: "",
        warehouse_id: "",
        base_salary: "",
        earns_commissions: false,
        has_social_security: false,
        eligible_for_attendance_bonus: false,
      });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al crear usuario PIN"));
    }
  };

  const updatePinUserPin = async () => {
    if (!canEditUsers) {
      toast.error("No tienes permiso para editar usuarios");
      return;
    }
    if (!editingPinUser || !newPin || newPin.length !== 8) {
      toast.error("Ingresa un PIN de inicio de 8 dígitos");
      return;
    }
    if (!/^\d{8}$/.test(newPin)) {
      toast.error("El PIN de inicio debe ser de 8 dígitos numéricos");
      return;
    }
    
    try {
      await axios.put(`${API}/users/${editingPinUser.user_id}/login-pin`, {
        new_pin: newPin
      }, { withCredentials: true });
      
      toast.success("PIN actualizado");
      setEditingPinUser(null);
      setNewPin("");
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar PIN"));
    }
  };

  const updateKioskPin = async () => {
    if (!canEditUsers) {
      toast.error("No tienes permiso para editar usuarios");
      return;
    }
    if (!editingKioskPinUser || !/^\d{4}$/.test(newKioskPin)) {
      toast.error("Ingresa un PIN Kiosko de 4 dígitos");
      return;
    }

    try {
      await axios.put(
        `${API}/users/${editingKioskPinUser.user_id}/pin`,
        { new_pin: newKioskPin },
        { withCredentials: true }
      );
      try {
        await syncKioskPins({ silent: true });
      } catch (_) {
        // Ignore sync failures here because the PIN update itself already succeeded.
      }
      toast.success("PIN Kiosko actualizado");
      setEditingKioskPinUser(null);
      setNewKioskPin("");
      await fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al actualizar PIN Kiosko"));
    }
  };

  const syncKioskPins = async ({ silent = false } = {}) => {
    setSyncingKioskPins(true);
    try {
      await axios.post(`${API}/hr/timeclock/pin-directory/sync`, {}, { withCredentials: true });
      if (!silent) {
        toast.success("Sincronización enviada al kiosko");
      }
    } catch (error) {
      if (!silent) {
        toast.error(getErrorMessage(error, "No se pudo sincronizar PINs Kiosko"));
      }
      throw error;
    } finally {
      setSyncingKioskPins(false);
    }
  };

  const seedKioskPinsForTesting = async () => {
    setLoadingKioskPins(true);
    try {
      const res = await axios.post(
        `${API}/users/pin/kiosk/seed`,
        { reset_all: true },
        { withCredentials: true }
      );
      const rows = res?.data?.rows || [];
      setKioskPinsTable(rows);
      toast.success(`PIN Kiosko generados para ${rows.length} usuarios`);
      await fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudieron generar los PIN Kiosko"));
    } finally {
      setLoadingKioskPins(false);
    }
  };

  const deletePinUser = async (userId, userName) => {
    if (!canDeleteUsers) {
      toast.error("No tienes permiso para eliminar usuarios");
      return;
    }
    if (!window.confirm(`¿Eliminar usuario ${userName}? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/users/pin/${userId}`, { withCredentials: true });
      toast.success("Usuario eliminado");
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar usuario"));
    }
  };

  const getUserRoleLabel = (role) =>
    (rolesMap && rolesMap[role]?.label) || ROLES[role]?.label || role || "Sin rol";

  const getUserBranchLabel = (userItem) =>
    branches.find((b) => b.branch_id === userItem?.branch_id)?.name || "Sin sucursal";

  const getUserDisplayLabel = (userItem) =>
    `${userItem?.name || "Sin nombre"} - ${getUserRoleLabel(userItem?.role)} - ${getUserBranchLabel(userItem)}`;

  const roleFilterOptions = Object.entries(rolesMap || ROLES)
    .map(([value, meta]) => ({
      value,
      label: meta?.label || value,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

  const openUserPermissions = async (userId) => {
    setActiveTab("user-permissions");
    await beginUserPermissionEdit(userId);
  };

  const renderPermissionsMatrix = ({
    draft,
    onToggle,
    highlightOverrides = false,
  }) => {
    if (!draft || !permissionsCatalog) {
      return (
        <div className="text-sm text-muted-foreground">
          {highlightOverrides ? "Selecciona un usuario para editar permisos personalizados." : "No hay permisos para mostrar."}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(permissionsCatalog.modules || {}).map(([moduleKey, moduleCfg]) => (
          <Card key={moduleKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{moduleCfg.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Función</TableHead>
                    {PERMISSION_ACTIONS.map((action) => (
                      <TableHead key={action} className="text-center">{ACTION_LABELS[action]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(moduleCfg.functions || {}).map(([functionKey, functionLabel]) => (
                    <TableRow key={functionKey}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{functionLabel}</span>
                          {highlightOverrides &&
                          PERMISSION_ACTIONS.some((action) => isUserPermissionOverridden(moduleKey, functionKey, action)) ? (
                            <Badge variant="outline" className="text-[10px]">Personalizado</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      {PERMISSION_ACTIONS.map((action) => {
                        const overridden = highlightOverrides && isUserPermissionOverridden(moduleKey, functionKey, action);
                        return (
                          <TableCell key={action} className="text-center">
                            <Checkbox
                              checked={Boolean(draft?.[moduleKey]?.[functionKey]?.[action])}
                              onCheckedChange={(checked) => onToggle(moduleKey, functionKey, action, checked)}
                              className={overridden ? "border-amber-500 data-[state=checked]:bg-amber-500" : ""}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const getRoleColor = (role) => {
    const colors = {
      gerencia: "bg-purple-500",
      supervisor: "bg-blue-500",
      ventas: "bg-green-500",
      electrico: "bg-indigo-500",
      polarizador: "bg-pink-500",
      transporte: "bg-orange-500",
      bodegas: "bg-yellow-500",
      instalaciones: "bg-cyan-500",
    };
    return colors[role] || "bg-gray-500";
  };

  return (
    <div className="p-6 space-y-6" data-testid="users-admin-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra roles y permisos del equipo</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">USUARIOS GOOGLE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">USUARIOS PIN</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-cyan-500">{pinUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ADMINISTRADORES</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-purple-500">
              {users.filter(u => u.role === "gerencia").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TÉCNICOS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-orange-500">
              {[...users, ...pinUsers].filter(u => u.role === "instalaciones").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-up-soft">
        <TabsList>
          <TabsTrigger value="pin" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Usuarios PIN ({pinUsers.length})
          </TabsTrigger>
          {canManagePermissions && (
            <>
              <TabsTrigger value="role-permissions" className="gap-2">
                Permisos por Rol
              </TabsTrigger>
              <TabsTrigger value="user-permissions" className="gap-2">
                Permisos por Usuario
              </TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="pin">
          <Card className="border-primary/30 shadow-sm ui-panel animate-fade-up-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Usuarios con PIN</CardTitle>
                <CardDescription>Usuarios operativos con PIN de marcación (4) y PIN de inicio de sesión (8)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={seedKioskPinsForTesting}
                  disabled={!canEditUsers || loadingKioskPins}
                  data-testid="seed-kiosk-pins-btn"
                >
                  {loadingKioskPins ? "Generando..." : "Generar PINs Kiosko"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => syncKioskPins()}
                  disabled={!canEditUsers || syncingKioskPins}
                  data-testid="sync-kiosk-pins-btn"
                >
                  {syncingKioskPins ? "Sincronizando..." : "Sincronizar PINs Kiosko"}
                </Button>
                <Dialog open={showCreatePin} onOpenChange={setShowCreatePin}>
                  <DialogTrigger asChild>
                    <Button data-testid="create-pin-user-btn" disabled={!canCreateUsers}>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Crear Usuario PIN
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Usuario con PIN</DialogTitle>
                    <DialogDescription>
                      Configura PIN de marcación (4 dígitos) y PIN de inicio de sesión (8 dígitos)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nombre Completo</Label>
                      <Input
                        value={pinForm.name}
                        onChange={(e) => setPinForm({...pinForm, name: e.target.value})}
                        placeholder="Juan"
                        className="mt-1"
                        data-testid="pin-user-name"
                      />
                    </div>

                    <div>
                      <Label>Apellidos</Label>
                      <Input
                        value={pinForm.last_name}
                        onChange={(e) => setPinForm({...pinForm, last_name: e.target.value})}
                        placeholder="Pérez López"
                        className="mt-1"
                        data-testid="pin-user-last-name"
                      />
                    </div>

                    <div>
                      <Label>Número de contacto</Label>
                      <Input
                        value={pinForm.phone}
                        onChange={(e) => setPinForm({ ...pinForm, phone: formatPhone(e.target.value) })}
                        placeholder="0000-0000"
                        className="mt-1"
                        data-testid="pin-user-phone"
                      />
                    </div>
                    
                    <div>
                      <Label>Rol</Label>
                      <Select value={pinForm.role} onValueChange={(v) => setPinForm({...pinForm, role: v})}>
                        <SelectTrigger className="mt-1" data-testid="pin-user-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(rolesMap || ROLES).filter(r => r !== "gerencia").map(role => (
                            <SelectItem key={role} value={role}>
                              {(rolesMap && rolesMap[role]?.label) || ROLES[role]?.label || role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        El rol Gerencia requiere autenticación con Google
                      </p>
                    </div>

                    {pinForm.role === "ventas" ? (
                      <div>
                        <Label>Tipo de vendedor</Label>
                        <Select
                          value={pinForm.seller_type || "piso"}
                          onValueChange={(v) => setPinForm({ ...pinForm, seller_type: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SELLER_TYPES).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    
                    <div>
                      <Label>PIN de Marcación (4 dígitos, opcional)</Label>
                      <div className="relative mt-1">
                        <Input
                          type={showPin ? "text" : "password"}
                          value={pinForm.pin}
                          onChange={(e) => setPinForm({...pinForm, pin: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                          placeholder="••••"
                          className="font-mono text-lg tracking-widest"
                          maxLength={4}
                          data-testid="pin-user-pin"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowPin(!showPin)}
                          aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                        >
                          {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pinForm.pin.length}/4 dígitos
                      </p>
                    </div>

                    <div>
                      <Label>PIN de Inicio de Sesión (8 dígitos)</Label>
                      <div className="relative mt-1">
                        <Input
                          type={showPin ? "text" : "password"}
                          value={pinForm.login_pin}
                          onChange={(e) => setPinForm({...pinForm, login_pin: e.target.value.replace(/\D/g, '').slice(0, 8)})}
                          placeholder="••••••••"
                          className="font-mono text-lg tracking-widest"
                          maxLength={8}
                          data-testid="pin-user-login-pin"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pinForm.login_pin.length}/8 dígitos
                      </p>
                    </div>
                    
                    <div>
                      <Label>Sucursal</Label>
                      <Select value={pinForm.branch_id || "none"} onValueChange={(v) => setPinForm({...pinForm, branch_id: v === "none" ? "" : v})}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecciona sucursal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecciona sucursal</SelectItem>
                          {branches.map(b => (
                            <SelectItem key={b.branch_id} value={b.branch_id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Salario base mensual (C$)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={pinForm.base_salary}
                        onChange={(e) => setPinForm({ ...pinForm, base_salary: e.target.value })}
                        placeholder="15000"
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={pinForm.earns_commissions}
                          onCheckedChange={(v) => setPinForm({ ...pinForm, earns_commissions: Boolean(v) })}
                        />
                        Aprobación de comisiones
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={pinForm.has_social_security}
                          onCheckedChange={(v) => setPinForm({ ...pinForm, has_social_security: Boolean(v) })}
                        />
                        Seguro social INSS (7%)
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={pinForm.eligible_for_attendance_bonus}
                          onCheckedChange={(v) => setPinForm({ ...pinForm, eligible_for_attendance_bonus: Boolean(v) })}
                        />
                        Bono de puntualidad y asistencia
                      </label>
                    </div>

                    {(pinForm.role === "bodegas" || pinForm.role === "transporte") && (
                      <div>
                        <Label>Bodega (Opcional)</Label>
                        <Select value={pinForm.warehouse_id || "none"} onValueChange={(v) => setPinForm({...pinForm, warehouse_id: v === "none" ? "" : v})}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Sin asignar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {warehouses.map(w => (
                              <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <Button 
                      onClick={createPinUser} 
                      className="w-full"
                      disabled={
                        !pinForm.name.trim() ||
                        !pinForm.last_name.trim() ||
                        !/^\d{4}-\d{4}$/.test(pinForm.phone) ||
                        !pinForm.role ||
                        !pinForm.branch_id ||
                        pinForm.login_pin.length !== 8 ||
                        !canCreateUsers
                      }
                      data-testid="save-pin-user-btn"
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Crear Usuario
                    </Button>
                  </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <UserDirectoryFilters
                directory={pinDirectory}
                rolesMap={rolesMap}
                branches={branches}
                showOverridesFilter
                searchTestId="search-users"
                onRefresh={fetchData}
              />

              <div
                key={pinDirectory.queryKey}
                className="rounded-lg border overflow-hidden ui-panel shadow-sm animate-draft-load"
              >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Apellidos</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Bodega</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading || pinDirectory.loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : pinDirectory.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>{pinUsers.length === 0 ? "No hay usuarios PIN creados" : "No hay usuarios con esos filtros"}</p>
                        <p className="text-sm">
                          {pinUsers.length === 0
                            ? "Crea usuarios con acceso rápido para el personal operativo"
                            : "Prueba con otros criterios de búsqueda o limpia los filtros"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pinDirectory.rows.map(user => {
                      const branch = branches.find(b => b.branch_id === user.branch_id);
                      const warehouse = warehouses.find(w => w.warehouse_id === user.warehouse_id);
                      
                      return (
                        <TableRow key={user.user_id} data-testid={`pin-user-${user.user_id}`} className="ui-interactive">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className={getRoleColor(user.role)}>
                                  {user.name?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">{user.display_name || user.name}</p>
                                  {user.has_user_overrides ? (
                                    <Badge variant="secondary" className="text-[10px]">Personalizado</Badge>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <KeyRound className="h-3 w-3" />
                                  Acceso PIN
                                </p>
                                <p className="text-xs text-muted-foreground">{`${getUserRoleLabel(user.role)} - ${getUserBranchLabel(user)}`}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.last_name || "-"}</TableCell>
                          <TableCell>
                            <Badge className={`${getRoleColor(user.role)} text-white`}>
                              {(rolesMap && rolesMap[user.role]?.label) || ROLES[user.role]?.label || user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {branch ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Building2 className="h-3 w-3" />
                                {branch.name}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            {(user.role === "bodegas" || user.role === "transporte") ? (
                              warehouse ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Warehouse className="h-3 w-3" />
                                  {warehouse.name}
                                </div>
                              ) : "-"
                            ) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Activo</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {canManagePermissions ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openUserPermissions(user.user_id)}
                                  data-testid={`edit-permissions-${user.user_id}`}
                                >
                                  <Shield className="h-3 w-3 mr-1" />
                                  Permisos
                                </Button>
                              ) : null}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingKioskPinUser(user);
                                  setNewKioskPin("");
                                }}
                                data-testid={`change-kiosk-pin-${user.user_id}`}
                                disabled={!canEditUsers}
                              >
                                PIN Kiosko
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setEditingPinUser(user); setNewPin(""); }}
                                data-testid={`change-pin-${user.user_id}`}
                                disabled={!canEditUsers}
                              >
                                Cambiar PIN inicio
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Open edit dialog in edit mode
                                  setEditingUser(user);
                                  setEditName(user.name || "");
                                  setEditLastName(user.last_name || "");
                                  setEditEmail(user.email || "");
                                  setEditPhone(formatPhone(user.phone || ""));
                                  setEditRole(user.role || "");
                                  setEditSellerType(user.seller_type || "piso");
                                  setEditBranch(user.branch_id || "");
                                  setEditWarehouse(user.warehouse_id || "");
                                  setEditBaseSalary(String(user.base_salary ?? ""));
                                  setEditEarnsCommissions(Boolean(user.earns_commissions));
                                  setEditHasSocialSecurity(Boolean(user.has_social_security));
                                  setEditEligibleAttendanceBonus(Boolean(user.eligible_for_attendance_bonus));
                                  setIsViewOnly(false);
                                }}
                                data-testid={`edit-user-${user.user_id}`}
                                disabled={!canEditUsers}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  // Open edit dialog in view-only mode
                                  setEditingUser(user);
                                  setEditName(user.name || "");
                                  setEditLastName(user.last_name || "");
                                  setEditEmail(user.email || "");
                                  setEditPhone(formatPhone(user.phone || ""));
                                  setEditRole(user.role || "");
                                  setEditSellerType(user.seller_type || "piso");
                                  setEditBranch(user.branch_id || "");
                                  setEditWarehouse(user.warehouse_id || "");
                                  setEditBaseSalary(String(user.base_salary ?? ""));
                                  setEditEarnsCommissions(Boolean(user.earns_commissions));
                                  setEditHasSocialSecurity(Boolean(user.has_social_security));
                                  setEditEligibleAttendanceBonus(Boolean(user.eligible_for_attendance_bonus));
                                  setIsViewOnly(true);
                                }}
                                className="text-foreground/80"
                                data-testid={`view-user-${user.user_id}`}
                                aria-label={`Ver usuario ${user.name}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deletePinUser(user.user_id, user.name)}
                                data-testid={`delete-pin-${user.user_id}`}
                                aria-label={`Eliminar usuario ${user.name}`}
                                disabled={!canDeleteUsers}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <DirectoryPagination
                pagination={pinDirectory.pagination}
                loading={pinDirectory.loading}
                onPrev={pinDirectory.prevPage}
                onNext={pinDirectory.nextPage}
              />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4 border-primary/20 shadow-sm ui-panel animate-fade-up-soft">
            <CardHeader>
              <CardTitle>Tabla de PIN Kiosko</CardTitle>
              <CardDescription>PIN de marcación actuales para pruebas de entrada/salida</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Apellidos</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>PIN Kiosko</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kioskPinsTable.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        No hay PIN Kiosko generados aún.
                      </TableCell>
                    </TableRow>
                  ) : (
                    kioskPinsTable.map((item) => (
                      <TableRow key={`kiosk-${item.user_id}`}>
                        <TableCell>{item.name || item.user_id}</TableCell>
                        <TableCell>{item.last_name || "-"}</TableCell>
                        <TableCell>{getUserRoleLabel(item.role)}</TableCell>
                        <TableCell>{branches.find((b) => b.branch_id === item.branch_id)?.name || "Sin sucursal"}</TableCell>
                        <TableCell className="font-mono tracking-widest">
                          {(item.role === "bodegas" || item.role === "transporte") ? (item.kiosk_pin || "----") : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {canManagePermissions && (
        <TabsContent value="role-permissions">
          <Card className="border-primary/30 shadow-sm ui-panel animate-fade-up-soft">
            <CardHeader>
              <CardTitle>Permisos por Rol</CardTitle>
              <CardDescription>
                Define el comportamiento predeterminado de cada rol. Los cambios aplican a todos los usuarios con ese rol que no tengan permisos personalizados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Gestión de Roles</CardTitle>
                  <CardDescription>Crea y elimina roles personalizados.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <Input
                      placeholder="rol_ejemplo"
                      value={newRoleKey}
                      onChange={(e) => setNewRoleKey(e.target.value)}
                    />
                    <Input
                      placeholder="Etiqueta (opcional)"
                      value={newRoleLabel}
                      onChange={(e) => setNewRoleLabel(e.target.value)}
                    />
                    <Input
                      placeholder="Color (opcional)"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                    />
                    <Button onClick={createRole} disabled={creatingRole || !newRoleKey.trim()}>
                      Agregar rol
                    </Button>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button
                      variant="destructive"
                      onClick={removeRole}
                      disabled={deletingRole || !selectedRoleForPermissions || selectedRoleIsBase}
                    >
                      Eliminar rol seleccionado
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-[1fr_auto] ui-fade-in-stagger">
                <div className="space-y-2">
                  <Label>Buscar rol</Label>
                  <FilterCombobox
                    value={selectedRoleForPermissions}
                    onChange={beginRolePermissionEdit}
                    options={roleFilterOptions}
                    placeholder="Seleccionar rol"
                    searchPlaceholder="Buscar rol..."
                    includeAllOption={false}
                  />
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    onClick={saveRolePermissions}
                    disabled={!rolePermissionsDraft || savingRolePermissions || !canEditUsers}
                  >
                    {savingRolePermissions ? "Guardando..." : "Guardar permisos de rol"}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground animate-erp-fade-check">
                {permissionsTargetLabel || "Selecciona un rol"}
              </p>

              <div key={selectedRoleForPermissions} className="animate-draft-load">
              {loadingPermissions ? (
                <div className="text-sm text-muted-foreground">Cargando permisos...</div>
              ) : (
                renderPermissionsMatrix({
                  draft: rolePermissionsDraft,
                  onToggle: toggleRolePermission,
                })
              )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {canManagePermissions && (
        <TabsContent value="user-permissions">
          <Card className="border-primary/30 shadow-sm ui-panel animate-fade-up-soft">
            <CardHeader>
              <CardTitle>Permisos por Usuario</CardTitle>
              <CardDescription>
                Ajusta excepciones individuales sobre el rol asignado. Solo se guardan las diferencias respecto al rol; el resto se hereda automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UserDirectoryPicker
                selectedUserId={selectedUserForPermissions}
                onSelect={beginUserPermissionEdit}
                rolesMap={rolesMap}
                branches={branches}
                active={activeTab === "user-permissions"}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 animate-erp-fade-check">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{permissionsTargetLabel || "Selecciona un usuario"}</span>
                {selectedUserForPermissions ? (
                  <Badge variant={hasUserOverrides ? "secondary" : "outline"}>
                    {hasUserOverrides ? "Con personalizaciones" : "Hereda todo del rol"}
                  </Badge>
                ) : null}
                </div>
                <div className="flex gap-2">
                  {selectedUserForPermissions ? (
                    <Button variant="outline" onClick={resetUserPermissions}>
                      Restablecer a rol
                    </Button>
                  ) : null}
                  <Button
                    onClick={saveUserPermissions}
                    disabled={!userEffectiveDraft || !selectedUserForPermissions || savingUserPermissions || !canEditUsers}
                  >
                    {savingUserPermissions ? "Guardando..." : "Guardar permisos de usuario"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Las casillas marcadas en ámbar son permisos personalizados. Las demás se heredan del rol actual del usuario.
              </p>

              <div key={selectedUserForPermissions || "no-user"} className="animate-draft-load">
              {loadingPermissions ? (
                <div className="text-sm text-muted-foreground">Cargando permisos...</div>
              ) : selectedUserForPermissions ? (
                renderPermissionsMatrix({
                  draft: userEffectiveDraft,
                  onToggle: toggleUserPermission,
                  highlightOverrides: true,
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  Selecciona un usuario del directorio para editar permisos personalizados.
                </div>
              )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>

      {/* Edit Google User Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) { setEditingUser(null); setIsViewOnly(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isViewOnly ? `Ver Usuario ${getUserDisplayLabel(editingUser)}` : `Editar Rol de ${getUserDisplayLabel(editingUser)}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre del colaborador</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre completo"
                disabled={isViewOnly}
              />
            </div>

            <div>
              <Label>Apellidos del colaborador</Label>
              <Input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Apellidos"
                disabled={isViewOnly}
              />
            </div>

            <div>
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="usuario@dominio"
                disabled={isViewOnly}
              />
            </div>

            <div>
              <Label>Número de contacto</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(formatPhone(e.target.value))}
                placeholder="0000-0000"
                disabled={isViewOnly}
                inputMode="numeric"
                maxLength={9}
              />
            </div>

            <div>
              <Label>Rol</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger data-testid="select-role" disabled={isViewOnly}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rolesMap || ROLES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editRole === "ventas" ? (
              <div>
                <Label>Tipo de vendedor</Label>
                <Select value={editSellerType || "piso"} onValueChange={setEditSellerType}>
                  <SelectTrigger disabled={isViewOnly}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SELLER_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            
            <div>
              <Label>Sucursal Asignada</Label>
              <Select value={editBranch || "none"} onValueChange={(v) => setEditBranch(v === "none" ? "" : v)}>
                <SelectTrigger disabled={isViewOnly}>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.branch_id} value={b.branch_id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(editRole === "bodegas" || editRole === "transporte") && (
              <div>
                <Label>Bodega Asignada</Label>
                <Select value={editWarehouse || "none"} onValueChange={(v) => setEditWarehouse(v === "none" ? "" : v)}>
                  <SelectTrigger disabled={isViewOnly}>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {warehouses.map(w => (
                      <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Salario base mensual (C$)</Label>
              <Input
                type="number"
                min="0"
                value={editBaseSalary}
                onChange={(e) => setEditBaseSalary(e.target.value)}
                disabled={isViewOnly}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editEarnsCommissions}
                  onCheckedChange={(v) => setEditEarnsCommissions(Boolean(v))}
                  disabled={isViewOnly}
                />
                Aprobación de comisiones
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editHasSocialSecurity}
                  onCheckedChange={(v) => setEditHasSocialSecurity(Boolean(v))}
                  disabled={isViewOnly}
                />
                Seguro social INSS (7%)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editEligibleAttendanceBonus}
                  onCheckedChange={(v) => setEditEligibleAttendanceBonus(Boolean(v))}
                  disabled={isViewOnly}
                />
                Bono de puntualidad y asistencia
              </label>
            </div>

            {!isViewOnly && canEditUsers && (
              <Button onClick={updateUserRole} className="w-full" data-testid="save-role-btn">
                Guardar Cambios
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Change PIN Dialog */}
      <Dialog open={!!editingPinUser} onOpenChange={() => setEditingPinUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar PIN de inicio de {getUserDisplayLabel(editingPinUser)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nuevo PIN de inicio (8 dígitos)</Label>
              <div className="relative mt-1">
                <Input
                  type={showPin ? "text" : "password"}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="••••••••"
                  className="font-mono text-lg tracking-widest"
                  maxLength={8}
                  data-testid="new-pin-input"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{newPin.length}/8 dígitos</p>
            </div>
            
            <Button 
              onClick={updatePinUserPin} 
              className="w-full"
              disabled={newPin.length !== 8 || !canEditUsers}
              data-testid="save-new-pin-btn"
            >
              Actualizar PIN de inicio
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingKioskPinUser} onOpenChange={() => setEditingKioskPinUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN Kiosko de {getUserDisplayLabel(editingKioskPinUser)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nuevo PIN Kiosko (4 dígitos)</Label>
              <div className="relative mt-1">
                <Input
                  type={showPin ? "text" : "password"}
                  value={newKioskPin}
                  onChange={(e) => setNewKioskPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="font-mono text-lg tracking-widest"
                  maxLength={4}
                  data-testid="new-kiosk-pin-input"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{newKioskPin.length}/4 dígitos</p>
            </div>

            <Button
              onClick={updateKioskPin}
              className="w-full"
              disabled={newKioskPin.length !== 4 || !canEditUsers}
              data-testid="save-kiosk-pin-btn"
            >
              Actualizar PIN Kiosko
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
