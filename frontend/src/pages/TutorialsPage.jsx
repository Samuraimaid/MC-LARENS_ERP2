import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export function TutorialsPage() {
  const shortcuts = [
    { keys: "Alt + C", action: "Ir al buscador de clientes" },
    { keys: "Alt + P", action: "Ir al buscador de productos" },
    { keys: "Ctrl + S", action: "Guardar borrador manualmente" },
    { keys: "↑ / ↓", action: "Mover selección en listas" },
    { keys: "Enter", action: "Seleccionar cliente o agregar producto" },
    { keys: "Esc", action: "Cerrar la búsqueda y ocultar el listado" },
    { keys: "Tab", action: "Avanzar al siguiente campo" },
    { keys: "Shift + Tab", action: "Volver al campo anterior" },
  ];

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Tutoriales y Atajos</h1>
          <p className="text-muted-foreground">Guía paso a paso para usar el sistema de facturación con rapidez y precisión.</p>
        </div>
        <Badge variant="outline">Actualizado</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atajos de teclado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {shortcuts.map((item) => (
              <div key={item.keys} className="flex items-center justify-between rounded-sm border p-3">
                <span className="font-mono text-sm">{item.keys}</span>
                <span className="text-sm text-muted-foreground">{item.action}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inicio de sesión con PIN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <img
              src="/tutorials/login-pin.svg"
              alt="Captura del inicio de sesión con PIN"
              className="w-full rounded-sm border"
            />
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
              <li>Ingresa tu PIN de acceso y presiona Entrar.</li>
              <li>Si el PIN es válido, el sistema crea sesión segura.</li>
              <li>Si el PIN no es correcto, se muestra un mensaje de error.</li>
              <li>El sistema recuerda tu sesión hasta cerrar sesión.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Borradores de venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <img
              src="/tutorials/borradores.svg"
              alt="Captura de borradores de venta"
              className="w-full rounded-sm border"
            />
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
              <li>Cada pestaña de borrador guarda automáticamente cambios.</li>
              <li>Puedes crear múltiples borradores simultáneos.</li>
              <li>Ctrl + S guarda manualmente el borrador activo.</li>
              <li>Al cerrar sesión, puedes conservar o eliminar borradores.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Flujo recomendado de ventas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <img
              src="/tutorials/ventas-flujo.svg"
              alt="Captura del flujo de ventas"
              className="w-full rounded-sm border"
            />
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
              <li>Abre Nueva Venta y selecciona un borrador.</li>
              <li>Busca y selecciona el cliente con Alt + C.</li>
              <li>Busca productos con Alt + P y usa Enter para agregarlos.</li>
              <li>Revisa IVA, descuentos y notas antes de confirmar.</li>
              <li>Guarda el borrador con Ctrl + S si necesitas pausar.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cotizaciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <img
              src="/tutorials/cotizaciones.svg"
              alt="Captura de creación de cotizaciones"
              className="w-full rounded-sm border"
            />
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
              <li>Define los días de validez en la cabecera.</li>
              <li>Agrega cliente, vehículo y productos como en venta.</li>
              <li>Genera la cotización y revisa el PDF antes de convertir.</li>
              <li>Convierte a venta solo si sigue vigente.</li>
              <li>Las cotizaciones convertidas quedan registradas en ventas.</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gestión eficiente de productos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <img
              src="/tutorials/productos.svg"
              alt="Captura de búsqueda de productos"
              className="w-full rounded-sm border"
            />
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
              <li>Escribe parte del nombre o SKU para filtrar.</li>
              <li>Usa PageUp/PageDown para recorrer la lista.</li>
              <li>Presiona Enter para agregar el producto resaltado.</li>
              <li>Activa instalación solo cuando aplica.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buenas prácticas para facturación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <img
              src="/tutorials/atajos.svg"
              alt="Captura de atajos y tips"
              className="w-full rounded-sm border"
            />
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
              <li>Confirma datos del cliente y vehículo antes de facturar.</li>
              <li>Aplica descuentos solo con autorización.</li>
              <li>Genera PDF para revisión rápida con el cliente.</li>
              <li>Guarda borradores para evitar pérdida de datos.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notas sobre capturas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Las imágenes son marcadores de posición. Reemplázalas por capturas reales cuando tengas listas las pantallas definitivas.</p>
          <p>Ubicación sugerida: frontend/public/tutorials/. Mantén los mismos nombres para evitar cambios adicionales.</p>
        </CardContent>
      </Card>
    </div>
  );
}
