import React from "react";
import { Outlet, Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "../ui/button";
import { ArrowLeft, Sun, Moon, RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { KDSNav, getKdsScreenMeta } from "../kds/KDSNav";
import { dispatchKdsRefresh } from "@/lib/kdsHelpers";

export function KDSLayout() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [refreshing, setRefreshing] = React.useState(false);
  const isAttendanceKiosk = location.pathname === "/attendance-clock";

  const screenMeta = getKdsScreenMeta(location.pathname);

  const handleRefresh = () => {
    setRefreshing(true);
    dispatchKdsRefresh();
    window.setTimeout(() => setRefreshing(false), 600);
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
            <div>
              <h1 className="font-heading text-2xl font-bold">
                {isAttendanceKiosk ? "RELOJ MARCADOR" : screenMeta.title}
              </h1>
              {!isAttendanceKiosk && screenMeta.subtitle ? (
                <p className="text-xs text-muted-foreground">{screenMeta.subtitle}</p>
              ) : null}
            </div>
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

      {!isAttendanceKiosk && (
        <div className="px-4 pt-3">
          <KDSNav />
        </div>
      )}

      {/* Content */}
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
