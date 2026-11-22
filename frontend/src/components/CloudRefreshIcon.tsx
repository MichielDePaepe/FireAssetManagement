import { Cloud, RefreshCw } from "lucide-react";

export function CloudRefreshIcon({ syncing = false }: { syncing?: boolean }) {
  return (
    <span className="relative inline-flex h-4 w-4" aria-hidden="true">
      <Cloud className="h-4 w-4" />
      <RefreshCw className={`absolute -bottom-0.5 -right-1 h-2.5 w-2.5 bg-background ${syncing ? "animate-spin" : ""}`} />
    </span>
  );
}
