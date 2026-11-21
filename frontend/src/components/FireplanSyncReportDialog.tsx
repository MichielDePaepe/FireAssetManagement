import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { FireplanRadioSyncResult, FireplanSyncResult } from "@/lib/api";

export function FireplanSyncReportDialog({
  report,
  open,
  onClose,
}: {
  report: FireplanSyncResult | FireplanRadioSyncResult;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fireplan-report-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border bg-background p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="fireplan-report-title" className="text-xl font-semibold">
              Fireplan-synchronisatierapport
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {"skipped" in report ? "Resultaat van de radiosynchronisatie." : "Resultaat van de pagerinventarisatie."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Rapport sluiten"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="border p-4"><dt className="text-sm text-muted-foreground">Toegevoegd</dt><dd className="mt-1 text-2xl font-semibold">{report.added}</dd></div>
          <div className="border p-4"><dt className="text-sm text-muted-foreground">Bijgewerkt</dt><dd className="mt-1 text-2xl font-semibold">{report.updated}</dd></div>
          <div className="border p-4"><dt className="text-sm text-muted-foreground">Ongewijzigd</dt><dd className="mt-1 text-2xl font-semibold">{report.unchanged}</dd></div>
          <div className="border p-4"><dt className="text-sm text-muted-foreground">Mislukt</dt><dd className="mt-1 text-2xl font-semibold">{report.errors.length}</dd></div>
          {"skipped" in report && <div className="border p-4"><dt className="text-sm text-muted-foreground">Overgeslagen</dt><dd className="mt-1 text-2xl font-semibold">{report.skipped}</dd></div>}
        </dl>

        <section className="mt-6" aria-labelledby="fireplan-report-errors">
          <h3 id="fireplan-report-errors" className="font-semibold">Problemen per toestel</h3>
          {report.errors.length === 0 ? (
            <p className="mt-3 border bg-muted/30 p-4 text-sm">Geen fouten tijdens de synchronisatie.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {report.errors.map((error, index) => (
                <li key={`${error.fireplan_id ?? "unknown"}-${index}`} className="border p-4 text-sm">
                  <p className="font-medium">{error.name ?? "Onbekend toesteltype"}</p>
                  <p className="mt-1 text-muted-foreground">{"serial_number" in error ? (error.serial_number ? `Serienummer: ${error.serial_number}` : "Geen serienummer") : "TEI niet beschikbaar"}{error.fireplan_id ? ` · Fireplan-ID: ${error.fireplan_id}` : ""}</p>
                  <p className="mt-2 text-red-800">{error.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
