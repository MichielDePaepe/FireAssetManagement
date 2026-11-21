import React from "react";
import ReactDOM from "react-dom/client";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import { GlobalToaster } from "@/components/GlobalToaster";
import "@/styles.css";

const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const TaskDetailPage = lazy(() => import("@/pages/TaskDetailPage").then((module) => ({ default: module.TaskDetailPage })));
const TasksPage = lazy(() => import("@/pages/TasksPage").then((module) => ({ default: module.TasksPage })));
const PagersPage = lazy(() => import("@/pages/PagersPage").then((module) => ({ default: module.PagersPage })));
const FireplanSettingsPage = lazy(() => import("@/pages/FireplanSettingsPage").then((module) => ({ default: module.FireplanSettingsPage })));
const LabelPrintersPage = lazy(() => import("@/pages/LabelPrintersPage").then((module) => ({ default: module.LabelPrintersPage })));
const CityGISPage = lazy(() => import("@/pages/CityGISPage").then((module) => ({ default: module.CityGISPage })));
const InventoryPage = lazy(() => import("@/pages/InventoryPage").then((module) => ({ default: module.InventoryPage })));
const LocationsPage = lazy(() => import("@/pages/LocationsPage").then((module) => ({ default: module.LocationsPage })));
const FireplanInventoriesPage = lazy(() => import("@/pages/FireplanInventoriesPage").then((module) => ({ default: module.FireplanInventoriesPage })));
const FireplanInventoryDetailPage = lazy(() => import("@/pages/FireplanInventoryDetailPage").then((module) => ({ default: module.FireplanInventoryDetailPage })));

document.title = import.meta.env.VITE_APP_TITLE || "Web Project Starter";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AdminLayout() {
  const { user } = useAuth();
  if (!user?.is_staff) return <Navigate to="/" replace />;
  return <Outlet />;
}

function App() {
  return <AuthProvider><BrowserRouter><Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading page…</div>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}><Route element={<AppLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="pagers" element={<PagersPage />} />
      <Route path="tasks/:taskId" element={<TaskDetailPage />} />
      <Route element={<AdminLayout />}>
        <Route path="fireplan" element={<FireplanSettingsPage />} />
        <Route path="labelprinters" element={<LabelPrintersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="citygis" element={<CityGISPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="fireplan/inventories" element={<FireplanInventoriesPage />} />
        <Route path="fireplan/inventories/:inventoryUuid" element={<FireplanInventoryDetailPage />} />
      </Route>
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense><GlobalToaster /></BrowserRouter></AuthProvider>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
