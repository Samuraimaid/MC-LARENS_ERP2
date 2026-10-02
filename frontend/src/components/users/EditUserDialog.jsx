import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { API_BASE as API } from "@/lib/api";
import { formatPhone } from "@/lib/formatters";
import { ROLES } from "@/lib/utils";
import { SELLER_TYPES } from "@/lib/priceTiers";

export default function EditUserDialog({
  user = null,
  open = false,
  isViewOnly = false,
  onOpenChange,
  rolesMap = ROLES,
  branches = [],
  warehouses = [],
  onUserUpdated,
}) {
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [sellerType, setSellerType] = useState("piso");
  const [branch, setBranch] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [earnsCommissions, setEarnsCommissions] = useState(false);
  const [hasSocialSecurity, setHasSocialSecurity] = useState(false);
  const [eligibleAttendanceBonus, setEligibleAttendanceBonus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setLastName(user.last_name || "");
      setEmail(user.email || "");
      setPhone(formatPhone(user.phone || ""));
      setRole(user.role || "");
      setSellerType(user.seller_type || "piso");
      setBranch(user.branch_id || "");
      setWarehouse(user.warehouse_id || "");
      setBaseSalary(user.base_salary != null ? String(user.base_salary) : "");
      setEarnsCommissions(Boolean(user.earns_commissions));
      setHasSocialSecurity(Boolean(user.has_social_security));
      setEligibleAttendanceBonus(Boolean(user.eligible_for_attendance_bonus));
    }
  }, [user]);

  const getUserRoleLabel = (r) =>
    (rolesMap && rolesMap[r]?.label) || ROLES[r]?.label || r || "Sin rol";

  const getUserBranchLabel = (u) =>
    branches.find((b) => b.branch_id === u?.branch_id)?.name || "Sin sucursal";

  const getUserDisplayLabel = (u) =>
    `${u?.name || "Sin nombre"} - ${getUserRoleLabel(u?.role)} - ${getUserBranchLabel(u)}`;

  const handleUpdate = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!lastName.trim()) {
      toast.error("Los apellidos son requeridos");
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+$/.test(email.trim())) {
      toast.error("El correo electrónico no es válido");
      return;
    }
    if (!/^\d{4}-\d{4}$/.test(phone)) {
      toast.error("El número de contacto es requerido y debe tener formato 0000-0000");
      return;
    }
    if (!role) {
      toast.error("El rol es requerido");
      return;
    }
    if (!branch) {
      toast.error("La sucursal es requerida");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.put(
        `${API}/users/${user.user_id}/role`,
        {
          name: name.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim(),
          role: role,
          ...(role === "ventas" ? { seller_type: sellerType || "piso" } : {}),
          branch_id: branch,
          warehouse_id: warehouse || null,
          base_salary: Number(baseSalary || 0),
          earns_commissions: earnsCommissions,
          has_social_security: hasSocialSecurity,
          eligible_for_attendance_bonus: eligibleAttendanceBonus,
        },
        { withCredentials: true }
      );
      toast.success("Usuario actualizado");
      onOpenChange(false);
      if (typeof onUserUpdated === "function") {
        onUserUpdated();
      }
    } catch (error) {
      toast.error("Error al actualizar usuario");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isViewOnly
              ? `Ver Usuario ${getUserDisplayLabel(user)}`
              : `Editar Rol de ${getUserDisplayLabel(user)}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Nombre del colaborador</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
              disabled={isViewOnly}
            />
          </div>

          <div>
            <Label>Apellidos del colaborador</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Apellidos"
              disabled={isViewOnly}
            />
          </div>

          <div>
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@dominio"
              disabled={isViewOnly}
            />
          </div>

          <div>
            <Label>Número de contacto</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="0000-0000"
              disabled={isViewOnly}
              inputMode="numeric"
              maxLength={9}
            />
          </div>

          <div>
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole} disabled={isViewOnly}>
              <SelectTrigger data-testid="select-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(rolesMap || ROLES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role === "ventas" ? (
            <div>
              <Label>Tipo de vendedor</Label>
              <Select
                value={sellerType || "piso"}
                onValueChange={setSellerType}
                disabled={isViewOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SELLER_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div>
            <Label>Sucursal Asignada</Label>
            <Select
              value={branch || "none"}
              onValueChange={(v) => setBranch(v === "none" ? "" : v)}
              disabled={isViewOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.branch_id} value={b.branch_id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(role === "bodegas" || role === "transporte") && (
            <div>
              <Label>Bodega Asignada</Label>
              <Select
                value={warehouse || "none"}
                onValueChange={(v) => setWarehouse(v === "none" ? "" : v)}
                disabled={isViewOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.warehouse_id} value={w.warehouse_id}>
                      {w.name}
                    </SelectItem>
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
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              disabled={isViewOnly}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={earnsCommissions}
                onCheckedChange={(v) => setEarnsCommissions(Boolean(v))}
                disabled={isViewOnly}
              />
              Aprobación de comisiones
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={hasSocialSecurity}
                onCheckedChange={(v) => setHasSocialSecurity(Boolean(v))}
                disabled={isViewOnly}
              />
              Seguro social INSS (7%)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={eligibleAttendanceBonus}
                onCheckedChange={(v) => setEligibleAttendanceBonus(Boolean(v))}
                disabled={isViewOnly}
              />
              Bono de puntualidad y asistencia
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isViewOnly ? "Cerrar" : "Cancelar"}
            </Button>
            {!isViewOnly && (
              <Button onClick={handleUpdate} disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
