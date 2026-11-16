import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { PagerScanControl } from "@/components/PagerScanControl";
import { api, type InventorySnapshot } from "@/lib/api";
import {
  InventoryRelationshipDialog,
  type InventorySelection,
} from "@/pages/InventoryRelationshipDialog";

type ManagedObjectType = InventorySelection["kind"];

const objectTypes: Array<{ value: ManagedObjectType; label: string }> = [
  { value: "pager", label: "Pagers" },
  { value: "vector", label: "Vectoren" },
  { value: "ric_code", label: "RiC/AdC" },
];

interface InventoryColumn {
  key: string;
  label: string;
}

const inventoryColumns: Record<ManagedObjectType, InventoryColumn[]> = {
  pager: [
    { key: "pager", label: "Pager" },
    { key: "pager_relation", label: "Vector of type" },
  ],
  vector: [
    { key: "vector", label: "Vector" },
    { key: "service", label: "Dienst" },
    { key: "post", label: "Post" },
    { key: "vehicle", label: "Voertuig" },
    { key: "status", label: "Status" },
  ],
  ric_code: [
    { key: "alias", label: "Alias" },
    { key: "codes", label: "RiC/AdC" },
    { key: "linked_vector", label: "Gekoppelde vector" },
  ],
};

function vectorLabel(vector: InventorySnapshot["vectors"][number]): string {
  return vector.abbreviation || vector.name || vector.vector_code;
}

function locationForVector(vector: InventorySnapshot["vectors"][number]): string {
  return vector.post?.kind === "post" ? vector.post.name : "Zonder post";
}

function InventoryStatusLabel({ vector }: { vector: InventorySnapshot["vectors"][number] }) {
  const color = vector.status_color ?? "#E5E7EB";
  return <span className="inline-flex items-center gap-2 border px-2 py-1 text-xs font-medium" title={`Status ${vector.operational_status_code || "?"} · ${vector.status_description || "Onbekende status"}`}>
    <span aria-hidden="true" className="h-3 w-3 border border-black/20" style={{ backgroundColor: color }} />
    {vector.operational_status_code || "?"} · {vector.status_description || "Onbekende status"}
  </span>;
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">
      {message}
    </div>
  );
}

function InventoryRow({
  snapshot,
  selection,
  onSelect,
}: {
  snapshot: InventorySnapshot;
  selection: InventorySelection;
  onSelect: (selection: InventorySelection) => void;
}) {
  if (selection.kind === "pager") {
    const pager = snapshot.pagers.find((row) => row.id === selection.id);
    if (!pager) return null;
    const vector = snapshot.vectors.find((row) => row.id === pager.assigned_vector_id);
    return (
      <tr>
        <td className="px-4 py-3 align-middle">
        <button
          type="button"
          className="w-full text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Beheer koppelingen voor pager ${pager.serial_number}`}
          onClick={() => onSelect(selection)}
        >{pager.serial_number}</button>
        </td>
        <td className="px-4 py-3 align-middle text-sm text-muted-foreground">{vector ? `${vectorLabel(vector)} · ${locationForVector(vector)}` : pager.type.name}</td>
      </tr>
    );
  }

  if (selection.kind === "vector") {
    const vector = snapshot.vectors.find((row) => row.id === selection.id);
    if (!vector) return null;
    return (
      <tr className={vector.is_current ? "" : "bg-muted/30 text-muted-foreground"}>
        <td className="px-4 py-3 align-middle">
        <button
          type="button"
          className="w-full text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Beheer koppelingen voor vector ${vectorLabel(vector)}`}
          onClick={() => onSelect(selection)}
        >{vectorLabel(vector)}</button>
        </td>
        <td className="px-4 py-3 align-middle">{vector.service?.abbreviation || vector.service_abbreviation || "—"}</td>
        <td className="px-4 py-3 align-middle">{locationForVector(vector)}</td>
        <td className="px-4 py-3 align-middle">{vector.vehicle ? `${vector.vehicle.alphacode} · ${vector.vehicle.plate || "Geen nummerplaat"}` : vector.source_vehicle_name || "—"}</td>
        <td className="px-4 py-3 align-middle"><InventoryStatusLabel vector={vector} /></td>
      </tr>
    );
  }

  const code = snapshot.ric_codes.find((row) => row.id === selection.id);
  if (!code) return null;
  const vector = snapshot.vectors.find((row) => row.id === code.vector_id);
  return (
    <tr>
      <td className="px-4 py-3 align-middle">
      <button
        type="button"
        className="w-full text-left font-normal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Beheer koppelingen voor RiC/AdC ${code.alias}`}
        onClick={() => onSelect(selection)}
      >{code.alias}</button>
      </td>
      <td className="px-4 py-3 align-middle text-sm text-muted-foreground">RiC {code.ric_code} / AdC {code.adc_code}</td>
      <td className="px-4 py-3 align-middle text-sm text-muted-foreground">{vector ? vectorLabel(vector) : "Geen vector"}</td>
    </tr>
  );
}

function objectSelections(type: ManagedObjectType, snapshot: InventorySnapshot): InventorySelection[] {
  switch (type) {
    case "pager":
      return snapshot.pagers.map(({ id }) => ({ kind: "pager", id }));
    case "vector":
      return snapshot.vectors.map(({ id }) => ({ kind: "vector", id }));
    case "ric_code":
      return snapshot.ric_codes.map(({ id }) => ({ kind: "ric_code", id }));
  }
}

function searchText(selection: InventorySelection, snapshot: InventorySnapshot): string {
  if (selection.kind === "pager") {
    const pager = snapshot.pagers.find((row) => row.id === selection.id);
    if (!pager) return "";
    const vector = snapshot.vectors.find((row) => row.id === pager.assigned_vector_id);
    return `${pager.serial_number} ${pager.type.name} ${vector ? vectorLabel(vector) : ""}`;
  }
  if (selection.kind === "vector") {
    const vector = snapshot.vectors.find((row) => row.id === selection.id);
    if (!vector) return "";
    return `${vectorLabel(vector)} ${vector.vector_code} ${vector.service_abbreviation} ${locationForVector(vector)} ${vector.vehicle?.alphacode ?? ""} ${vector.status_description ?? ""}`;
  }
  const code = snapshot.ric_codes.find((row) => row.id === selection.id);
  if (!code) return "";
  const vector = snapshot.vectors.find((row) => row.id === code.vector_id);
  return `${code.alias} ${code.ric_code} ${code.adc_code} ${vector ? vectorLabel(vector) : ""}`;
}

function sortValue(selection: InventorySelection, key: string, snapshot: InventorySnapshot): string {
  if (selection.kind === "pager") {
    const pager = snapshot.pagers.find((row) => row.id === selection.id);
    if (!pager) return "";
    const vector = snapshot.vectors.find((row) => row.id === pager.assigned_vector_id);
    return key === "pager" ? pager.serial_number : vector ? `${vectorLabel(vector)} ${locationForVector(vector)}` : pager.type.name;
  }
  if (selection.kind === "vector") {
    const vector = snapshot.vectors.find((row) => row.id === selection.id);
    if (!vector) return "";
    switch (key) {
      case "service": return vector.service?.abbreviation || vector.service_abbreviation;
      case "post": return locationForVector(vector);
      case "vehicle": return vector.vehicle ? `${vector.vehicle.alphacode} ${vector.vehicle.plate}` : vector.source_vehicle_name;
      case "status": return `${vector.operational_status_code} ${vector.status_description}`;
      default: return vectorLabel(vector);
    }
  }
  const code = snapshot.ric_codes.find((row) => row.id === selection.id);
  if (!code) return "";
  if (key === "codes") return `${code.ric_code} ${code.adc_code}`;
  if (key === "linked_vector") {
    const vector = snapshot.vectors.find((row) => row.id === code.vector_id);
    return vector ? vectorLabel(vector) : "";
  }
  return code.alias;
}

export function InventoryPage() {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [objectType, setObjectType] = useState<ManagedObjectType>("pager");
  const [sortColumn, setSortColumn] = useState(inventoryColumns.pager[0].key);
  const [sortDirection, setSortDirection] = useState<"ascending" | "descending">("ascending");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<InventorySelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const data = await api.getInventory();
    setSnapshot(data);
    setError("");
  };

  useEffect(() => {
    let active = true;
    api.getInventory().then((data) => {
      if (active) setSnapshot(data);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Inventaris laden is niet gelukt.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const savePagerVector = async (pagerId: number, vectorId: number | null): Promise<boolean> => {
    setSaving(`pager-${pagerId}`);
    setError("");
    try {
      await api.updatePagerVector(pagerId, vectorId);
      await refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pagerkoppeling opslaan is niet gelukt.");
      return false;
    } finally {
      setSaving(null);
    }
  };

  const saveRicVector = async (codeId: number, vectorId: number | null): Promise<boolean> => {
    setSaving(`code-${codeId}`);
    setError("");
    try {
      await api.updateRicCodeVector(codeId, vectorId);
      await refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "RiC/AdC-koppeling opslaan is niet gelukt.");
      return false;
    } finally {
      setSaving(null);
    }
  };

  const scanPager = async (rawScan: string) => {
    try {
      const result = await api.scanPager(rawScan);
      await refresh();
      setSelection({ kind: "pager", id: result.pager.id });
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "De pager kon niet via de scan worden gevonden.");
    }
  };

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Inventaris laden…</p>;
  if (error && !snapshot) return <ErrorMessage message={error} />;
  if (!snapshot) return null;

  const normalizedQuery = query.trim().toLocaleLowerCase("nl-BE");
  const matchingRows = objectSelections(objectType, snapshot).filter((row) =>
    searchText(row, snapshot).toLocaleLowerCase("nl-BE").includes(normalizedQuery),
  );
  const activeSortColumn = inventoryColumns[objectType].find((column) => column.key === sortColumn) ?? inventoryColumns[objectType][0];
  const direction = sortDirection === "ascending" ? 1 : -1;
  const rows = [...matchingRows].sort((left, right) => {
    const comparison = sortValue(left, activeSortColumn.key, snapshot).localeCompare(
      sortValue(right, activeSortColumn.key, snapshot),
      "nl-BE",
      { numeric: true, sensitivity: "base" },
    );
    return comparison * direction || `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`, "nl-BE", { numeric: true });
  });
  const typeLabel = objectTypes.find((type) => type.value === objectType)?.label ?? "Objecten";

  const toggleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection((current) => current === "ascending" ? "descending" : "ascending");
    } else {
      setSortColumn(key);
      setSortDirection("ascending");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Assetbeheer</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Inventaris</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium" htmlFor="managed-object-type">
            Type managed object
            <select
              id="managed-object-type"
              className="h-10 min-w-52 border border-input bg-background px-3 text-sm"
              value={objectType}
              onChange={(event) => {
                const nextType = event.target.value as ManagedObjectType;
                setObjectType(nextType);
                setSortColumn(inventoryColumns[nextType][0].key);
                setSortDirection("ascending");
                setQuery("");
              }}
            >
              {objectTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
        </div>
      </header>

      {error && !selection && <ErrorMessage message={error} />}

      <section aria-label={`${typeLabel} beheren`} className="overflow-hidden border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-semibold">{typeLabel}</h2>
            <p className="text-sm text-muted-foreground">{rows.length} objecten</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <span className="sr-only">Zoek objecten</span>
              <input
                id="inventory-search"
                type="search"
                className="h-9 w-full border border-input bg-background px-3 text-sm"
                placeholder={`Zoek in ${typeLabel.toLocaleLowerCase("nl-BE")}…`}
                aria-label="Zoek objecten"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {objectType === "pager" && <PagerScanControl onScan={scanPager} />}
          </div>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className={`w-full ${objectType === "vector" ? "min-w-[950px]" : objectType === "ric_code" ? "min-w-[760px]" : "min-w-[600px]"} table-fixed border-collapse text-left text-sm`}>
              <colgroup>
                {objectType === "vector" ? <>
                  <col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[14%]" /><col className="w-[20%]" /><col className="w-[38%]" />
                </> : objectType === "ric_code" ? <>
                  <col className="w-[30%]" /><col className="w-[35%]" /><col className="w-[35%]" />
                </> : <>
                  <col className="w-1/2" /><col className="w-1/2" />
                </>}
              </colgroup>
              <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {inventoryColumns[objectType].map((column) => {
                    const active = activeSortColumn.key === column.key;
                    const Icon = !active ? ArrowDownUp : sortDirection === "ascending" ? ArrowUp : ArrowDown;
                    return <th key={column.key} scope="col" aria-sort={active ? sortDirection : undefined} className="px-4 py-3 align-middle">
                      <button type="button" className="inline-flex items-center gap-2 whitespace-nowrap font-semibold leading-6" aria-label={`Sorteer op ${column.label}`} onClick={() => toggleSort(column.key)}>
                        {column.label}<Icon aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </th>;
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => <InventoryRow key={`${row.kind}-${row.id}`} snapshot={snapshot} selection={row} onSelect={setSelection} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {normalizedQuery ? "Geen overeenkomende objecten." : "Geen objecten gevonden."}
          </p>
        )}
      </section>

      {selection && (
        <InventoryRelationshipDialog
          snapshot={snapshot}
          selection={selection}
          saving={saving}
          error={error}
          onClose={() => { setSelection(null); setError(""); }}
          onSavePagerVector={savePagerVector}
          onSaveRicVector={saveRicVector}
        />
      )}
    </div>
  );
}
