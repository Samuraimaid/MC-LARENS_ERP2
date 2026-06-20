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

export function WarehousesPage() {
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Bodegas</h1>
        <p className="text-muted-foreground">Ver y administrar bodegas del sistema</p>
      </div>

      <div className="flex items-center justify-between">
        <div />
        <Dialog open={showNew} onOpenChange={setShowNew}>
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
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {warehouses.map(w => (
                  <TableRow key={w.warehouse_id}>
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
    </div>
  );
}

export default WarehousesPage;
