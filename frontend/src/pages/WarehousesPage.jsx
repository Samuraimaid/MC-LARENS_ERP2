import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableRow, TableCell, TableHead } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useListDensity } from "@/hooks/useListDensity";
import { ListDensityToggle } from "@/components/lists/ListDensityToggle";
import { BackToTopButton } from "@/components/lists/BackToTopButton";
import { Checkbox } from "@/components/ui/checkbox";
import { ListSelectionBar } from "@/components/lists/ListSelectionBar";
import { useListSelection } from "@/hooks/useListSelection";
import { useListScrollRestore } from "@/hooks/useListScrollRestore";
import { downloadCsv, copyTextToClipboard } from "@/components/lists/listBulkUtils";
import { Download, Copy } from "lucide-react";

export function WarehousesPage() {
  const { density: listDensity, setDensity: setListDensity, tokens: densityTok } = useListDensity();
  const selection = useListSelection();
  const scrollRestore = useListScrollRestore({ pageKey: "warehouses" });


  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({ warehouse_id: "", name: "" });

  const fetch = async () => {
    setLoading(true);
    try {
          const response = await axios.get(`${API}/warehouses`, { withCredentials: true });
          setWarehouses(response.data || []);
    } catch (err) {
          /* ignore failures */
          toast.error("No se pudo cargar las bodegas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const createWarehouse = async () => {
    if (!newWarehouse.warehouse_id || !newWarehouse.name) {
      toast.error("Completa ID y Nombre");
      return;
    }
    try {
          await axios.post(`${API}/warehouses`, newWarehouse, { withCredentials: true });
      toast.success("Bodega creada");
      setNewWarehouse({ warehouse_id: "", name: "" });
      setShowNew(false);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error creando bodega");
    }
  };

  const tryAction = async (method, url, data = null) => {
    try {
      if (method === "delete") {
        await axios.delete(url, { withCredentials: true });
      } else if (method === "put") {
        await axios.put(url, data, { withCredentials: true });
      }
      toast.success("Operación completada");
      fetch();
    } catch (err) {
      // Backend may not implement update/delete for warehouses
      toast.error(err.response?.data?.detail || "Operación no disponible en la API");
    }
  };

  const visibleWarehouseIds = warehouses.map((w) => w.warehouse_id);
  const selectedWarehouses = warehouses.filter((w) => selection.isSelected(w.warehouse_id));
  const exportWarehousesCsv = () => {
    const rowsSrc = selectedWarehouses.length ? selectedWarehouses : warehouses;
    if (!rowsSrc.length) { toast.error("No hay bodegas"); return; }
    downloadCsv(`bodegas_${new Date().toISOString().slice(0,10)}.csv`, ["warehouse_id","nombre"], rowsSrc.map(w => [w.warehouse_id, w.name]));
    toast.success(`CSV exportado (${rowsSrc.length})`);
  };
  const copyWarehouseIds = async () => {
    if (!selectedWarehouses.length) { toast.error("Selecciona bodegas"); return; }
    try { await copyTextToClipboard(selectedWarehouses.map(w => w.warehouse_id).join(", ")); toast.success("IDs copiados"); }
    catch { toast.error("No se pudo copiar"); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-end mb-2">
        <ListDensityToggle value={listDensity} onChange={setListDensity} testId="warehouses-list-density" />
      </div>

      <ListSelectionBar
        hideSearch
        selectedCount={selection.count}
        visibleCount={visibleWarehouseIds.length}
        allVisibleSelected={selection.allVisibleSelected(visibleWarehouseIds)}
        someVisibleSelected={selection.someVisibleSelected(visibleWarehouseIds)}
        onSelectAll={() => selection.toggleAllVisible(visibleWarehouseIds)}
        onDeselectAll={selection.clear}
        testId="warehouses-selection-bar"
      >
        <Button type="button" variant="secondary" size="sm" className="h-8" onClick={exportWarehousesCsv}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={selection.count===0} onClick={copyWarehouseIds}>
          <Copy className="h-4 w-4 mr-1" /> Copiar IDs
        </Button>
      </ListSelectionBar>

      <div>
        <h1 className="font-heading text-2xl mb-1 font-bold tracking-tight md:mb-0 md:text-3xl">Bodegas</h1>
        <p className="hidden text-muted-foreground md:block">Ver y administrar bodegas del sistema</p>
      </div>

      <div className="flex items-center justify-between">
        <div />
        <Dialog open={showNew} onOpenChange={(open) => {
          if (open) scrollRestore.save();
          setShowNew(open);
          if (!open) scrollRestore.restore();
        }}>
          <DialogTrigger asChild>
            <Button>
              Nueva Bodega
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nueva bodega</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label>ID</Label>
                <Input value={newWarehouse.warehouse_id} onChange={e => setNewWarehouse({...newWarehouse, warehouse_id: e.target.value})} />
              </div>
              <div>
                <Label>Nombre</Label>
                <Input value={newWarehouse.name} onChange={e => setNewWarehouse({...newWarehouse, name: e.target.value})} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowNew(false)} variant="outline">Cancelar</Button>
                <Button onClick={createWarehouse}>Crear</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bodegas registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Cargando...</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow className={densityTok.tableRow}>
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selection.allVisibleSelected(visibleWarehouseIds) ? true : selection.someVisibleSelected(visibleWarehouseIds) ? "indeterminate" : false}
                      onCheckedChange={() => selection.toggleAllVisible(visibleWarehouseIds)}
                    />
                  </TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {warehouses.map(w => (
                  <TableRow className={densityTok.tableRow} key={w.warehouse_id}>
                    <TableCell onClick={(e)=>e.stopPropagation()}>
                      <Checkbox checked={selection.isSelected(w.warehouse_id)} onCheckedChange={() => selection.toggle(w.warehouse_id)} />
                    </TableCell>
                    <TableCell>{w.warehouse_id}</TableCell>
                    <TableCell>{w.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => tryAction('put', `${API}/warehouses/${w.warehouse_id}`, { name: w.name })}>Editar</Button>
                        <Button size="sm" variant="destructive" onClick={() => tryAction('delete', `${API}/warehouses/${w.warehouse_id}`)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <BackToTopButton />
    </div>
  );
}

export default WarehousesPage;
