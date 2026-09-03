import React, { useEffect, useState } from "react";
import { CreditCard, PercentCircle, Package, AlertTriangle, FileDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const SEMANTIC_COLORS = {
  ANULACION: "#f87171",
  DEVOLUCION: "#60a5fa",
  DEFAULT: "#fbbf24",
};

export default function ExecutiveAuditDashboard() {
  const [kpis, setKpis] = useState({
    totalDescuentos: 0,
    tasaAnulacion: 0,
    retornoInventario: { merma: 0, garantia: 0, stock: 0 },
  });
  const [causas, setCausas] = useState([]);
  const [tabla, setTabla] = useState([]);
  const [alerta, setAlerta] = useState("");
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    fetch("/api/reports/executive-audit")
      .then((response) => response.json())
      .then((data) => {
        setKpis(data.kpis || { totalDescuentos: 0, tasaAnulacion: 0, retornoInventario: { merma: 0, garantia: 0, stock: 0 } });
        setCausas(data.causas || []);
        setTabla(data.tabla || []);
        if ((data.causas || []).find((cause) => cause.name === "Incompatibilidad de vehículo" && cause.value > 10)) {
          setAlerta("Alerta: Más del 10% de anulaciones/devoluciones son por incompatibilidad de vehículo. Revisa el catálogo.");
        }
      });
  }, []);

  const exportar = async (tipo) => {
    setExportando(true);
    try {
      const response = await fetch(`/api/reports/executive-audit/export?type=${tipo}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = tipo === "csv" ? "reporte_incidencias.csv" : "reporte_incidencias.pdf";
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast.success("Reporte exportado correctamente");
    } catch {
      toast.error("Error al exportar reporte");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded border-l-4 border-orange-400 bg-white p-4 shadow">
          <CreditCard className="text-orange-500" />
          <div>
            <div className="text-xs text-gray-500">Total Descuentos en Tarjeta</div>
            <div className="text-xl font-bold">${kpis.totalDescuentos.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded border-l-4 border-red-400 bg-white p-4 shadow">
          <PercentCircle className="text-red-500" />
          <div>
            <div className="text-xs text-gray-500">Tasa de Anulación</div>
            <div className="text-xl font-bold">{kpis.tasaAnulacion.toFixed(1)}%</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded border-l-4 border-blue-400 bg-white p-4 shadow">
          <Package className="text-blue-500" />
          <div>
            <div className="text-xs text-gray-500">Retorno de Inventario</div>
            <div className="text-sm">Merma: <b>${kpis.retornoInventario.merma.toFixed(2)}</b></div>
            <div className="text-sm">Garantía: <b>${kpis.retornoInventario.garantia.toFixed(2)}</b></div>
            <div className="text-sm">Stock: <b>${kpis.retornoInventario.stock.toFixed(2)}</b></div>
          </div>
        </div>
      </div>

      {alerta && (
        <div className="mb-4 flex items-center gap-2 rounded border-l-4 border-yellow-400 bg-yellow-100 p-3">
          <AlertTriangle className="text-yellow-600" />
          <span className="text-sm text-yellow-800">{alerta}</span>
        </div>
      )}

      <div className="mb-6 rounded bg-white p-4 shadow">
        <h2 className="mb-2 font-bold">Causas Raíz de Anulaciones/Devoluciones</h2>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={causas} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {causas.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.name === "Anulación" ? SEMANTIC_COLORS.ANULACION : entry.name === "Devolución" ? SEMANTIC_COLORS.DEVOLUCION : SEMANTIC_COLORS.DEFAULT}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6 rounded bg-white p-4 shadow">
        <div className="mb-2 flex items-center">
          <h2 className="flex-1 font-bold">Desempeño por Rol</h2>
          <button
            className="flex items-center gap-1 rounded bg-gray-100 px-3 py-1 hover:bg-gray-200"
            onClick={() => exportar("csv")}
            disabled={exportando}
            type="button"
          >
            <FileDown size={16} /> Exportar CSV
          </button>
          <button
            className="ml-2 flex items-center gap-1 rounded bg-gray-100 px-3 py-1 hover:bg-gray-200"
            onClick={() => exportar("pdf")}
            disabled={exportando}
            type="button"
          >
            <FileDown size={16} /> Exportar PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-700">
                <th className="px-4 py-3 font-medium">Cajero</th>
                <th className="px-4 py-3 font-medium">Solicitudes de Aprobación</th>
                <th className="px-4 py-3 font-medium">Gerente que Aprobó</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((row) => (
                <tr key={row.cajero} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3">{row.cajero}</td>
                  <td className="px-4 py-3">{row.solicitudes}</td>
                  <td className="px-4 py-3">{row.gerente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
