import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { KeyRound } from "lucide-react";
import { PasswordField } from "@/components/common/PasswordField";
import { API_BASE as API } from "@/lib/api";
import { formatPhone } from "@/lib/formatters";
import { ROLES } from "@/lib/utils";
import { SELLER_TYPES } from "@/lib/priceTiers";
import { playCreationSuccessSound } from "@/lib/uiSounds";

const DEFAULT_PIN_FORM = {
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
};

export default function CreatePinUserDialog({
  open = false,
  onOpenChange,
  rolesMap = ROLES,
  branches = [],
  warehouses = [],
  canCreate = true,
  onUserCreated,
}) {
  const [pinForm, setPinForm] = useState(DEFAULT_PIN_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPinForm(DEFAULT_PIN_FORM);
    }
  }, [open]);

  const handleCreatePinUser = async () => {
    if (!canCreate) {
      toast.error("No tienes permiso para crear usuarios");
      return;
    }
    if (
      !pinForm.name.trim() ||
      !pinForm.last_name.trim() ||
      !pinForm.phone.trim() ||
      !pinForm.role ||
      !pinForm.branch_id ||
      !pinForm.login_pin ||
      pinForm.login_pin.length !== 8
    ) {
      toast.error("Completa nombre, apellidos, contacto, rol, sucursal y PIN de inicio (8 dígitos)");
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

    setIsSubmitting(true);
    try {
      await axios.post(
        `${API}/users/pin`,
        {
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
        },
        { withCredentials: true }
      );

      toast.success(`Usuario ${pinForm.name} creado con acceso PIN`);
      playCreationSuccessSound();
      onOpenChange(false);
      setPinForm(DEFAULT_PIN_FORM);
      if (typeof onUserCreated === "function") {
        onUserCreated();
      }
    } catch (error) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "Error al crear usuario PIN";
      toast.error(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Usuario con PIN</DialogTitle>
          <DialogDescription>
            Configura PIN de marcación (4 dígitos) y PIN de inicio de sesión (8 dígitos)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Nombre Completo</Label>
            <Input
              value={pinForm.name}
              onChange={(e) => setPinForm({ ...pinForm, name: e.target.value })}
              placeholder="Juan"
              className="mt-1"
              data-testid="pin-user-name"
            />
          </div>

          <div>
            <Label>Apellidos</Label>
            <Input
              value={pinForm.last_name}
              onChange={(e) => setPinForm({ ...pinForm, last_name: e.target.value })}
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
            <Select value={pinForm.role} onValueChange={(v) => setPinForm({ ...pinForm, role: v })}>
              <SelectTrigger className="mt-1" data-testid="pin-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(rolesMap || ROLES)
                  .filter((r) => r !== "gerencia")
                  .map((role) => (
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
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <PasswordField
            label="PIN de Marcación (4 dígitos, opcional)"
            mode="pin"
            pinLength={4}
            pinLabel="PIN de marcación"
            value={pinForm.pin}
            onChange={(next) => setPinForm({ ...pinForm, pin: next })}
            placeholder="••••"
            autoComplete="new-password"
            data-testid="pin-user-pin"
          />

          <PasswordField
            label="PIN de Inicio de Sesión (8 dígitos)"
            mode="pin"
            pinLength={8}
            pinLabel="PIN de inicio"
            value={pinForm.login_pin}
            onChange={(next) => setPinForm({ ...pinForm, login_pin: next })}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            data-testid="pin-user-login-pin"
          />

          <div>
            <Label>Sucursal</Label>
            <Select
              value={pinForm.branch_id || "none"}
              onValueChange={(v) => setPinForm({ ...pinForm, branch_id: v === "none" ? "" : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecciona sucursal</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.branch_id} value={b.branch_id}>
                    {b.name}
                  </SelectItem>
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
                onCheckedChange={(v) =>
                  setPinForm({ ...pinForm, eligible_for_attendance_bonus: Boolean(v) })
                }
              />
              Bono de puntualidad y asistencia
            </label>
          </div>

          {(pinForm.role === "bodegas" || pinForm.role === "transporte") && (
            <div>
              <Label>Bodega (Opcional)</Label>
              <Select
                value={pinForm.warehouse_id || "none"}
                onValueChange={(v) => setPinForm({ ...pinForm, warehouse_id: v === "none" ? "" : v })}
              >
                <SelectTrigger className="mt-1">
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreatePinUser}
              disabled={
                !pinForm.name.trim() ||
                !pinForm.last_name.trim() ||
                !/^\d{4}-\d{4}$/.test(pinForm.phone) ||
                !pinForm.role ||
                !pinForm.branch_id ||
                pinForm.login_pin.length !== 8 ||
                !canCreate ||
                isSubmitting
              }
              data-testid="save-pin-user-btn"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {isSubmitting ? "Creando..." : "Crear Usuario"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
