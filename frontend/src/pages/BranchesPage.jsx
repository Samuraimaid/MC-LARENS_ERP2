import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Building2, MapPin, Phone, RefreshCw, Edit, Trash2 } from "lucide-react";
import { API_BASE as API } from "@/lib/api";

export function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    manager_name: "",
    is_active: true,
    logo_url: "",
    company_name: "",
    company_legal_name: "",
    company_tax_id: "",
    company_vat: "",
    company_address: "",
    company_city: "",
    company_country: "",
    company_phone: "",
    company_email: "",
    company_website: ""
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/branches`, { withCredentials: true });
      setBranches(response.data);
    } catch (error) {
      toast.error("Error al cargar sucursales");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      phone: "",
      manager_name: "",
      is_active: true,
      logo_url: "",
      company_name: "",
      company_legal_name: "",
      company_tax_id: "",
      company_vat: "",
      company_address: "",
      company_city: "",
      company_country: "",
      company_phone: "",
      company_email: "",
      company_website: ""
    });
    setEditingBranch(null);
  };

  const createBranch = async () => {
    if (!formData.name) {
      toast.error("El nombre es requerido");
      return;
    }
    
    try {
      await axios.post(`${API}/branches`, formData, { withCredentials: true });
      toast.success("Sucursal creada exitosamente");
      setShowNew(false);
      resetForm();
      fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear sucursal");
    }
  };

  const updateBranch = async () => {
    if (!editingBranch || !formData.name) {
      toast.error("El nombre es requerido");
      return;
    }
    
    try {
      await axios.put(`${API}/branches/${editingBranch.branch_id}`, formData, { withCredentials: true });
      toast.success("Sucursal actualizada");
      setEditingBranch(null);
      resetForm();
      fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar sucursal");
    }
  };

  const deleteBranch = async (branchId, branchName) => {
    if (!window.confirm(`¿Eliminar sucursal "${branchName}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/branches/${branchId}`, { withCredentials: true });
      toast.success("Sucursal eliminada");
      fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar sucursal");
    }
  };

  const startEditing = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      manager_name: branch.manager_name || "",
      is_active: branch.is_active !== false,
      logo_url: branch.logo_url || "",
      company_name: branch.company_name || "",
      company_legal_name: branch.company_legal_name || "",
      company_tax_id: branch.company_tax_id || "",
      company_vat: branch.company_vat || "",
      company_address: branch.company_address || "",
      company_city: branch.company_city || "",
      company_country: branch.company_country || "",
      company_phone: branch.company_phone || "",
      company_email: branch.company_email || "",
      company_website: branch.company_website || ""
    });
  };

  return (
    <div className="p-6 space-y-6" data-testid="branches-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Sucursales</h1>
          <p className="text-muted-foreground">Gestión de sucursales y puntos de venta</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBranches}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={showNew} onOpenChange={(open) => { setShowNew(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="new-branch-btn">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Sucursal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nueva Sucursal</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Logo (URL)</Label>
                  <Input
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://.../logo.png"
                  />
                  {formData.logo_url && (
                    <img src={formData.logo_url} alt="Logo" className="mt-2 h-12 object-contain" />
                  )}
                </div>
                <div>
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Sucursal Centro"
                    data-testid="branch-name"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Dirección</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Calle Principal #123"
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+505-0000-0000"
                  />
                </div>
                <div>
                  <Label>Gerente</Label>
                  <Input
                    value={formData.manager_name}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    placeholder="Nombre del gerente"
                  />
                </div>
                <div>
                  <div>
                    <Label>Nombre Empresa</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Nombre Comercial"
                    />
                  </div>
                </div>
                <div>
                  <Label>Razón Social</Label>
                  <Input
                    value={formData.company_legal_name}
                    onChange={(e) => setFormData({ ...formData, company_legal_name: e.target.value })}
                    placeholder="Razón Social"
                  />
                </div>
                <div>
                  <div>
                    <Label>RUC</Label>
                    <Input
                      value={formData.company_tax_id}
                      onChange={(e) => setFormData({ ...formData, company_tax_id: e.target.value })}
                      placeholder="RUC"
                    />
                  </div>
                </div>
                <div>
                  <Label>VAT</Label>
                  <Input
                    value={formData.company_vat}
                    onChange={(e) => setFormData({ ...formData, company_vat: e.target.value })}
                    placeholder="VAT"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Dirección Empresa</Label>
                  <Input
                    value={formData.company_address}
                    onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                    placeholder="Dirección fiscal"
                  />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input
                    value={formData.company_city}
                    onChange={(e) => setFormData({ ...formData, company_city: e.target.value })}
                    placeholder="Ciudad"
                  />
                </div>
                <div>
                  <Label>País</Label>
                  <Input
                    value={formData.company_country}
                    onChange={(e) => setFormData({ ...formData, company_country: e.target.value })}
                    placeholder="País"
                  />
                </div>
                <div>
                  <Label>Teléfono Empresa</Label>
                  <Input
                    value={formData.company_phone}
                    onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                    placeholder="Teléfono"
                  />
                </div>
                <div>
                  <Label>Email Empresa</Label>
                  <Input
                    value={formData.company_email}
                    onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                    placeholder="correo@empresa.com"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Website</Label>
                  <Input
                    value={formData.company_website}
                    onChange={(e) => setFormData({ ...formData, company_website: e.target.value })}
                    placeholder="https://empresa.com"
                  />
                </div>
                <div className="col-span-2">
                  <Button onClick={createBranch} className="w-full" data-testid="save-branch-btn">
                  Crear Sucursal
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL SUCURSALES</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{branches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ACTIVAS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-green-500">
              {branches.filter(b => b.is_active !== false).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">INACTIVAS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-orange-500">
              {branches.filter(b => b.is_active === false).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Sucursales</CardTitle>
          <CardDescription>Todas las sucursales registradas en el sistema</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sucursal</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Gerente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : branches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay sucursales registradas</p>
                  </TableCell>
                </TableRow>
              ) : (
                branches.map(branch => (
                  <TableRow key={branch.branch_id} data-testid={`branch-${branch.branch_id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {branch.logo_url ? (
                          <img src={branch.logo_url} alt="logo" className="h-6 w-6 object-contain" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{branch.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {branch.address ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {branch.address}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {branch.phone ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {branch.phone}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{branch.manager_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={branch.is_active !== false ? "default" : "secondary"}>
                        {branch.is_active !== false ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEditing(branch)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteBranch(branch.branch_id, branch.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingBranch} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Sucursal</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Logo (URL)</Label>
                  <Input
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://.../logo.png"
                  />
                  {formData.logo_url && (
                    <img src={formData.logo_url} alt="Logo" className="mt-2 h-12 object-contain" />
                  )}
                </div>
            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Sucursal Centro"
              />
            </div>
            <div className="col-span-2">
              <Label>Dirección</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle Principal #123"
              />
            </div>
            <div>
              <Label>Nombre Empresa</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Nombre Comercial"
              />
            </div>
            <div>
              <Label>Razón Social</Label>
              <Input
                value={formData.company_legal_name}
                onChange={(e) => setFormData({ ...formData, company_legal_name: e.target.value })}
                placeholder="Razón Social"
              />
            </div>
            <div>
              <Label>RUC</Label>
              <Input
                value={formData.company_tax_id}
                onChange={(e) => setFormData({ ...formData, company_tax_id: e.target.value })}
                placeholder="RUC"
              />
            </div>
            <div>
              <Label>VAT</Label>
              <Input
                value={formData.company_vat}
                onChange={(e) => setFormData({ ...formData, company_vat: e.target.value })}
                placeholder="VAT"
              />
            </div>
            <div className="col-span-2">
              <Label>Dirección Empresa</Label>
              <Input
                value={formData.company_address}
                onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                placeholder="Dirección fiscal"
              />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input
                value={formData.company_city}
                onChange={(e) => setFormData({ ...formData, company_city: e.target.value })}
                placeholder="Ciudad"
              />
            </div>
            <div>
              <Label>País</Label>
              <Input
                value={formData.company_country}
                onChange={(e) => setFormData({ ...formData, company_country: e.target.value })}
                placeholder="País"
              />
            </div>
            <div>
              <Label>Teléfono Empresa</Label>
              <Input
                value={formData.company_phone}
                onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                placeholder="Teléfono"
              />
            </div>
            <div>
              <Label>Email Empresa</Label>
              <Input
                value={formData.company_email}
                onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                placeholder="correo@empresa.com"
              />
            </div>
            <div className="col-span-2">
              <Label>Website</Label>
              <Input
                value={formData.company_website}
                onChange={(e) => setFormData({ ...formData, company_website: e.target.value })}
                placeholder="https://empresa.com"
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+505-0000-0000"
              />
            </div>
            <div>
              <Label>Gerente</Label>
              <Input
                value={formData.manager_name}
                onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                placeholder="Nombre del gerente"
              />
            </div>
            <div className="col-span-2">
              <Button onClick={updateBranch} className="w-full">
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
