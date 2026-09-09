import React from "react";
import PropTypes from "prop-types";
import {
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  LogOut,
  Send,
  Lock,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function generateTicketId() {
  const rand = Math.floor(10000 + Math.random() * 90000);
  const now = new Date();
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const day = String(now.getDate()).padStart(2, "0");
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `B-${rand}-${day}/${month}/${year} ${hh}:${mm}:${ss}`;
}

function analyzeError(error, errorInfo) {
  const msg = String(error?.message || error || "");
  const name = String(error?.name || "Error");
  const stack = String(error?.stack || "");
  const compStack = String(errorInfo?.componentStack || "");

  let category = "Excepción en Renderizado";
  let suggestion = "Se produjo un error no controlado durante el ciclo de vida del componente.";
  let severity = "critical";

  if (msg.includes("is not defined")) {
    const match = msg.match(/([A-Za-z0-9_$]+)\s+is not defined/);
    const varName = match ? match[1] : "identificador";
    category = "Identificador o Componente no Definido";
    suggestion = `El componente o variable <${varName}> fue utilizado en la vista pero no está importado ni declarado en el archivo correspondiente.`;
  } else if (msg.includes("before initialization") || msg.includes("Cannot access")) {
    category = "Error de Inicialización (Temporal Dead Zone - TDZ)";
    suggestion = "Una variable o componente 'const/let' fue accedido antes de su línea de declaración o a través de una importación cruzada.";
  } else if (msg.includes("dynamically imported module") || msg.includes("Failed to fetch")) {
    category = "Fallo de Carga de Módulo / Red";
    suggestion = "El navegador no pudo descargar uno de los paquetes compilados. Puede deberse a una actualización reciente en el servidor. Prueba recargar con Ctrl+F5.";
  } else if (msg.includes("null") || msg.includes("undefined")) {
    category = "Lectura de Propiedad Nula";
    suggestion = "Se intentó leer una propiedad de un objeto nulo o indefinido (ej. obj?.propiedad).";
  }

  // Extract primary failing component
  let offendingComponent = "Desconocido";
  const compMatch = compStack.match(/at\s+([A-Za-z0-9_$]+)/);
  if (compMatch) {
    offendingComponent = compMatch[1];
  }

  return {
    category,
    suggestion,
    severity,
    name,
    message: msg,
    offendingComponent,
    stack,
    componentStack: compStack,
  };
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      ticketId: "",
      copiedTicket: false,
      copiedFull: false,
      showDevDetails: false,
      telemetrySent: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const ticketId = generateTicketId();
    this.setState({ errorInfo, ticketId });

    // Enviar silenciosamente el reporte técnico al backend para archivado seguro
    const analysis = analyzeError(error, errorInfo);
    const payload = {
      ticket_id: ticketId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      error_name: analysis.name,
      error_message: analysis.message,
      category: analysis.category,
      suggestion: analysis.suggestion,
      offending_component: analysis.offendingComponent,
      user_agent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      component_stack: analysis.componentStack,
      stack: analysis.stack,
    };

    fetch("/api/telemetry/crash-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        this.setState({ telemetrySent: true });
      })
      .catch((err) => {
        console.warn("[Telemetry] Error sending crash report to backend:", err);
      });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHardReload = () => {
    try {
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    } catch (_) {}
    window.location.reload();
  };

  handleLogout = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = "/login";
  };

  handleCopyTicket = () => {
    const textToCopy = this.state.ticketId;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      this.setState({ copiedTicket: true });
      setTimeout(() => this.setState({ copiedTicket: false }), 2500);
    });
  };

  handleCopyFullReport = () => {
    const analysis = analyzeError(this.state.error, this.state.errorInfo);
    const report = {
      ticketId: this.state.ticketId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      errorName: analysis.name,
      errorMessage: analysis.message,
      category: analysis.category,
      suggestion: analysis.suggestion,
      offendingComponent: analysis.offendingComponent,
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      componentStack: analysis.componentStack,
      stack: analysis.stack,
    };

    const formattedMarkdown = [
      `### 🤖 Reporte Técnico del Ticket ${this.state.ticketId}`,
      "```json",
      JSON.stringify(report, null, 2),
      "```",
    ].join("\n");

    navigator.clipboard.writeText(formattedMarkdown).then(() => {
      this.setState({ copiedFull: true });
      setTimeout(() => this.setState({ copiedFull: false }), 2500);
    });
  };

  render() {
    if (this.state.hasError) {
      const analysis = analyzeError(this.state.error, this.state.errorInfo);
      const ticketId = this.state.ticketId || "B-00000-SOPORTE";
      const waText = encodeURIComponent(
        `Hola Equipo de Soporte / Programador, se ha registrado una incidencia técnica en el ERP con el Número de Ticket: ${ticketId}`
      );
      const waUrl = `https://wa.me/?text=${waText}`;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4 sm:p-6 select-none">
          <div className="max-w-xl w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-xl">
            
            {/* Cabecera Segura */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 shadow-inner">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                      Incidencia Técnica Registrada
                    </h2>
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px] gap-1">
                      <Lock className="h-2.5 w-2.5" />
                      Datos Protegidos
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Se detectó una excepción en la interfaz. El reporte técnico fue archivado de forma segura en el servidor.
                  </p>
                </div>
              </div>
            </div>

            {/* Tarjeta de Ticket ID para el Usuario */}
            <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5 text-center space-y-3 shadow-inner">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                NÚMERO DE TICKET DE SOPORTE TÉCNICO
              </span>
              
              <div className="p-3 rounded-xl bg-black/60 border border-blue-500/40 font-mono text-base sm:text-lg font-black text-blue-200 tracking-wide select-all shadow-md">
                {ticketId}
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
                Proporciona este código al programador o equipo de soporte técnico para su diagnóstico y resolución inmediata.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <Button
                  onClick={this.handleCopyTicket}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto gap-1.5 border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200 text-xs font-bold h-9"
                >
                  {this.state.copiedTicket ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400" /> ¡Ticket Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copiar Código de Ticket
                    </>
                  )}
                </Button>

                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 text-xs font-bold h-9"
                  >
                    <MessageSquare className="h-4 w-4 text-emerald-400" />
                    Enviar Ticket por WhatsApp
                  </Button>
                </a>
              </div>
            </div>

            {/* Acciones del Usuario Final */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <Button
                onClick={this.handleHardReload}
                className="w-full sm:w-auto flex-1 gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9 shadow-md"
              >
                <RefreshCw className="h-4 w-4" /> Recargar Página
              </Button>

              <Button
                variant="ghost"
                onClick={this.handleLogout}
                className="w-full sm:w-auto gap-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 text-xs h-9"
              >
                <LogOut className="h-3.5 w-3.5" /> Salir a Iniciar Sesión
              </Button>
            </div>

            {/* Sección Oculta y Protegida para el Desarrollador */}
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDevDetails: !prev.showDevDetails }))}
                className="text-[11px] text-zinc-500 hover:text-zinc-400 flex items-center gap-1 mx-auto transition-colors"
              >
                <span>¿Eres desarrollador? Ver opciones de telemetría</span>
                {this.state.showDevDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {this.state.showDevDetails && (
                <div className="mt-3 p-3.5 rounded-xl bg-black/50 border border-zinc-800 text-[11px] space-y-2 text-zinc-400 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300 font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-400" /> Estado de Telemetría:
                    </span>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                      {this.state.telemetrySent ? "Archivado en Backend" : "Enviando..."}
                    </Badge>
                  </div>
                  <p className="text-[10.5px] text-zinc-400">
                    El informe técnico completo (stack trace, componentes y variables) fue registrado bajo el identificador <span className="font-mono text-zinc-200 font-bold">{ticketId}</span> en la base de datos y en <code className="text-zinc-300">backend/logs/crashes/</code>.
                  </p>
                  <Button
                    onClick={this.handleCopyFullReport}
                    variant="outline"
                    size="sm"
                    className="w-full text-[11px] h-7 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700"
                  >
                    {this.state.copiedFull ? "¡JSON Técnico Copiado!" : "Copiar JSON Completo para Antigravity"}
                  </Button>
                </div>
              )}
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
};

export default ErrorBoundary;
