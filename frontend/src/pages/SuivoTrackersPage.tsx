import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowDownUp, ArrowUp, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type SuivoAsset, type SuivoDevice, type SuivoList } from "@/lib/api";

type Tab = "assets" | "devices";
type SortColumn = "name" | "vehicle" | "device" | "type" | "last_seen" | "position_at" | "position" | "battery_level" | "battery_voltage";
type SortDirection = "ascending" | "descending";

function formatDate(value: string | null): string {
  if (!value) return "Niet beschikbaar";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Niet beschikbaar" : new Intl.DateTimeFormat("nl-BE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function positionLabel(value: Record<string, unknown> | null): string {
  if (!value) return "Niet beschikbaar";
  const location = value.location;
  if (typeof location === "string" && location.trim()) return location;
  for (const source of [location, value.address]) {
    if (source && typeof source === "object") {
      const details = source as Record<string, unknown>;
      const label = [details.name, details.street, details.city, details.zip, details.country].filter((part) => typeof part === "string" && part.trim()).join(", ");
      if (label) return label;
    }
  }
  const coordinate = value.coordinate;
  if (coordinate && typeof coordinate === "object") {
    const point = coordinate as Record<string, unknown>;
    const latitude = point.latitude ?? point.lat ?? point.y;
    const longitude = point.longitude ?? point.lon ?? point.lng ?? point.x;
    if (typeof latitude === "number" && typeof longitude === "number") return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
  return "Niet beschikbaar";
}

function batteryLabel(value: number | string | null): string {
  return value === null || value === "" ? "Niet beschikbaar" : String(value);
}

function compare(left: string | number, right: string | number): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "nl-BE", { numeric: true, sensitivity: "base" });
}

function AssetValue({ row, column }: { row: SuivoAsset; column: SortColumn }): string | number {
  switch (column) {
    case "name": return row.name;
    case "vehicle": return row.vehicle?.name ?? row.match_status;
    case "device": return row.devices.map((device) => device.imei || device.external_id).join(" ");
    case "type": return row.devices.map((device) => device.type).join(" ");
    case "last_seen": return row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    case "position_at": return row.position_at ? new Date(row.position_at).getTime() : 0;
    case "position": return positionLabel(row.position);
    case "battery_level": return row.battery_level ?? "";
    case "battery_voltage": return row.battery_voltage ?? "";
  }
}

function DeviceValue({ row, column }: { row: SuivoDevice; column: SortColumn }): string | number {
  switch (column) {
    case "name": return row.imei || row.external_id;
    case "vehicle": return row.unit?.name ?? "";
    case "device": return row.external_id;
    case "type": return row.device_type;
    case "last_seen": return row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    case "position_at": return row.position_at ? new Date(row.position_at).getTime() : 0;
    case "position": return positionLabel(row.position);
    case "battery_level": return row.battery_level ?? "";
    case "battery_voltage": return row.battery_voltage ?? "";
  }
}

function SnapshotState({ snapshot }: { snapshot: SuivoList<unknown> | null }) {
  if (!snapshot) return null;
  const connectionMessage = snapshot.push_connected ? "Realtimeverbinding actief" : "Realtimeverbinding onderbroken";
  const staleReason = snapshot.push_connected ? snapshot.last_error : snapshot.push_last_error || "De laatste pushstatus is niet actueel.";
  return <div className="space-y-2">{snapshot.stale && <p role="status" className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">De Suivo-snapshot kan verouderd zijn. De laatst opgeslagen gegevens en bron-tijdstempels blijven zichtbaar. {staleReason}</p>}
    <p className="text-xs text-muted-foreground">Laatste volledige sync: {formatDate(snapshot.last_succeeded_at)} · {connectionMessage} · Laatste push: {formatDate(snapshot.push_last_message_at)}</p></div>;
}

function SortHeader({ label, column, sort, onSort }: { label: string; column: SortColumn; sort: { column: SortColumn; direction: SortDirection }; onSort: (column: SortColumn) => void }) {
  const active = sort.column === column;
  const Icon = active ? (sort.direction === "ascending" ? ArrowUp : ArrowDown) : ArrowDownUp;
  return <th scope="col" aria-sort={active ? sort.direction : undefined} className="border-b border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground">
    <button type="button" onClick={() => onSort(column)} aria-label={`Sorteer op ${label}`} className="inline-flex items-center gap-1.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {label}<Icon aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  </th>;
}

export function SuivoTrackersPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("assets");
  const [assets, setAssets] = useState<SuivoList<SuivoAsset> | null>(null);
  const [devices, setDevices] = useState<SuivoList<SuivoDevice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: "name", direction: "ascending" });

  useEffect(() => {
    let active = true;
    Promise.all([api.getSuivoAssets(), api.getSuivoDevices()]).then(([assetData, deviceData]) => {
      if (active) { setAssets(assetData); setDevices(deviceData); setError(""); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Suivo-gegevens konden niet worden geladen.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const toggleSort = (column: SortColumn) => setSort((current) => ({
    column,
    direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
  }));
  const needle = query.trim().toLocaleLowerCase("nl-BE");
  const shownAssets = useMemo(() => {
    const rows = assets?.results.filter((row) => !needle || JSON.stringify(row).toLocaleLowerCase("nl-BE").includes(needle)) ?? [];
    const direction = sort.direction === "ascending" ? 1 : -1;
    return [...rows].sort((a, b) => compare(AssetValue({ row: a, column: sort.column }), AssetValue({ row: b, column: sort.column })) * direction || a.external_id.localeCompare(b.external_id));
  }, [assets, needle, sort]);
  const shownDevices = useMemo(() => {
    const rows = devices?.results.filter((row) => !needle || JSON.stringify(row).toLocaleLowerCase("nl-BE").includes(needle)) ?? [];
    const direction = sort.direction === "ascending" ? 1 : -1;
    return [...rows].sort((a, b) => compare(DeviceValue({ row: a, column: sort.column }), DeviceValue({ row: b, column: sort.column })) * direction || a.external_id.localeCompare(b.external_id));
  }, [devices, needle, sort]);

  const snapshot = tab === "assets" ? assets : devices;
  const columns: Array<[SortColumn, string, string]> = tab === "assets"
    ? [["name", "Asset", "16%"], ["vehicle", "FAM-voertuig", "14%"], ["device", "Tracker", "14%"], ["type", "Type", "10%"], ["last_seen", "Laatst gehoord", "12%"], ["position_at", "Positietijd", "12%"], ["position", "Laatste locatie", "12%"], ["battery_level", "Batterijniveau (%)", "6%"], ["battery_voltage", "Spanning (V)", "4%"]]
    : [["name", "Device-identificatie", "20%"], ["type", "Type", "14%"], ["vehicle", "Asset", "16%"], ["last_seen", "Laatst gehoord", "13%"], ["position_at", "Positietijd", "13%"], ["position", "Laatste locatie", "14%"], ["battery_level", "Batterijniveau", "5%"], ["battery_voltage", "Spanning (V)", "5%"]];

  const startRefresh = async () => {
    setRefreshing(true);
    setSyncError("");
    try {
      const task = await api.startSuivoSync();
      navigate(`/tasks/${encodeURIComponent(task.task_id)}`);
    } catch (reason) {
      setSyncError(reason instanceof Error ? reason.message : "De Suivo-verversing kon niet worden gestart.");
    } finally {
      setRefreshing(false);
    }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Trackers</h1><p className="mt-1 text-sm text-muted-foreground">Suivo-assets en gekoppelde devices</p></div>
      <Button variant="outline" onClick={() => void startRefresh()} disabled={refreshing} aria-label="Alles vernieuwen" title="Start een volledige Suivo-sync"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Alles vernieuwen</Button>
    </div>
    <div role="tablist" aria-label="Suivo-overzichten" className="flex border-b">
      {([["assets", "Assets"], ["devices", "Trackers"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} aria-controls="suivo-panel" onClick={() => { setTab(key); setQuery(""); }} className={`border-b-2 px-4 py-2 text-sm ${tab === key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
    </div>
    <section id="suivo-panel" role="tabpanel" aria-label={tab === "assets" ? "Assets" : "Trackers"} className="space-y-4 border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-medium">{tab === "assets" ? "Assets" : "Trackers"} <span className="text-sm font-normal text-muted-foreground">({tab === "assets" ? assets?.results.length ?? 0 : devices?.results.length ?? 0})</span></h2><SnapshotState snapshot={snapshot} /></div>
        <div className="relative w-full sm:w-72"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Zoeken" type="search" placeholder="Zoeken…" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div>
      </div>
      {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">Suivo kon niet worden geladen: {error}</p>}
      {syncError && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{syncError}</p>}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>{columns.map(([column, , width]) => <col key={column} style={{ width }} />)}</colgroup>
          <thead className="bg-muted/60"><tr>{columns.map(([column, label]) => <SortHeader key={column} label={label} column={column} sort={sort} onSort={toggleSort} />)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">Suivo-gegevens laden…</td></tr>}
            {!loading && tab === "assets" && shownAssets.map((row) => <tr key={row.external_id} className="border-b align-top hover:bg-muted/20">
              <td className="break-words px-3 py-3">{row.name}</td>
              <td className="break-words px-3 py-3">{row.match_status === "matched" ? row.vehicle?.name : row.match_status === "multiple" ? `Meerdere exacte matches (${row.matches.length})` : "Geen match"}</td>
              <td className="break-words px-3 py-3">{row.devices.length ? row.devices.map((device) => device.imei || device.external_id).join(", ") : "Geen tracker gekoppeld"}</td>
              <td className="break-words px-3 py-3">{row.devices.map((device) => device.type).filter(Boolean).join(", ") || "Niet beschikbaar"}</td>
              <td className="px-3 py-3">{formatDate(row.last_seen_at)}</td><td className="px-3 py-3">{formatDate(row.position_at)}</td><td className="break-words px-3 py-3">{positionLabel(row.position)}</td><td className="px-3 py-3">{batteryLabel(row.battery_level)}</td><td className="px-3 py-3">{batteryLabel(row.battery_voltage)}</td>
            </tr>)}
            {!loading && tab === "devices" && shownDevices.map((row) => <tr key={row.external_id} className="border-b align-top hover:bg-muted/20">
              <td className="break-words px-3 py-3">{row.imei || row.external_id}</td><td className="break-words px-3 py-3">{row.device_type || "Niet beschikbaar"}</td><td className="break-words px-3 py-3">{row.unit?.name || "Geen unit gekoppeld"}</td>
              <td className="px-3 py-3">{formatDate(row.last_seen_at)}</td><td className="px-3 py-3">{formatDate(row.position_at)}</td><td className="break-words px-3 py-3">{positionLabel(row.position)}</td>
              <td className="px-3 py-3">{batteryLabel(row.battery_level)}</td><td className="px-3 py-3">{batteryLabel(row.battery_voltage)}</td>
            </tr>)}
            {!loading && ((tab === "assets" && shownAssets.length === 0) || (tab === "devices" && shownDevices.length === 0)) && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">{needle ? "Geen resultaten voor deze zoekopdracht." : "Geen gegevens beschikbaar."}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
