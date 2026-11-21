import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, ArrowDownUp, ArrowUp, Filter, RefreshCw, Search, Truck } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CityGISStatusHistoryDialog } from "@/components/CityGISStatusHistoryDialog";
import { Input } from "@/components/ui/input";
import { api, subscribeToCityGIS, type CityGISSnapshot, type CityGISVector } from "@/lib/api";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("nl-BE", { dateStyle: "short", timeStyle: "medium" }).format(date);
}

type SortColumn = "vector" | "service" | "type" | "vehicle" | "status" | "status_updated_at";
type SortDirection = "ascending" | "descending";
const EMPTY_SERVICE_FILTER = "__empty_service__";
const EMPTY_TYPE_FILTER = "__empty_type__";
const UNKNOWN_STATUS_FILTER = "__unknown_status__";
const EMPTY_STATUS_FILTER = "__empty_status__";
type FilterColumn = "service" | "type" | "status";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterPopoverProps {
  anchor: HTMLElement;
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  onClose: () => void;
}

function FilterPopover({ anchor, label, options, selected, onChange, onClose }: FilterPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const panelWidth = 280;
      const panelHeight = Math.min(panelRef.current?.offsetHeight ?? 320, window.innerHeight - 16);
      const maxLeft = Math.max(8, window.innerWidth - panelWidth - 8);
      const left = Math.min(Math.max(8, anchorRect.left), maxLeft);
      const below = anchorRect.bottom + 4;
      const top = below + panelHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, anchorRect.top - panelHeight - 4);
      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, options.length]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role="group"
      aria-label={`Filter op ${label.toLocaleLowerCase("nl-BE")}`}
      className="fixed z-50 max-h-80 w-[17.5rem] max-w-[calc(100vw-1rem)] overflow-y-auto border bg-white p-3 text-sm text-foreground shadow-lg"
      style={{ ...position, maxHeight: "min(20rem, calc(100vh - 1rem))" }}
    >
      <div className="mb-2 flex items-center justify-between border-b pb-2">
        <span className="font-semibold">Filter op {label.toLocaleLowerCase("nl-BE")}</span>
        <button
          type="button"
          className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          disabled={selected.length === 0}
          onClick={() => { onChange([]); onClose(); }}
        >Wissen</button>
      </div>
      <div className="space-y-1">
        {options.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={selected.includes(option.value)}
            onChange={(event) => {
              const values = event.target.checked
                ? [...selected, option.value]
                : selected.filter((value) => value !== option.value);
              onChange(values);
              onClose();
            }}
          />
          <span>{option.label}</span>
        </label>)}
        {options.length === 0 && <p className="px-2 py-1.5 text-muted-foreground">Geen filteropties beschikbaar.</p>}
      </div>
    </div>,
    document.body,
  );
}

function formatElapsed(value: string | null, now: number): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const elapsedSeconds = (now - date.getTime()) / 1000;
  const distance = Math.abs(elapsedSeconds);
  if (distance < 1) return elapsedSeconds >= 0 ? "minder dan 1 seconde geleden" : "binnen 1 seconde";

  const units: Array<[number, number, Intl.RelativeTimeFormatUnit]> = [
    [60, 1, "second"],
    [60 * 60, 60, "minute"],
    [24 * 60 * 60, 60 * 60, "hour"],
    [30 * 24 * 60 * 60, 24 * 60 * 60, "day"],
    [365 * 24 * 60 * 60, 30 * 24 * 60 * 60, "month"],
    [Number.POSITIVE_INFINITY, 365 * 24 * 60 * 60, "year"],
  ];
  const [, divisor, unit] = units.find(([threshold]) => distance < threshold) ?? units[units.length - 1];
  const amount = Math.floor(distance / divisor) * (elapsedSeconds < 0 ? 1 : -1);
  return new Intl.RelativeTimeFormat("nl-BE", { numeric: "auto" }).format(amount, unit);
}

function sortValue(vector: CityGISVector, column: SortColumn): string | number {
  switch (column) {
    case "vector":
      return vector.abbreviation || vector.name || vector.vector_code;
    case "service":
      return vector.service_abbreviation;
    case "type":
      return vector.resource_type_code;
    case "vehicle":
      return vector.vehicle?.alphacode || vector.source_vehicle_name;
    case "status":
      return `${vector.status_description ?? ""} ${vector.operational_status_code}`;
    case "status_updated_at":
      return vector.status_updated_at ? new Date(vector.status_updated_at).getTime() : 0;
  }
}

function StatusLabel({ vector, onClick }: { vector: CityGISVector; onClick: () => void }) {
  const color = vector.status_color ?? "#E5E7EB";
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 border px-2 py-1 text-xs font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Bekijk statusgeschiedenis voor ${vector.abbreviation || vector.vector_code}`} title="Bekijk statusgeschiedenis">
    <span aria-hidden="true" className="h-3 w-3 border border-black/20" style={{ backgroundColor: color }} />
    {vector.operational_status_code || "?"} · {vector.status_description || "Onbekende status"}
  </button>;
}

export function CityGISPage() {
  const [snapshot, setSnapshot] = useState<CityGISSnapshot | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [serviceFilters, setServiceFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [statusHistoryVector, setStatusHistoryVector] = useState<CityGISVector | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>("vector");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [openFilter, setOpenFilter] = useState<{
    column: FilterColumn;
    anchor: HTMLElement;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const closeStatusHistory = useCallback(() => setStatusHistoryVector(null), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    api.getCityGIS().then((data) => { if (active) setSnapshot(data); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "CityGIS-gegevens konden niet worden geladen.");
    });
    const unsubscribe = subscribeToCityGIS((data) => {
      if (active) {
        setSnapshot(data);
        setError("");
        setConnected(true);
      }
    }, () => {
      if (active) setConnected(false);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const filteredVectors = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    if (!snapshot) return [];
    const knownStatuses = new Set(snapshot.statuses.map((status) => status.code));
    return snapshot.vectors.filter((row) => {
      const matchesQuery = !needle || [row.vector_code, row.abbreviation, row.name, row.service_abbreviation,
        row.vehicle?.alphacode, row.vehicle?.plate, row.operational_status_code, row.status_description]
        .some((value) => value?.toLocaleLowerCase("nl-BE").includes(needle));
      const matchesService = serviceFilters.length === 0 || serviceFilters.some((filter) =>
        filter === EMPTY_SERVICE_FILTER ? !row.service_abbreviation : row.service_abbreviation === filter);
      const matchesType = typeFilters.length === 0 || typeFilters.some((filter) =>
        filter === EMPTY_TYPE_FILTER ? !row.resource_type_code : row.resource_type_code === filter);
      const matchesStatus = statusFilters.length === 0 || statusFilters.some((filter) =>
        filter === UNKNOWN_STATUS_FILTER
          ? Boolean(row.operational_status_code) && !knownStatuses.has(row.operational_status_code)
          : filter === EMPTY_STATUS_FILTER
            ? !row.operational_status_code
            : row.operational_status_code === filter);
      return matchesQuery && matchesService && matchesType && matchesStatus;
    });
  }, [query, serviceFilters, snapshot, statusFilters, typeFilters]);

  const serviceOptions = useMemo(() => {
    if (!snapshot) return [];
    const values = [...new Set(snapshot.vectors.map((vector) => vector.service_abbreviation).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "nl-BE", { sensitivity: "base" }))
      .map((service) => ({ value: service, label: service }));
    if (snapshot.vectors.some((vector) => !vector.service_abbreviation)) {
      values.push({ value: EMPTY_SERVICE_FILTER, label: "Geen dienst" });
    }
    return values;
  }, [snapshot]);

  const typeOptions = useMemo(() => {
    if (!snapshot) return [];
    const values = [...new Set(snapshot.vectors.map((vector) => vector.resource_type_code).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "nl-BE", { sensitivity: "base" }))
      .map((type) => ({ value: type, label: type }));
    if (snapshot.vectors.some((vector) => !vector.resource_type_code)) {
      values.push({ value: EMPTY_TYPE_FILTER, label: "Geen type" });
    }
    return values;
  }, [snapshot]);

  const statusOptions = useMemo(() => {
    if (!snapshot) return [];
    const knownCodes = new Set(snapshot.statuses.map((status) => status.code));
    const unknownCodes = [...new Set(snapshot.vectors.map((vector) => vector.operational_status_code)
      .filter((code) => code && !knownCodes.has(code)))].sort((left, right) => left.localeCompare(right, "nl-BE", { numeric: true }));
    const values = snapshot.statuses.map((status) => ({
      value: status.code,
      label: `${status.code} · ${status.description}`,
    }));
    values.push(...unknownCodes.map((code) => ({ value: code, label: `${code} · Onbekende status` })));
    if (snapshot.vectors.some((vector) => !vector.operational_status_code)) {
      values.push({ value: EMPTY_STATUS_FILTER, label: "Geen statuscode" });
    }
    if (unknownCodes.length > 0) {
      values.push({ value: UNKNOWN_STATUS_FILTER, label: "Alle onbekende statussen" });
    }
    return values;
  }, [snapshot]);

  const vectors = useMemo(() => {
    const direction = sortDirection === "ascending" ? 1 : -1;
    return [...filteredVectors].sort((left, right) => {
      const leftValue = sortValue(left, sortColumn);
      const rightValue = sortValue(right, sortColumn);
      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), "nl-BE", { numeric: true, sensitivity: "base" });
      return comparison * direction || left.vector_code.localeCompare(right.vector_code, "nl-BE");
    });
  }, [filteredVectors, sortColumn, sortDirection]);

  const toggleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((current) => current === "ascending" ? "descending" : "ascending");
    } else {
      setSortColumn(column);
      setSortDirection("ascending");
    }
  };

  const sortHeader = (column: SortColumn, label: string, filterColumn?: FilterColumn) => {
    const active = sortColumn === column;
    const Icon = !active ? ArrowDownUp : sortDirection === "ascending" ? ArrowUp : ArrowDown;
    const selectedFilters = filterColumn === "service" ? serviceFilters
      : filterColumn === "type" ? typeFilters : statusFilters;
    const filterActive = selectedFilters.length > 0;
    const filterOpen = filterColumn !== undefined && openFilter?.column === filterColumn;
    return <th key={column} aria-sort={active ? sortDirection : undefined} className="!rounded-none px-4 py-3 align-middle">
      <div className="flex min-h-6 items-center gap-2 whitespace-nowrap">
        <button type="button" className="inline-flex items-center gap-2 leading-6 font-medium" aria-label={`Sorteer op ${label}`} onClick={() => toggleSort(column)}>
          {label}<Icon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        {filterColumn && <button
          type="button"
          className={`relative inline-flex h-6 min-w-6 w-6 shrink-0 items-center justify-center border ${filterActive ? "text-primary" : "text-muted-foreground"}`}
          aria-label={`${filterOpen ? "Sluit" : "Open"} filter voor ${label}${filterActive ? `, ${selectedFilters.length} geselecteerd` : ""}`}
          aria-expanded={filterOpen}
          onClick={(event) => {
            const anchor = event.currentTarget;
            setOpenFilter((current) => current?.column === filterColumn
              ? null
              : { column: filterColumn, anchor });
          }}
        >
          <Filter aria-hidden="true" className="h-3.5 w-3.5" />
          {filterActive && <span aria-hidden="true" className="absolute -right-3 -top-2 grid h-4 min-w-4 !rounded-full place-items-center bg-primary px-1 text-[9px] leading-none text-primary-foreground">{selectedFilters.length}</span>}
        </button>}
      </div>
    </th>;
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const task = await api.startCityGISRefresh();
      toast.success("CityGIS-verversing gestart", { description: `Taak ${task.task_id}` });
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "CityGIS-verversing kon niet worden gestart.");
    } finally {
      setRefreshing(false);
    }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">CityGIS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Voertuigen, operationele vectoren en hun actuele status.</p></div>
      <Button onClick={refresh} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Nu verversen</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="border bg-white p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Truck className="h-4 w-4" />Voertuigen</div><p className="mt-2 text-2xl font-semibold">{snapshot?.vehicles.length ?? "—"}</p></div>
      <div className="border bg-white p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="h-4 w-4" />Vectoren</div><p className="mt-2 text-2xl font-semibold">{snapshot?.vectors.length ?? "—"}</p></div>
      <div className="border bg-white p-4"><p className="text-sm text-muted-foreground">Laatst vernieuwd</p><p className="mt-2 text-sm font-medium">{formatDate(snapshot?.last_refreshed_at ?? null)}</p></div>
    </div>

    {!connected && <p role="status" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm">Liveverbinding tijdelijk onderbroken; opnieuw verbinden…</p>}
    {error && <p role="alert" className="border border-red-300 bg-red-50 px-4 py-3 text-sm">CityGIS kon niet worden geladen: {error}</p>}
    {snapshot?.sync_state.last_error && <p role="status" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm">Laatste synchronisatie mislukt: {snapshot.sync_state.last_error} De laatst opgeslagen gegevens blijven zichtbaar. Laatste poging: {formatDate(snapshot.sync_state.last_attempted_at)}.</p>}
    <section className="border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div><h2 className="font-semibold">Operationele vectoren</h2><p className="text-sm text-muted-foreground">Statuswijzigingen verschijnen zodra de volgende synchronisatie ze ophaalt.</p></div>
        <label className="relative w-full sm:w-72"><span className="sr-only">Vectoren zoeken</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek vector of voertuig" /></label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[34%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
            {sortHeader("vector", "Vector")}
            {sortHeader("service", "Dienst", "service")}
            {sortHeader("type", "Type", "type")}
            {sortHeader("vehicle", "Voertuig")}
            {sortHeader("status", "Operationele status", "status")}
            {sortHeader("status_updated_at", "Status sinds")}
          </tr></thead>
          <tbody className="divide-y">
            {!snapshot && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">CityGIS-gegevens laden…</td></tr>}
            {snapshot && vectors.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{snapshot.vectors.length ? "Geen overeenkomende vectoren." : "Nog geen vectorgegevens. De eerste automatische synchronisatie start binnen een minuut."}</td></tr>}
            {vectors.map((vector) => <tr key={vector.id} className={vector.is_current ? "" : "bg-muted/30 text-muted-foreground"}>
              <td className="px-4 py-3"><div className="font-medium">{vector.abbreviation || vector.name || vector.vector_code}{!vector.is_current && <span className="ml-2 text-xs font-normal">Niet meer gemeld</span>}</div><div className="text-xs text-muted-foreground">{vector.vector_code}</div></td>
              <td className="px-4 py-3">{vector.service_abbreviation || "—"}</td>
              <td className="px-4 py-3">{vector.resource_type_code || "—"}</td>
              <td className="px-4 py-3">{vector.vehicle?.alphacode || vector.source_vehicle_name || "—"}</td>
              <td className="px-4 py-3"><StatusLabel vector={vector} onClick={() => setStatusHistoryVector(vector)} /></td>
              <td className="px-4 py-3"><time dateTime={vector.status_updated_at ?? undefined} title={formatDate(vector.status_updated_at)}>{formatElapsed(vector.status_updated_at, now)}</time></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    {openFilter && <FilterPopover
      key={openFilter.column}
      anchor={openFilter.anchor}
      label={openFilter.column === "service" ? "Dienst" : openFilter.column === "type" ? "Type" : "Operationele status"}
      options={openFilter.column === "service" ? serviceOptions : openFilter.column === "type" ? typeOptions : statusOptions}
      selected={openFilter.column === "service" ? serviceFilters : openFilter.column === "type" ? typeFilters : statusFilters}
      onChange={openFilter.column === "service" ? setServiceFilters : openFilter.column === "type" ? setTypeFilters : setStatusFilters}
      onClose={() => setOpenFilter(null)}
    />}

    {statusHistoryVector && <CityGISStatusHistoryDialog
      vectorId={statusHistoryVector.id}
      vectorLabel={statusHistoryVector.abbreviation || statusHistoryVector.vector_code}
      vehicleLabel={statusHistoryVector.vehicle?.alphacode || statusHistoryVector.source_vehicle_name}
      onClose={closeStatusHistory}
    />}

    <details className="border bg-white p-4">
      <summary className="cursor-pointer font-semibold">Statuscodes en kleuren ({snapshot?.statuses.length ?? 17})</summary>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot?.statuses.map((status) => <div key={status.code} className="flex items-center gap-3 border p-2 text-sm">
          <span className="h-5 w-5 shrink-0 border border-black/20" style={{ backgroundColor: status.color }} />
          <span className="w-8 font-mono">{status.code}</span><span>{status.description}</span>
        </div>)}
      </div>
    </details>
  </div>;
}
