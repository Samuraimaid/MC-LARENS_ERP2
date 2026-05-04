import React from "react";
import { Outlet, Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "../ui/button";
import { ArrowLeft, Sun, Moon, RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";

export function KDSLayout() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [refreshing, setRefreshing] = React.useState(false);
  const isAttendanceKiosk = location.pathname === "/attendance-clock";

  const handleRefresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            {!isAttendanceKiosk && (
              <Link to="/workbench">
                <Button variant="ghost" size="sm" data-testid="kds-back-btn">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
              </Link>
            )}
            <h1 className="font-heading text-2xl font-bold">
              {isAttendanceKiosk ? "RELOJ MARCADOR" : "PANTALLA DE ÓRDENES"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              data-testid="kds-refresh-btn"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            {!isAttendanceKiosk && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="kds-theme-toggle"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
