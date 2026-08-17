import React from "react";
import PropTypes from "prop-types";
import { AlertTriangle, RefreshCw, Home, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled render error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/workbench";
  };

  handleLogout = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = "/login";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100 select-none">
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold">Ocurrió un problema visual</h2>
              <p className="text-xs text-muted-foreground">
                El sistema detectó una excepción al procesar la vista. Puedes reintentar o recargar la sesión.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3 text-left font-mono text-[11px] text-zinc-600 dark:text-zinc-400 overflow-auto max-h-28">
                {String(this.state.error.message)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={this.handleReload}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-white font-bold"
              >
                <RefreshCw className="h-4 w-4" /> Recargar Página
              </Button>
              <Button
                variant="outline"
                onClick={this.handleLogout}
                className="gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-4 w-4" /> Salir al Login
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
