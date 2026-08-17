import React from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  LogOut,
  Sparkles,
  Terminal,
  Bug,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      copied: false,
      showStack: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🤖 [Agente de Diagnóstico ERP] Error capturado:", error, errorInfo);
    this.setState({ errorInfo });
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

  handleCopyReport = () => {
    const analysis = analyzeError(this.state.error, this.state.errorInfo);
    const report = {
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
      "### 🤖 Reporte del Agente de Diagnóstico ERP",
      "```json",
      JSON.stringify(report, null, 2),
      "```",
    ].join("\n");

    navigator.clipboard.writeText(formattedMarkdown).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  render() {
    if (this.state.hasError) {
      const analysis = analyzeError(this.state.error, this.state.errorInfo);

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900/95 text-zinc-100 p-4 sm:p-6 select-none backdrop-blur-md">
          <div className="max-w-2xl w-full rounded-2xl border border-zinc-800 bg-zinc-950/90 p-6 sm:p-8 shadow-2xl space-y-6">
            
            {/* Header with Diagnostic Agent Badge */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <Bug className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                      Agente de Diagnóstico ERP
                    </h2>
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      Captura Automática
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Se detectó una excepción visual. Los detalles han sido aislados para su resolución inmediata.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Summary Card */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {analysis.category}
                </span>
                {analysis.offendingComponent !== "Desconocido" && (
                  <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-300">
                    Componente: &lt;{analysis.offendingComponent}&gt;
                  </Badge>
                )}
              </div>
              <div className="font-mono text-xs sm:text-sm font-semibold text-rose-200 break-words">
                {analysis.message || "Error desconocido en tiempo de ejecución"}
              </div>
            </div>

            {/* Smart Automated Suggestion */}
            <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-4 space-y-1 text-xs">
              <div className="font-semibold text-sky-400 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" /> Diagnóstico Inteligente:
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {analysis.suggestion}
              </p>
            </div>

            {/* Technical Stack Details Collapsible */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showStack: !prev.showStack }))}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                  Ver Trazabilidad Técnica & Stack Trace
                </span>
                {this.state.showStack ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {this.state.showStack && (
                <div className="p-4 border-t border-zinc-800 space-y-3 font-mono text-[11px] text-zinc-400">
                  {analysis.componentStack && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Component Stack:</div>
                      <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 overflow-x-auto max-h-32 text-zinc-300">
                        {analysis.componentStack}
                      </div>
                    </div>
                  )}

                  {analysis.stack && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Call Stack:</div>
                      <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 overflow-x-auto max-h-32 text-zinc-400">
                        {analysis.stack}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-zinc-500 pt-1">
                    URL: <span className="text-zinc-400">{window.location.pathname}{window.location.search}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <Button
                onClick={this.handleCopyReport}
                variant="outline"
                className="w-full sm:w-auto flex-1 gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 font-semibold text-xs"
              >
                {this.state.copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" /> ¡Reporte Copiado al Portapapeles!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copiar Reporte para el Desarrollador / IA
                  </>
                )}
              </Button>

              <Button
                onClick={this.handleHardReload}
                className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs"
              >
                <RefreshCw className="h-4 w-4" /> Recargar Página
              </Button>

              <Button
                variant="ghost"
                onClick={this.handleLogout}
                className="w-full sm:w-auto gap-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 text-xs"
              >
                <LogOut className="h-3.5 w-3.5" /> Salir
              </Button>
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
