import React, { useState } from "react";
import axios from "axios";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Calendar, Download, TrendingUp, Users, Wrench, RefreshCw } from "lucide-react";
import { API_BASE as API } from "@/lib/api";

const COLORS = ["hsl(217, 91%, 60%)", "hsl(160, 84%, 39%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(262, 83%, 58%)"];

export function ReportsPage() {
  const [reportType, setReportType] = useState("sales");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [salesReport, setSalesReport] = useState(null);
  const [installationsReport, setInstallationsReport] = useState(null);

  const generateReport = async () => {
    setLoading(true);
    try {
      if (reportType === "sales") {
        const response = await axios.get(`${API}/reports/sales`, {
          params: { start_date: startDate, end_date: endDate },
          withCredentials: true,
        });
        setSalesReport(response.data);
        setInstallationsReport(null);
      } else {
        const response = await axios.get(`${API}/reports/installations`, {
          params: { start_date: startDate, end_date: endDate },
          withCredentials: true,
        });
        setInstallationsReport(response.data);
        setSalesReport(null);
      }
      toast.success("Reporte generado");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al generar reporte");
    } finally {
      setLoading(false);
    }
  };

  const getSalesChartData = () => {
    if (!salesReport?.by_salesperson) return [];
    return Object.entries(salesReport.by_salesperson).map(([name, data]) => ({
      name: name.split(" ")[0],
      ventas: data.total,
      cantidad: data.count,
    }));
  };

  const getPaymentChartData = () => {
    if (!salesReport?.by_payment_type) return [];
    const labels = { cash: "Contado", credit: "Crédito", stripe: "Tarjeta" };
    return Object.entries(salesReport.by_payment_type).map(([type, value]) => ({
      name: labels[type] || type,
      value: value,
    }));
  };

  const getInstallationsChartData = () => {
    if (!installationsReport?.by_technician) return [];
    return Object.entries(installationsReport.by_technician).map(([name, data]) => ({
      name: name.split(" ")[0],
      instalaciones: data.count,
      calidad: data.avg_quality,
    }));
  };

  return (
    <div className="p-6 space-y-6" data-testid="reports-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">Análisis de ventas e instalaciones</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <Label>Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-48" data-testid="report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Ventas</SelectItem>
                  <SelectItem value="installations">Instalaciones</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="start-date"
              />
            </div>
            <div>
              <Label>Fecha Fin</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="end-date"
              />
            </div>
            <Button onClick={generateReport} disabled={loading} data-testid="generate-report-btn">
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Generar Reporte
            </Button>
            {salesReport && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => window.open(`${API}/reports/export/sales?start_date=${startDate}&end_date=${endDate}&format=csv`, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open(`${API}/reports/export/sales?start_date=${startDate}&end_date=${endDate}&format=pdf`, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales Report */}
      {salesReport && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="metric-card border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL VENTAS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-heading text-3xl font-bold tabular-nums">
                  {formatCurrency(salesReport.total_sales)}
                </div>
                <p className="text-sm text-muted-foreground">{salesReport.total_count} transacciones</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">PROMEDIO POR VENTA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-heading text-3xl font-bold tabular-nums">
                  {formatCurrency(salesReport.total_count > 0 ? salesReport.total_sales / salesReport.total_count : 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">VENDEDORES ACTIVOS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-heading text-3xl font-bold tabular-nums">
                  {Object.keys(salesReport.by_salesperson || {}).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Ventas por Vendedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getSalesChartData()}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.25rem"
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Bar dataKey="ventas" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Ventas por Tipo de Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getPaymentChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getPaymentChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Installations Report */}
      {installationsReport && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="metric-card border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL INSTALACIONES</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-heading text-3xl font-bold tabular-nums">
                  {installationsReport.total_installations}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">TIEMPO TOTAL</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-heading text-3xl font-bold tabular-nums">
                  {Math.floor(installationsReport.total_time_minutes / 60)}h {installationsReport.total_time_minutes % 60}m
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">CALIDAD PROMEDIO</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-heading text-3xl font-bold tabular-nums">
                  {installationsReport.avg_quality}/10
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Rendimiento por Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getInstallationsChartData()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.25rem"
                    }}
                  />
                  <Bar dataKey="instalaciones" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!salesReport && !installationsReport && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecciona un tipo de reporte y rango de fechas para comenzar</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
