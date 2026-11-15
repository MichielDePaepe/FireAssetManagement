import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { api, type CityGISVectorStatusHistoryItem } from "@/lib/api";

function formatDate(value: string | null): string {
  if (!value) return "Onbekend";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Onbekend"
    : new Intl.DateTimeFormat("nl-BE", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(date);
}

function formatDuration(seconds: number): string {
  const duration = Math.max(0, Math.floor(seconds));
  if (duration < 60) return `${duration} sec`;
  if (duration < 3600) {
    const minutes = Math.floor(duration / 60);
    const remainder = duration % 60;
    return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
  }
  if (duration < 86400) {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return minutes ? `${hours} u ${minutes} min` : `${hours} u`;
  }
  const days = Math.floor(duration / 86400);
  const hours = Math.floor((duration % 86400) / 3600);
  return hours ? `${days} d ${hours} u` : `${days} d`;
}

export function CityGISStatusHistoryDialog({
  vectorId,
  vectorLabel,
  vehicleLabel,
  onClose,
}: {
  vectorId: number;
  vectorLabel: string;
  vehicleLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeRef = useRef(false);
  const [history, setHistory] = useState<CityGISVectorStatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshHistory = useCallback(async () => {
    try {
      const items = await api.getCityGISVectorStatusHistory(vectorId);
      if (activeRef.current) {
        setHistory(items);
        setError("");
      }
    } catch (reason) {
      if (activeRef.current) {
        setError(reason instanceof Error ? reason.message : "Statusgeschiedenis kon niet worden geladen.");
      }
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [vectorId]);

  useEffect(() => {
    activeRef.current = true;
    void refreshHistory();
    const interval = window.setInterval(() => {
      if (activeRef.current) void refreshHistory();
    }, 15_000);
    return () => {
      activeRef.current = false;
      window.clearInterval(interval);
    };
  }, [refreshHistory]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="citygis-status-history-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border bg-background p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="citygis-status-history-title" className="text-xl font-semibold">
              Statusgeschiedenis · {vectorLabel}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {vehicleLabel ? `Voertuig ${vehicleLabel} · ` : ""}Laatste 50 statussen
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Statusgeschiedenis sluiten"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p role="alert" className="mt-5 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <RefreshCw className="h-4 w-4 animate-spin" />Statusgeschiedenis laden…
          </div>
        ) : !error && history.length === 0 ? (
          <p className="mt-5 border bg-muted/30 p-4 text-sm text-muted-foreground">
            Er is nog geen statusgeschiedenis beschikbaar.
          </p>
        ) : !error ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Vanaf</th>
                  <th className="px-3 py-3 font-medium">Duur</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 border border-black/20"
                          style={{ backgroundColor: item.status_color ?? "#E5E7EB" }}
                        />
                        <span>{item.status_code || "?"} · {item.status_description ?? "Onbekende status"}</span>
                        {item.is_current && <span className="text-xs text-muted-foreground">Actueel</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDate(item.status_since)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDuration(item.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              CityGIS-tijden worden als UTC geïnterpreteerd en lokaal weergegeven. De duur van de actuele status loopt tot het moment van laden.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
