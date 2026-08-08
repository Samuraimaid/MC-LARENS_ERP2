import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import PropTypes from 'prop-types';
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DialogMessagesProvider } from "./context/DialogMessagesContext";
import { Toaster } from "./components/ui/sonner";
import { APP_ENV } from "./lib/env";
import { canAccessCashier, getRoleHomePath, isCashierRole } from "./lib/roleHome";

// Layouts
import { MainLayout } from "./components/layout/MainLayout";
import { KDSLayout } from "./components/layout/KDSLayout";

// Pages
import { LoginPage } from "./pages/LoginPage";
import { AuthCallback } from "./pages/AuthCallback";
import { AntiTamperGuard } from "./components/security/AntiTamperGuard";

// Fonts
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import "./App.css";

function lazyNamedPage(loader, exportName) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });
}

const DashboardPage = lazyNamedPage(() => import("./pages/DashboardPage"), "DashboardPage");
const SalesPage = lazyNamedPage(() => import("./pages/SalesPage"), "SalesPage");
const CashierPage = lazyNamedPage(() => import("./pages/CashierPage"), "CashierPage");
const KDSPage = lazyNamedPage(() => import("./pages/KDSPage"), "KDSPage");
const KDSWarehousePage = lazyNamedPage(() => import("./pages/kds/KDSWarehousePage"), "KDSWarehousePage");
const KDSInstallationsPage = lazyNamedPage(
  () => import("./pages/kds/KDSInstallationsPage"),
  "KDSInstallationsPage"
);
const KDSTintPage = lazyNamedPage(() => import("./pages/kds/KDSTintPage"), "KDSTintPage");
const InventoryPage = lazyNamedPage(() => import("./pages/InventoryPage"), "InventoryPage");
const CatalogPage = lazyNamedPage(() => import("./pages/CatalogPage"), "CatalogPage");
const WorkOrdersPage = lazyNamedPage(() => import("./pages/WorkOrdersPage"), "WorkOrdersPage");
const CustomersPage = lazyNamedPage(() => import("./pages/CustomersPage"), "CustomersPage");
const VehiclesPage = lazyNamedPage(() => import("./pages/VehiclesPage"), "VehiclesPage");
const WorkbenchPage = lazyNamedPage(() => import("./pages/WorkbenchPage"), "WorkbenchPage");
const ApprovalsPage = lazyNamedPage(() => import("./pages/ApprovalsPage"), "ApprovalsPage");
const NotificationsPage = lazyNamedPage(() => import("./pages/NotificationsPage"), "NotificationsPage");
const FollowupsPage = lazyNamedPage(() => import("./pages/FollowupsPage"), "FollowupsPage");
const QuotationsPage = lazyNamedPage(() => import("./pages/QuotationsPage"), "QuotationsPage");
const ReportsPage = lazyNamedPage(() => import("./pages/ReportsPage"), "ReportsPage");
const SettingsPage = lazyNamedPage(() => import("./pages/SettingsPage"), "SettingsPage");
const TechnicianMobilePage = lazyNamedPage(() => import("./pages/TechnicianMobilePage"), "TechnicianMobilePage");
const TechnicianCompletedJobsPage = lazyNamedPage(
  () => import("./pages/TechnicianCompletedJobsPage"),
  "TechnicianCompletedJobsPage"
);
const UsersAdminPage = lazyNamedPage(() => import("./pages/UsersAdminPage"), "UsersAdminPage");
const DeliveriesPage = lazyNamedPage(() => import("./pages/DeliveriesPage"), "DeliveriesPage");
const PromotionsPage = lazyNamedPage(() => import("./pages/PromotionsPage"), "PromotionsPage");
const CreditsPage = lazyNamedPage(() => import("./pages/CreditsPage"), "CreditsPage");
const ReturnsPage = lazyNamedPage(() => import("./pages/ReturnsPage"), "ReturnsPage");
const CalendarPage = lazyNamedPage(() => import("./pages/CalendarPage"), "CalendarPage");
const WarrantiesPage = lazyNamedPage(() => import("./pages/WarrantiesPage"), "WarrantiesPage");
const SystemSettingsPage = lazyNamedPage(() => import("./pages/SystemSettingsPage"), "SystemSettingsPage");
const AccountingPage = lazyNamedPage(() => import("./pages/AccountingPage"), "AccountingPage");
const QualityControlPage = lazyNamedPage(() => import("./pages/QualityControlPage"), "QualityControlPage");
const BranchesPage = lazyNamedPage(() => import("./pages/BranchesPage"), "BranchesPage");
const WarehousesPage = lazyNamedPage(() => import("./pages/WarehousesPage"), "WarehousesPage");
const DispatchPage = lazyNamedPage(() => import("./pages/DispatchPage"), "DispatchPage");
const ProductTransfersPage = lazyNamedPage(() => import("./pages/ProductTransfersPage"), "ProductTransfersPage");
const TintOrdersPage = lazyNamedPage(() => import("./pages/TintOrdersPage"), "TintOrdersPage");
const CoordinatorIndexRedirect = lazyNamedPage(() => import("./pages/CoordinatorPage"), "CoordinatorIndexRedirect");
const CoordinatorInstalacionesPage = lazyNamedPage(() => import("./pages/CoordinatorPage"), "CoordinatorInstalacionesPage");
const CoordinatorPolarizadosPage = lazyNamedPage(() => import("./pages/CoordinatorPage"), "CoordinatorPolarizadosPage");
const TutorialsPage = lazyNamedPage(() => import("./pages/TutorialsPage"), "TutorialsPage");
const SamplesPage = lazyNamedPage(() => import("./pages/SamplesPage"), "SamplesPage");
const HumanResourcesPage = lazyNamedPage(() => import("./pages/HumanResourcesPage"), "HumanResourcesPage");
const AttendanceClockPage = lazyNamedPage(() => import("./pages/AttendanceClockPage"), "AttendanceClockPage");
const HyperVisorPage = lazyNamedPage(() => import("./pages/HyperVisorPage"), "HyperVisorPage");
const UniversalSearchPage = lazyNamedPage(() => import("./pages/UniversalSearchPage"), "UniversalSearchPage");
const DocumentSnapshotView = lazyNamedPage(() => import("./components/sales/DocumentSnapshotView"), "DocumentSnapshotView");
const ServerDashboardPage = lazyNamedPage(() => import("./pages/ServerDashboardPage"), "ServerDashboardPage");
const DriverPortalPage = lazyNamedPage(() => import("./pages/DriverPortalPage"), "DriverPortalPage");

function RouteLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node,
};

function DashboardOnlyRoute() {
  const { user } = useAuth();
  const normalizedRole = String(user?.role || "").toLowerCase();
  const canAccessDashboard = normalizedRole === "gerencia" || normalizedRole === "recursos_humanos";

  if (!canAccessDashboard) {
    return <Navigate to={getRoleHomePath(user?.role)} replace />;
  }

  return <DashboardPage />;
}

function WorkbenchOnlyRoute() {
  const { user } = useAuth();
  if (isCashierRole(user?.role)) {
    return <Navigate to="/cashier" replace />;
  }
  return <WorkbenchPage />;
}

function CashierOnlyRoute() {
  const { user } = useAuth();
  if (!canAccessCashier(user?.role)) {
    return <Navigate to={getRoleHomePath(user?.role)} replace />;
  }
  return <CashierPage />;
}

function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={getRoleHomePath(user?.role)} replace />;
}

function AppRouter() {
  const location = useLocation();

  // Check for session_id in URL hash (from Emergent Auth redirect)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/server-dashboard" element={<ServerDashboardPage />} />
      <Route path="/driver" element={<DriverPortalPage />} />

      {/* Protected Routes with Main Layout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardOnlyRoute />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/sales/view/:saleId" element={<DocumentSnapshotView docType="sale" />} />
        <Route path="/sales/:saleId" element={<SalesPage />} />
        <Route path="/quotations/view/:quotationId" element={<DocumentSnapshotView docType="quotation" />} />
        <Route path="/search" element={<UniversalSearchPage />} />
        <Route path="/cashier" element={<CashierOnlyRoute />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/workbench" element={<WorkbenchOnlyRoute />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/followups" element={<FollowupsPage />} />
        <Route path="/work-orders" element={<WorkOrdersPage />} />
        <Route path="/coordinator" element={<CoordinatorIndexRedirect />} />
        <Route path="/coordinator/instalaciones" element={<CoordinatorInstalacionesPage />} />
        <Route path="/coordinator/polarizados" element={<CoordinatorPolarizadosPage />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/returns" element={<ReturnsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/warranties" element={<WarrantiesPage />} />
        <Route path="/quality-control" element={<QualityControlPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/human-resources" element={<HumanResourcesPage />} />
        <Route path="/hypervisor" element={<HyperVisorPage />} />
        <Route path="/dispatch" element={<DispatchPage />} />
        <Route path="/product-transfers" element={<ProductTransfersPage />} />
        <Route path="/tint-orders" element={<TintOrdersPage />} />
        <Route path="/my-completed-jobs" element={<TechnicianCompletedJobsPage />} />
        <Route path="/samples" element={<SamplesPage />} />
        <Route path="/help/tutorials" element={<TutorialsPage />} />
        <Route path="/warehouses" element={<WarehousesPage />} />
        <Route path="/users" element={<UsersAdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/system-settings" element={<SystemSettingsPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
      </Route>

      {/* KDS Layout (fullscreen) */}
      <Route
        element={
          <ProtectedRoute>
            <KDSLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/kds" element={<KDSPage />} />
        <Route path="/kds/bodega" element={<KDSWarehousePage />} />
        <Route path="/kds/instalaciones" element={<KDSInstallationsPage />} />
        <Route path="/kds/polarizados" element={<KDSTintPage />} />
      </Route>

      <Route element={<KDSLayout />}>
        <Route path="/attendance-clock" element={<AttendanceClockPage />} />
      </Route>

      {/* Technician Mobile App (standalone) */}
      <Route
        path="/technician"
        element={
          <ProtectedRoute>
            <TechnicianMobilePage />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  // Register service worker for PWA
  useEffect(() => {
    // Register service worker only in production and on non-localhost hosts.
    if (
      APP_ENV.isProduction &&
      'serviceWorker' in navigator &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered:', registration);
          })
          .catch((error) => {
            console.log('SW registration failed:', error);
          });
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <DialogMessagesProvider>
          <BrowserRouter>
            <AntiTamperGuard>
              <AppRouter />
              <Toaster position="top-center" richColors />
            </AntiTamperGuard>
          </BrowserRouter>
        </DialogMessagesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
