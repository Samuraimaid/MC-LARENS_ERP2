import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, UserCheck } from "lucide-react";

const DRIVER_TYPE_LABELS = {
  delivery_last_mile: "Entrega última milla",
  inter_branch_haul: "Traslado entre sucursales",
};

const EMPTY_FORM = {
  driver_id: "",
  user_id: "",
  driver_type: "delivery_last_mile",
  phone: "",
  vehicle_plate: "",
  branch_id: "",
};

export function DriversManagementTab({
  users = [],
  branches = [],
  canEdit = false,
  getUserLabel,
  getBranchLabel,
}) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");

  const transportUsers = useMemo(
    () => users.filter((u) => ["transporte", "entregador"].includes(u.role)),
    [users],
  );

  const linkedUserIds = useMemo(
    () => new Set(drivers.map((d) => d.user_id).filter(Boolean)),
    [drivers],
  );

  const selectableUsers = useMemo(() => {
    if (!editingId) {
      return transportUsers.filter((u) => !linkedUserIds.has(u.user_id));
    }
    const current = drivers.find((d) => d.driver_id === editingId);
    return transportUsers.filter(
      (u) => !linkedUserIds.has(u.user_id) || u.user_id === current?.user_id,
    );
  }, [transportUsers, linkedUserIds, editingId, drivers]);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/hr/drivers`, { withCredentials: true });
      setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : []);
    } catch {
      toast.error("No se pudo cargar la flota de conductores");
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId("");
  };

  const startEdit = (driver) => {
    setEditingId(driver.driver_id);
    setForm({
      driver_id: driver.driver_id,
      user_id: driver.user_id || "",
      driver_type: driver.driver_type || "delivery_last_mile",
      phone: driver.phone || "",
      vehicle_plate: driver.vehicle_plate || "",
      branch_id: driver.branch_id || "",
    });
  };

  const handleUserChange = (userId) => {
    const user = transportUsers.find((u) => u.user_id === userId);
    setForm((prev) => ({
      ...prev,
      user_id: userId,
      branch_id: prev.branch_id || user?.branch_id || "",
    }));
  };

  const validateForm = () => {
    if (!form.user_id) {
      toast.error("Selecciona un usuario de transporte o entregador");
      return false;
    }
    if (!form.branch_id) {
      toast.error("Selecciona la sucursal base");
      return false;
    }
    if (!form.phone.trim()) {
      toast.error("Ingresa el teléfono celular (+505...)");
      return false;
    }
    if (!form.vehicle_plate.trim()) {
      toast.error("Ingresa la placa del vehículo");
      return false;
    }
    return true;
  };

  const saveDriver = async () => {
    if (!canEdit || !validateForm()) return;
    setSaving(true);
    const payload = {
      user_id: form.user_id,
      driver_type: form.driver_type,
      phone: form.phone.trim(),
      vehicle_plate: form.vehicle_plate.trim(),
      branch_id: form.branch_id,
    };
    try {
      if (editingId) {
        await axios.put(`${API}/hr/drivers/${editingId}`, payload, { withCredentials: true });
        toast.success("Conductor actualizado");
      } else {
        await axios.post(`${API}/hr/drivers`, payload, { withCredentials: true });
        toast.success("Conductor registrado y vinculado");
      }
      resetForm();
      await loadDrivers();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Error al guardar conductor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {editingId ? "Editar conductor" : "Registrar conductor"}
          </CardTitle>
          <CardDescription>
            Vincula usuarios con rol transporte o entregador a la colección erp_drivers para el portal /driver y despacho por WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label>Usuario del sistema</Label>
              <Select value={form.user_id || "none"} onValueChange={(v) => handleUserChange(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar</SelectItem>
                  {selectableUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {getUserLabel ? getUserLabel(user.user_id) : `${user.name || user.user_id} (${user.role})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de conductor</Label>
              <Select
                value={form.driver_type}
                onValueChange={(v) => setForm({ ...form, driver_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery_last_mile">{DRIVER_TYPE_LABELS.delivery_last_mile}</SelectItem>
                  <SelectItem value="inter_branch_haul">{DRIVER_TYPE_LABELS.inter_branch_haul}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sucursal base</Label>
              <Select
                value={form.branch_id || "none"}
                onValueChange={(v) => setForm({ ...form, branch_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sucursal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.branch_id} value={branch.branch_id}>
                      {branch.name || branch.branch_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Teléfono celular</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+50588881234"
              />
            </div>
            <div>
              <Label>Placa del vehículo</Label>
              <Input
                value={form.vehicle_plate}
                onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })}
                placeholder="M 123456"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveDriver} disabled={!canEdit || saving}>
              {editingId ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {editingId ? "Guardar cambios" : "Registrar conductor"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                Cancelar edición
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Flota registrada (erp_drivers)</CardTitle>
            <CardDescription>
              {loading ? "Cargando..." : `${drivers.length} conductor(es) en el sistema`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadDrivers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conductor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Usuario vinculado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[90px]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No hay conductores registrados
                  </TableCell>
                </TableRow>
              )}
              {drivers.map((driver) => (
                <TableRow key={driver.driver_id}>
                  <TableCell>
                    <div className="font-medium">
                      {[driver.name, driver.last_name].filter(Boolean).join(" ") || driver.driver_id}
                    </div>
                    <div className="text-xs text-muted-foreground">{driver.driver_id}</div>
                  </TableCell>
                  <TableCell>{DRIVER_TYPE_LABELS[driver.driver_type] || driver.driver_type}</TableCell>
                  <TableCell>
                    {driver.user_id ? (
                      getUserLabel ? getUserLabel(driver.user_id) : driver.user_id
                    ) : (
                      <Badge variant="outline">Sin vincular</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getBranchLabel ? getBranchLabel(driver.branch_id) : driver.branch_id}</TableCell>
                  <TableCell>{driver.phone || "-"}</TableCell>
                  <TableCell>{driver.vehicle_plate || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={driver.status === "disponible" ? "outline" : "secondary"}>
                      {driver.status_label || driver.status || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(driver)}
                      disabled={!canEdit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}