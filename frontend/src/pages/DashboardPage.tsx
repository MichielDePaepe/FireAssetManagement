import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw, Signal, SignalZero } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityGISStatusHistoryDialog } from "@/components/CityGISStatusHistoryDialog";
import { api, subscribeToCityGIS, type CityGISLocation, type CityGISSnapshot, type CityGISVector } from "@/lib/api";
import { buildPostDashboardRows, type DashboardGroupKey } from "@/lib/dashboardGrouping";

const GROUPS: Array<{ key: DashboardGroupKey; title: string; columns: number; note: string }> = [
  { key: "apm", title: "APM", columns: 2, note: "Autopompen" },
  { key: "ae", title: "AE", columns: 2, note: "Ladderwagens" },
  { key: "amb", title: "AMB", columns: 2, note: "Ziekenwagens" },
  { key: "rest", title: "Rest", columns: 3, note: "CMD, MSERV, FAUB, 99 en overige types" },
  { key: "special", title: "Status 90+", columns: 2, note: "Buiten dienst · 99 staat in Rest" },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "Nog niet vernieuwd";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Nog niet vernieuwd" : new Intl.DateTimeFormat("nl-BE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function VectorStatus({ vector, knownStatusCodes, onOpen }: { vector: CityGISVector; knownStatusCodes: Set<string>; onOpen: () => void }) {
  const hasKnownStatus = Boolean(vector.operational_status_code) && knownStatusCodes.has(vector.operational_status_code);
  const statusCode = hasKnownStatus ? vector.operational_status_code : "?";
  const vehicleCode = vector.vehicle?.alphacode || vector.source_vehicle_name || "Onbekend voertuig";
  const vectorCode = vector.abbreviation || vector.name || vector.vector_code;
  const color = hasKnownStatus ? vector.status_color : null;
  const statusDescription = hasKnownStatus ? vector.status_description || "Onbekende status" : "Onbekende status";
  return <div className="flex min-w-0 items-center gap-1 py-1.5">
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Bekijk statusgeschiedenis voor ${vehicleCode} · ${vectorCode} · status ${statusCode} · ${statusDescription}`}
      title={`Status ${statusCode} · ${statusDescription} · Bekijk geschiedenis`}
      className="flex h-8 w-2 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    ><span aria-hidden="true" className="block h-7 w-[6px] rounded-none" style={{ backgroundColor: color ?? "#E5E7EB" }} /></button>
    <span className="min-w-0 whitespace-normal break-words leading-tight">
      <span className="block whitespace-normal break-words text-xs font-semibold text-foreground">{vehicleCode}</span>
      <span className="block whitespace-normal break-words text-[10px] text-muted-foreground">{vectorCode}</span>
    </span>
  </div>;
}

function AssetCell({
  vectors,
  columns,
  knownStatusCodes,
  onStatus,
}: {
  vectors: CityGISVector[];
  columns: number;
  knownStatusCodes: Set<string>;
  onStatus: (vector: CityGISVector) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleLimit = columns * 3;
  const shownVectors = expanded ? vectors : vectors.slice(0, visibleLimit);
  const hiddenCount = vectors.length - shownVectors.length;
  if (vectors.length === 0) return null;
  return <div>
    <>
      <div className="grid gap-x-2 gap-y-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {shownVectors.map((vector) => <VectorStatus key={vector.id} vector={vector} knownStatusCodes={knownStatusCodes} onOpen={() => onStatus(vector)} />)}
      </div>
      {vectors.length > visibleLimit && <button
        type="button"
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >{expanded ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}{expanded ? "Minder tonen" : `Toon ${hiddenCount} extra`}</button>}
    </>
  </div>;
}

export function DashboardPage() {
  const [locations, setLocations] = useState<CityGISLocation[]>([]);
  const [snapshot, setSnapshot] = useState<CityGISSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(true);
  const [historyVector, setHistoryVector] = useState<CityGISVector | null>(null);
  const liveUpdateReceived = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextLocations, nextSnapshot] = await Promise.all([api.listLocations(), api.getCityGIS()]);
      setLocations(nextLocations);
      if (!liveUpdateReceived.current) setSnapshot(nextSnapshot);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Postenoverzicht kon niet worden geladen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToCityGIS((nextSnapshot) => {
      liveUpdateReceived.current = true;
      if (active) {
        setSnapshot(nextSnapshot);
        setError("");
        setConnected(true);
      }
    }, () => {
      if (active) setConnected(false);
    });
    void refresh();
    return () => { active = false; unsubscribe(); };
  }, [refresh]);

  const rows = useMemo(() => snapshot ? buildPostDashboardRows(locations, snapshot.vectors) : [], [locations, snapshot]);
  const knownStatusCodes = useMemo(() => new Set(snapshot?.statuses.map((status) => status.code) ?? []), [snapshot]);
  const hasCurrentVectors = rows.some((row) => Object.values(row.groups).some((group) => group.length > 0));
  const hasPosts = locations.some((location) => location.kind === "post");
  const totals = useMemo(() => Object.fromEntries(GROUPS.map(({ key }) => [key, rows.reduce((sum, row) => ({
    available: sum.available + row.totals[key].available,
    total: sum.total + row.totals[key].total,
  }), { available: 0, total: 0 })])) as Record<DashboardGroupKey, { available: number; total: number }>, [rows]);

  return <main className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">CityGIS · Operationeel overzicht</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Postenoverzicht</h1>
        <p className="mt-1 text-sm text-muted-foreground">Actuele beschikbaarheid van voertuigen per post.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className={`inline-flex items-center gap-2 border px-2.5 py-1.5 text-xs ${connected ? "text-foreground" : "border-amber-400 bg-amber-50 text-amber-900"}`}>
          {connected ? <Signal aria-hidden="true" className="h-3.5 w-3.5 text-emerald-700" /> : <SignalZero aria-hidden="true" className="h-3.5 w-3.5" />}
          {connected ? "Live verbonden" : "Liveverbinding tijdelijk onderbroken · laatste gegevens blijven zichtbaar"}
        </span>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} aria-label="Postenoverzicht vernieuwen" title="Vernieuwen">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Vernieuwen
        </Button>
      </div>
    </header>

    {snapshot?.sync_state.last_error && <p role="status" className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">Laatste CityGIS-synchronisatie mislukt. De laatst opgeslagen gegevens blijven zichtbaar. {snapshot.sync_state.last_error}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-900"><span className="inline-flex items-center gap-2"><AlertCircle aria-hidden="true" className="h-4 w-4" />{error}</span><Button variant="outline" size="sm" onClick={() => void refresh()}>Opnieuw proberen</Button></div>}

    {loading && !snapshot ? <div role="status" className="flex items-center gap-2 border bg-white px-4 py-8 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Posten en voertuigen laden…</div>
      : snapshot && !hasPosts && !error ? <div className="border bg-white px-4 py-10 text-center"><p className="font-medium">Geen posten gevonden</p><p className="mt-1 text-sm text-muted-foreground">Voeg posten toe via Locatiebeheer.</p></div>
        : snapshot && <>
          <div className="overflow-x-auto border bg-white shadow-sm">
            <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th scope="col" className="border-b px-3 py-3 align-bottom font-medium text-foreground">Post</th>
                  {GROUPS.map(({ key, title, note }) => <th scope="col" key={key} className="border-b px-3 py-3 align-bottom font-medium">
                    <span className="flex items-baseline justify-between gap-1 text-foreground"><span>{title}</span><span className="font-mono text-xs font-normal text-muted-foreground">{totals[key].available}/{totals[key].total}</span></span>
                    <span className="mt-1 block text-[10px] font-normal text-muted-foreground">{note}</span>
                  </th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => <tr key={row.location.id} className="align-top hover:bg-muted/20">
                  <th scope="row" className="px-3 py-3 text-left font-semibold">
                    <span className="block whitespace-normal break-words">{row.location.name}</span>
                  </th>
                  {GROUPS.map(({ key, columns }) => <td key={key} className="px-2 py-2 align-top">
                    <AssetCell vectors={row.groups[key]} columns={columns} knownStatusCodes={knownStatusCodes} onStatus={setHistoryVector} />
                  </td>)}
                </tr>)}
                {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Er zijn nog geen posten om weer te geven.</td></tr>}
              </tbody>
            </table>
          </div>
          {!hasCurrentVectors && <p role="status" className="border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Er zijn nog geen actuele vectoren voor deze posten.</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>Beschikbaar = status 0 of 6 · Status 99 staat in Rest · klik op een status voor de historiek.</p>
            <p>Laatst vernieuwd: {formatDate(snapshot.last_refreshed_at)}</p>
          </div>
        </>}

    {historyVector && <CityGISStatusHistoryDialog
      vectorId={historyVector.id}
      vectorLabel={historyVector.abbreviation || historyVector.vector_code}
      vehicleLabel={historyVector.vehicle?.alphacode || historyVector.source_vehicle_name}
      onClose={() => setHistoryVector(null)}
    />}
  </main>;
}
