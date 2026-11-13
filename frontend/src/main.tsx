import React from "react";
import ReactDOM from "react-dom/client";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import "@/styles.css";

const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const TaskDetailPage = lazy(() => import("@/pages/TaskDetailPage").then((module) => ({ default: module.TaskDetailPage })));
const TasksPage = lazy(() => import("@/pages/TasksPage").then((module) => ({ default: module.TasksPage })));

document.title = import.meta.env.VITE_APP_TITLE || "Web Project Starter";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function App() {
  return <AuthProvider><BrowserRouter><Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading page…</div>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}><Route element={<AppLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="tasks/:taskId" element={<TaskDetailPage />} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense><Toaster position="top-right" richColors /></BrowserRouter></AuthProvider>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
