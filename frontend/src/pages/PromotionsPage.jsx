import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { ContextualDialogHeader } from "../components/ui/contextual-dialog-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { toast } from "sonner";
import { 
  Plus, Search, RefreshCw, Tag, Percent, DollarSign, 
  Calendar as CalendarIcon, Trash2, CheckCircle2, XCircle,
  Gift, Clock, Package
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { API_BASE as API } from "@/lib/api";

export function PromotionsPage() {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showNewPromo, setShowNewPromo] = useState(false);

  // New promotion form
  const [newPromo, setNewPromo] = useState({
    name: "",
    description: "",
    discount_type: "percentage",
    discount_value: "",
    applies_to: "all",
    category: "",
    product_ids: [],
    start_date: new Date(),
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    min_purchase: "",
    is_active: true,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [promosRes, productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/promotions?active_only=${showActiveOnly}`, { withCredentials: true }),
        axios.get(`${API}/products`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
      ]);
      setPromotions(promosRes.data);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data.categories || {});
    } catch (error) {
      toast.error("Error al cargar promociones");
    } finally {
      setLoading(false);
    }
  }, [showActiveOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setNewPromo({
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: "",
      applies_to: "all",
      category: "",
      product_ids: [],
      start_date: new Date(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      min_purchase: "",
      is_active: true,
    });
  };

  const createPromotion = async () => {
    if (!newPromo.name || !newPromo.discount_value) {
      toast.error("Completa nombre y valor de descuento");
      return;
    }
    try {
      const payload = {
        name: newPromo.name,
        description: newPromo.description,
        discount_type: newPromo.discount_type,
        discount_value: parseFloat(newPromo.discount_value),
        applies_to: newPromo.applies_to,
        category: newPromo.applies_to === "category" ? newPromo.category : null,
        product_ids: newPromo.applies_to === "product" ? newPromo.product_ids : null,
        start_date: newPromo.start_date.toISOString(),
        end_date: newPromo.end_date.toISOString(),
        min_purchase: parseFloat(newPromo.min_purchase) || 0,
        is_active: newPromo.is_active,
      };
      await axios.post(`${API}/promotions`, payload, { withCredentials: true });
      toast.success("Promoción creada");
      setShowNewPromo(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear promoción");
    }
  };

  const togglePromoStatus = async (promo) => {
    try {
      await axios.put(`${API}/promotions/${promo.promotion_id}`, {
        is_active: !promo.is_active
      }, { withCredentials: true });
      toast.success(promo.is_active ? "Promoción desactivada" : "Promoción activada");
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar promoción");
    }
  };

  const deletePromotion = async (promo) => {
    if (!window.confirm(`¿Eliminar promoción "${promo.name}"?`)) return;
    try {
      await axios.delete(`${API}/promotions/${promo.promotion_id}`, { withCredentials: true });
      toast.success("Promoción eliminada");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar promoción");
    }
  };

  const filteredPromotions = promotions.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const isPromoActive = (promo) => {
    if (!promo.is_active) return false;
    const now = new Date();
    const start = new Date(promo.start_date);
    const end = new Date(promo.end_date);
    return now >= start && now <= end;
  };

  const getStats = () => {
    const active = promotions.filter(p => isPromoActive(p));
    const upcoming = promotions.filter(p => {
      const start = new Date(p.start_date);
      return p.is_active && start > new Date();
    });
    const expired = promotions.filter(p => {
      const end = new Date(p.end_date);
      return end < new Date();
    });
    return { active: active.length, upcoming: upcoming.length, expired: expired.length, total: promotions.length };
  };

  const stats = getStats();

  return (
    <div className="p-6 space-y-6" data-testid="promotions-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Promociones</h1>
          <p className="text-muted-foreground">Gestión de descuentos y ofertas de temporada</p>
        </div>
        <Dialog open={showNewPromo} onOpenChange={(open) => { setShowNewPromo(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="new-promo-btn">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Promoción
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <ContextualDialogHeader
              variant="success"
              size="inline"
              title="Nueva Promoción"
              description="Crea una nueva promoción o descuento"
            />
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input
                    value={newPromo.name}
                    onChange={(e) => setNewPromo({ ...newPromo, name: e.target.value })}
                    placeholder="Ej: Descuento de Navidad"
                    data-testid="promo-name"
                  />
                </div>
                <div>
                  <Label>Tipo de Descuento *</Label>
                  <Select 
                    value={newPromo.discount_type} 
                    onValueChange={(v) => setNewPromo({ ...newPromo, discount_type: v })}
                  >
                    <SelectTrigger data-testid="promo-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                      <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={newPromo.description}
                  onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                  placeholder="Descripción de la promoción..."
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor del Descuento *</Label>
                  <div className="relative">
                    {newPromo.discount_type === "percentage" ? (
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input
                      type="number"
                      step={newPromo.discount_type === "percentage" ? "1" : "0.01"}
                      value={newPromo.discount_value}
                      onChange={(e) => setNewPromo({ ...newPromo, discount_value: e.target.value })}
                      placeholder={newPromo.discount_type === "percentage" ? "15" : "10.00"}
                      className="pl-9"
                      data-testid="promo-value"
                    />
                  </div>
                </div>
                <div>
                  <Label>Compra Mínima</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      value={newPromo.min_purchase}
                      onChange={(e) => setNewPromo({ ...newPromo, min_purchase: e.target.value })}
                      placeholder="0.00"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Aplica a</Label>
                <Select 
                  value={newPromo.applies_to} 
                  onValueChange={(v) => setNewPromo({ ...newPromo, applies_to: v, category: "", product_ids: [] })}
                >
                  <SelectTrigger data-testid="promo-applies">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Productos</SelectItem>
                    <SelectItem value="category">Categoría Específica</SelectItem>
                    <SelectItem value="product">Productos Específicos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {newPromo.applies_to === "category" && (
                <div>
                  <Label>Categoría</Label>
                  <Select 
                    value={newPromo.category} 
                    onValueChange={(v) => setNewPromo({ ...newPromo, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categories).map(([key, cat]) => (
                        <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {newPromo.applies_to === "product" && (
                <div>
                  <Label>Productos (selecciona múltiples)</Label>
                  <div className="border rounded-lg p-2 max-h-32 overflow-y-auto mt-2">
                    {products.slice(0, 20).map(product => (
                      <div
                        key={product.product_id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                          newPromo.product_ids.includes(product.product_id) ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => {
                          const ids = newPromo.product_ids.includes(product.product_id)
                            ? newPromo.product_ids.filter(id => id !== product.product_id)
                            : [...newPromo.product_ids, product.product_id];
                          setNewPromo({ ...newPromo, product_ids: ids });
                        }}
                      >
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{product.name}</span>
                        {newPromo.product_ids.includes(product.product_id) && (
                          <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                  {newPromo.product_ids.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {newPromo.product_ids.length} producto(s) seleccionado(s)
                    </p>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha Inicio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newPromo.start_date, "PPP", { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newPromo.start_date}
                        onSelect={(date) => date && setNewPromo({ ...newPromo, start_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Fecha Fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newPromo.end_date, "PPP", { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newPromo.end_date}
                        onSelect={(date) => date && setNewPromo({ ...newPromo, end_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={newPromo.is_active}
                  onCheckedChange={(checked) => setNewPromo({ ...newPromo, is_active: checked })}
                />
                <Label htmlFor="active">Activar inmediatamente</Label>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowNewPromo(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={createPromotion} data-testid="save-promo-btn">
                <Gift className="h-4 w-4 mr-2" />
                Crear Promoción
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              ACTIVAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-green-500">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              PRÓXIMAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-blue-500">{stats.upcoming}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-500" />
              EXPIRADAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-gray-500">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              TOTAL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar promoción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="search-promotions"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="activeOnly"
            checked={showActiveOnly}
            onCheckedChange={setShowActiveOnly}
          />
          <Label htmlFor="activeOnly">Solo activas</Label>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Promotions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>Aplica a</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Compra Mín.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredPromotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay promociones para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                filteredPromotions.map(promo => {
                  const active = isPromoActive(promo);
                  const startDate = new Date(promo.start_date);
                  const endDate = new Date(promo.end_date);
                  
                  return (
                    <TableRow key={promo.promotion_id} data-testid={`promo-row-${promo.promotion_id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{promo.name}</p>
                          {promo.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {promo.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          {promo.discount_type === "percentage" ? (
                            <>
                              <Percent className="h-3 w-3" />
                              {promo.discount_value}%
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-3 w-3" />
                              {promo.discount_value}
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {promo.applies_to === "all" && (
                          <Badge variant="outline">Todos</Badge>
                        )}
                        {promo.applies_to === "category" && (
                          <Badge variant="outline">{categories[promo.category]?.name || promo.category}</Badge>
                        )}
                        {promo.applies_to === "product" && (
                          <Badge variant="outline">{promo.product_ids?.length || 0} productos</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(startDate, "dd/MM/yy")}</p>
                          <p className="text-muted-foreground">al {format(endDate, "dd/MM/yy")}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {promo.min_purchase > 0 ? formatCurrency(promo.min_purchase) : "-"}
                      </TableCell>
                      <TableCell>
                        {active ? (
                          <Badge className="bg-green-500 text-white">Activa</Badge>
                        ) : promo.is_active && startDate > new Date() ? (
                          <Badge className="bg-blue-500 text-white">Próxima</Badge>
                        ) : (
                          <Badge variant="secondary">Inactiva</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => togglePromoStatus(promo)}
                            title={promo.is_active ? "Desactivar" : "Activar"}
                          >
                            {promo.is_active ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePromotion(promo)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
