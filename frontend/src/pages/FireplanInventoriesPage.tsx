import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type FireplanInventorySummary } from "@/lib/api";

const PAGE_SIZE = 25;

const syncStatusLabels: Record<FireplanInventorySummary["sync_status"], string> = {
  not_synced: "Niet gesynchroniseerd",
  pending: "In wachtrij",
  running: "Bezig",
  synced: "Gesynchroniseerd",
  failed: "Mislukt",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("nl-BE").format(date);
}

export function FireplanInventoriesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<FireplanInventorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState("");
  const [starting, setStarting] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await api.getFireplanInventories(page, PAGE_SIZE);
      setRows(result.results);
      setCount(result.count);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "FirePlan-inventarissen laden is niet gelukt.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void loadPage(); }, [loadPage]);

  const submitPeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!startDate || !endDate) {
      setFormError("Vul zowel een begindatum als einddatum in.");
      return;
    }
    if (startDate > endDate) {
      setFormError("Begindatum moet op of voor de einddatum liggen.");
      return;
    }

    setStarting(true);
    try {
      const task = await api.startFireplanInventorySync(startDate, endDate);
      localStorage.setItem("activeTaskId", task.task_id);
      navigate(`/tasks/${encodeURIComponent(task.task_id)}`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "De periodeopdracht starten is niet gelukt.");
    } finally {
      setStarting(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-medium text-primary">Beheer</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">FirePlan-inventarissen</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Overzicht van inventarisafsluitingen in FirePlan met de lokale synchronisatiestatus.
        </p>
      </header>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Details ophalen voor een periode</CardTitle>
          <CardDescription>
            De periode is inclusief de begin- en einddatum. Een handmatige herverwerking haalt alle details van de inventarissen in die periode op.
            FirePlans updatedAt is niet bevestigd als betrouwbare detectie voor automatische vernieuwing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col items-end gap-4 sm:flex-row" onSubmit={submitPeriod} noValidate>
            <div className="w-full space-y-1.5">
              <label htmlFor="period-start" className="text-sm font-medium">Begindatum</label>
              <input id="period-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required className="h-10 w-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="w-full space-y-1.5">
              <label htmlFor="period-end" className="text-sm font-medium">Einddatum</label>
              <input id="period-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required className="h-10 w-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <Button type="submit" disabled={starting} className="w-full shrink-0 rounded-none sm:w-auto">
              {starting ? "Taak starten…" : "Herverwerk periode"}
            </Button>
          </form>
          {formError && <p role="alert" className="mt-3 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Inventarisafsluitingen</CardTitle>
          <CardDescription>{count} inventarissen in FirePlan</CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">
              {loadError} <Button variant="outline" size="sm" className="ml-3 rounded-none" onClick={() => void loadPage()}>Opnieuw laden</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[16%]" />
                    <col className="w-[14%]" /><col className="w-[13%]" /><col className="w-[17%]" />
                    <col className="w-[19%]" />
                  </colgroup>
                  <thead className="border-b bg-muted/70 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-3">Voertuig</th>
                      <th scope="col" className="px-3 py-3">Vector</th>
                      <th scope="col" className="px-3 py-3">Type</th>
                      <th scope="col" className="px-3 py-3">Post</th>
                      <th scope="col" className="px-3 py-3">Afgesloten</th>
                      <th scope="col" className="px-3 py-3">Status</th>
                      <th scope="col" className="px-3 py-3">Laatste fout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr><td colSpan={7} role="status" className="px-3 py-8 text-center text-muted-foreground">Inventarissen laden…</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Geen FirePlan-inventarissen gevonden.</td></tr>
                    ) : rows.map((row) => (
                      <tr key={row.uuid}>
                        <td className="truncate px-3 py-3 font-medium" title={row.vehicle_alpha_code}>
                          {row.last_successful_sync_at ? (
                            <Link className="underline-offset-4 hover:underline" to={`/fireplan/inventories/${encodeURIComponent(row.uuid)}`}>
                              {row.vehicle_alpha_code || row.uuid}
                            </Link>
                          ) : row.vehicle_alpha_code || "—"}
                        </td>
                        <td className="truncate px-3 py-3" title={row.vector_name}>{row.vector_code || "Onbekend"}</td>
                        <td className="truncate px-3 py-3" title={row.inventory_type_name}>{row.inventory_type_name || "—"}</td>
                        <td className="truncate px-3 py-3" title={row.done_in_name}>{row.done_in_name || "—"}</td>
                        <td className="px-3 py-3">{formatDate(row.closed_at)}</td>
                        <td className="px-3 py-3">{syncStatusLabels[row.sync_status]}{row.last_successful_sync_at && <span className="mt-1 block text-xs text-muted-foreground">{formatDate(row.last_successful_sync_at)}</span>}</td>
                        <td className="truncate px-3 py-3 text-red-700" title={row.last_error}>{row.last_error || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm">
                <span className="text-muted-foreground">Pagina {page} van {pageCount}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-none" aria-label="Vorige pagina" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Vorige</Button>
                  <Button variant="outline" size="sm" className="rounded-none" aria-label="Volgende pagina" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)}>Volgende</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
