import { Activity, Boxes, Building2, ClipboardList, Gauge, LogOut, Menu, Printer, Radio, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { CommandPalette } from "@/components/CommandPalette";
import { FireplanTaskMonitor } from "@/components/FireplanTaskMonitor";
import { Button } from "@/components/ui/button";

const title = import.meta.env.VITE_APP_TITLE || "Web Project Starter";

function CityGISIcon({ className }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2.65 16.64A10.4 8.2 -38 1 0 17.01 3.19" />
    <path d="M4.12 12.14A7.2 5.7 -38 1 0 12.32 4.23" />
  </svg>;
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const logout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
    }
  };

  const links = [
    { to: "/", label: "Dashboard", icon: Gauge, end: true },
    { to: "/tasks", label: "Background tasks", icon: Activity, end: false },
    { to: "/pagers", label: "Pagers", icon: Radio, end: false },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireplanTaskMonitor />
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-white transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b px-5">
          <a className="flex items-center" href="/" aria-label="Home">
            <img className="h-auto w-40 shrink-0" src="/logo-asset-management.svg" alt="Brandweer Brussel Asset Management" />
          </a>
          <button className="lg:hidden" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 py-5">
          <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p>
          <nav className="space-y-1">
            {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>)}
          </nav>
        </div>
        {user?.is_staff && <div className="border-t px-4 py-5">
          <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Beheer</p>
          <nav className="space-y-1">
            <NavLink to="/fireplan/inventories" onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
              <ClipboardList className="h-4 w-4" />FirePlan-inventarissen
            </NavLink>
            <NavLink to="/fireplan" onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
              <Radio className="h-4 w-4" />Fireplan
            </NavLink>
            <NavLink to="/labelprinters" onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
              <Printer className="h-4 w-4" />Labelprinters
            </NavLink>
            <NavLink to="/inventory" onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
              <Boxes className="h-4 w-4" />Inventaris
            </NavLink>
            <NavLink to="/citygis" onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
              <CityGISIcon className="h-4 w-4 shrink-0" />CityGIS
            </NavLink>
            <NavLink to="/locations" onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
              <Building2 className="h-4 w-4" />Locaties
            </NavLink>
          </nav>
        </div>}
        <div className="mt-auto border-t p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="grid h-8 w-8 place-items-center border bg-muted text-xs font-semibold">{user?.username.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0"><p className="truncate text-sm font-medium">{user?.username}</p><p className="text-xs text-muted-foreground">Signed in</p></div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={logout}><LogOut className="h-4 w-4" />Sign out</Button>
        </div>
      </aside>
      {menuOpen && <button className="fixed inset-0 z-30 bg-black/30 lg:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-8">
          <button aria-label="Open menu" className="lg:hidden" onClick={() => setMenuOpen(true)}><Menu className="h-5 w-5" /></button>
          <span className="text-sm text-muted-foreground lg:hidden">{title}</span>
          <div className="ml-auto"><CommandPalette /></div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
