import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type {
  CityGISVector,
  InventoryPager,
  InventoryRicCode,
  InventorySnapshot,
} from "@/lib/api";

export type InventorySelection =
  | { kind: "pager"; id: number }
  | { kind: "vector"; id: number }
  | { kind: "ric_code"; id: number };

type LinkOutcome = (id: number, vectorId: number | null) => Promise<boolean>;

function vectorLabel(vector: CityGISVector): string {
  return vector.abbreviation || vector.name || vector.vector_code;
}

function vectorOptionLabel(vector: CityGISVector): string {
  const location = vector.post?.kind === "post" ? vector.post.name : "Zonder post";
  return `${vectorLabel(vector)} · ${location} · ${vector.service?.abbreviation || vector.service_abbreviation || "Geen dienst"}`;
}

function SearchableVectorPicker({
  vectors,
  value,
  onChange,
}: {
  vectors: CityGISVector[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const selected = vectors.find((vector) => vector.id === value) ?? null;
  const [search, setSearch] = useState(selected ? vectorOptionLabel(selected) : "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: "58vh" });
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("nl-BE");
    return vectors.filter((vector) => (vector.is_current || vector.id === value)
      && (!needle || vectorOptionLabel(vector).toLocaleLowerCase("nl-BE").includes(needle)));
  }, [search, value, vectors]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = inputRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const top = anchor.bottom + 4;
      const width = Math.min(anchor.width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
      const availableBelow = Math.max(80, window.innerHeight - anchor.bottom - 12);
      const contentHeight = listRef.current?.scrollHeight || window.innerHeight * 0.58;
      const maxHeight = `${Math.min(contentHeight, window.innerHeight * 0.58, 672, availableBelow)}px`;
      setPosition({ top, left, width, maxHeight });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [filtered.length, open]);

  const choose = (vector: CityGISVector) => {
    onChange(vector.id);
    setSearch(vectorOptionLabel(vector));
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      <label htmlFor="inventory-vector-search" className="text-sm font-medium">Vector</label>
      <div className="relative">
        <input
          ref={inputRef}
          id="inventory-vector-search"
          type="search"
          role="combobox"
          aria-label="Zoek vector"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="inventory-vector-options"
          className="h-10 w-full border border-input bg-background px-3 text-sm"
          placeholder="Zoek op vectorcode, post of dienst…"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            onChange(null);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              return;
            }
            if (event.key === "Enter" && open && filtered[0]) {
              event.preventDefault();
              choose(filtered[0]);
            }
          }}
        />
        {open && createPortal(
          <div ref={listRef} id="inventory-vector-options" role="listbox" className="fixed z-[60] max-h-[min(58vh,42rem)] overflow-y-auto border bg-white shadow-lg" style={position}>
            {filtered.length ? filtered.map((vector) => (
              <button
                key={vector.id}
                type="button"
                role="option"
                aria-selected={vector.id === value}
                className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => choose(vector)}
              >{vectorOptionLabel(vector)}</button>
            )) : <p className="px-3 py-3 text-sm text-muted-foreground">Geen vectoren gevonden.</p>}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}

function SingleVectorRelationship({
  vectors,
  currentVectorId,
  saving,
  onSave,
  onClose,
}: {
  vectors: CityGISVector[];
  currentVectorId: number | null;
  saving: boolean;
  onSave: (vectorId: number | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const [vectorId, setVectorId] = useState<number | null>(currentVectorId);
  const submit = async () => {
    if (vectorId === null || vectorId === currentVectorId) return;
    if (await onSave(vectorId)) onClose();
  };
  const unlink = async () => {
    if (await onSave(null)) onClose();
  };

  return (
    <div className="space-y-4">
      <SearchableVectorPicker vectors={vectors} value={vectorId} onChange={setVectorId} />
      {!vectors.length && <p className="text-sm text-muted-foreground">Er zijn geen vectoren beschikbaar.</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onClose}>Sluiten</Button>
        {currentVectorId !== null && (
          <Button type="button" variant="outline" disabled={saving} onClick={() => void unlink()}>
            Ontkoppel vector
          </Button>
        )}
        <Button type="button" disabled={saving || vectorId === null || vectorId === currentVectorId} onClick={() => void submit()}>
          Koppeling opslaan
        </Button>
      </div>
    </div>
  );
}

interface RelationshipItem {
  id: number;
  title: string;
  description: string;
}

function RelationshipColumn({
  title,
  searchLabel,
  emptyText,
  actionLabel,
  items,
  saving,
  onSelect,
}: {
  title: string;
  searchLabel: string;
  emptyText: string;
  actionLabel: (item: RelationshipItem) => string;
  items: RelationshipItem[];
  saving: (id: number) => boolean;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("nl-BE");
  const visible = items.filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase("nl-BE").includes(needle));

  return (
    <section aria-label={title} className="flex min-h-64 min-w-0 flex-col border">
      <div className="border-b p-3">
        <h3 className="font-medium">{title} <span className="text-xs font-normal text-muted-foreground">({items.length})</span></h3>
        <label htmlFor={`relationship-search-${searchLabel.replaceAll(" ", "-")}`} className="sr-only">{searchLabel}</label>
        <input
          id={`relationship-search-${searchLabel.replaceAll(" ", "-")}`}
          type="search"
          aria-label={searchLabel}
          placeholder="Zoeken…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-2 h-9 w-full border border-input bg-background px-3 text-sm"
        />
      </div>
      {visible.length ? (
        <ul aria-label={`${title} resultaten`} className="max-h-[min(50vh,32rem)] flex-1 overflow-y-auto">
          {visible.map((item) => (
            <li key={item.id} className="border-b last:border-b-0">
              <button
                type="button"
                disabled={saving(item.id)}
                aria-label={actionLabel(item)}
                className="w-full px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50"
                onClick={() => onSelect(item.id)}
              >
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">{needle ? "Geen overeenkomende opties." : emptyText}</p>
      )}
    </section>
  );
}

function VectorRelationshipManager({
  vector,
  snapshot,
  saving,
  onSavePager,
  onSaveRic,
  onClose,
}: {
  vector: CityGISVector;
  snapshot: InventorySnapshot;
  saving: string | null;
  onSavePager: LinkOutcome;
  onSaveRic: LinkOutcome;
  onClose: () => void;
}) {
  const [activeType, setActiveType] = useState<"pager" | "ric_code">("pager");
  const label = vectorLabel(vector);
  const pagerItems = (rows: InventoryPager[]): RelationshipItem[] => rows.map((pager) => ({
    id: pager.id,
    title: pager.serial_number,
    description: pager.type.name,
  }));
  const codeItems = (rows: InventoryRicCode[]): RelationshipItem[] => rows.map((code) => ({
    id: code.id,
    title: code.alias,
    description: `RiC ${code.ric_code} / AdC ${code.adc_code}`,
  }));
  const togglePager = (id: number, linked: boolean) => void onSavePager(id, linked ? null : vector.id);
  const toggleCode = (id: number, linked: boolean) => void onSaveRic(id, linked ? null : vector.id);
  const service = vector.service?.abbreviation || vector.service_abbreviation || "Geen dienst";
  const post = vector.post?.kind === "post" ? vector.post.name : "Zonder post";
  const vehicle = vector.vehicle
    ? `${vector.vehicle.alphacode} · ${vector.vehicle.plate || "Geen nummerplaat"}`
    : vector.source_vehicle_name || "Geen voertuig";

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-5 gap-y-1 border-y bg-muted/20 px-3 py-2 text-sm sm:grid-cols-3">
        <div><dt className="inline text-muted-foreground">Dienst </dt><dd className="inline font-medium">{service}</dd></div>
        <div><dt className="inline text-muted-foreground">Post </dt><dd className="inline font-medium">{post}</dd></div>
        <div><dt className="inline text-muted-foreground">Voertuig </dt><dd className="inline font-medium">{vehicle}</dd></div>
        <div><dt className="inline text-muted-foreground">Status </dt><dd className="inline font-medium">{vector.operational_status_code} · {vector.status_description || "Onbekend"}</dd></div>
      </dl>
      <div role="tablist" aria-label="Relatietype" className="flex border-b">
        <button type="button" role="tab" aria-selected={activeType === "pager"} className={`border-b-2 px-4 py-2 text-sm ${activeType === "pager" ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`} onClick={() => setActiveType("pager")}>
          Pagers ({snapshot.pagers.filter((pager) => pager.assigned_vector_id === vector.id).length})
        </button>
        <button type="button" role="tab" aria-selected={activeType === "ric_code"} className={`border-b-2 px-4 py-2 text-sm ${activeType === "ric_code" ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`} onClick={() => setActiveType("ric_code")}>
          RiC/AdC ({snapshot.ric_codes.filter((code) => code.vector_id === vector.id).length})
        </button>
      </div>
      {activeType === "pager" ? (
        <div role="tabpanel" className="grid gap-3 md:grid-cols-2">
          <RelationshipColumn
            title="Vrije pagers"
            searchLabel="Zoek vrije pagers"
            emptyText="Geen vrije pagers."
            items={pagerItems(snapshot.pagers.filter((pager) => pager.assigned_vector_id === null))}
            saving={(id) => saving === `pager-${id}`}
            actionLabel={(item) => `Koppel pager ${item.title} aan ${label}`}
            onSelect={(id) => togglePager(id, false)}
          />
          <RelationshipColumn
            title="Gekoppelde pagers"
            searchLabel="Zoek gekoppelde pagers"
            emptyText="Geen pagers gekoppeld."
            items={pagerItems(snapshot.pagers.filter((pager) => pager.assigned_vector_id === vector.id))}
            saving={(id) => saving === `pager-${id}`}
            actionLabel={(item) => `Ontkoppel pager ${item.title} van ${label}`}
            onSelect={(id) => togglePager(id, true)}
          />
        </div>
      ) : (
        <div role="tabpanel" className="grid gap-3 md:grid-cols-2">
          <RelationshipColumn
            title="Vrije RiC/AdC-codes"
            searchLabel="Zoek vrije RiC/AdC-codes"
            emptyText="Geen vrije RiC/AdC-codes."
            items={codeItems(snapshot.ric_codes.filter((code) => code.vector_id === null))}
            saving={(id) => saving === `code-${id}`}
            actionLabel={(item) => `Koppel RiC-code ${item.title} aan ${label}`}
            onSelect={(id) => toggleCode(id, false)}
          />
          <RelationshipColumn
            title="Gekoppelde RiC/AdC-codes"
            searchLabel="Zoek gekoppelde RiC/AdC-codes"
            emptyText="Geen RiC/AdC-codes gekoppeld."
            items={codeItems(snapshot.ric_codes.filter((code) => code.vector_id === vector.id))}
            saving={(id) => saving === `code-${id}`}
            actionLabel={(item) => `Ontkoppel RiC-code ${item.title} van ${label}`}
            onSelect={(id) => toggleCode(id, true)}
          />
        </div>
      )}
      <div className="flex justify-end border-t pt-3">
        <Button type="button" variant="outline" onClick={onClose}>Sluiten</Button>
      </div>
    </div>
  );
}

export function InventoryRelationshipDialog({
  snapshot,
  selection,
  saving,
  error,
  onClose,
  onSavePagerVector,
  onSaveRicVector,
}: {
  snapshot: InventorySnapshot;
  selection: InventorySelection;
  saving: string | null;
  error: string;
  onClose: () => void;
  onSavePagerVector: LinkOutcome;
  onSaveRicVector: LinkOutcome;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  let title = "";
  let details: ReactNode = null;
  let content: ReactNode = null;
  let width = "max-w-xl";
  const isSingleRelationship = selection.kind !== "vector";

  if (selection.kind === "pager") {
    const pager = snapshot.pagers.find((row) => row.id === selection.id);
    if (!pager) return null;
    const currentVectorId = pager.assigned_vector_id;
    title = `Pager ${pager.serial_number}`;
    details = <p className="text-sm text-muted-foreground">{pager.type.name}</p>;
    content = (
      <SingleVectorRelationship
        vectors={snapshot.vectors}
        currentVectorId={currentVectorId}
        saving={saving === `pager-${pager.id}`}
        onSave={(vectorId) => onSavePagerVector(pager.id, vectorId)}
        onClose={onClose}
      />
    );
  } else if (selection.kind === "ric_code") {
    const code = snapshot.ric_codes.find((row) => row.id === selection.id);
    if (!code) return null;
    title = `RiC/AdC ${code.alias}`;
    details = <p className="text-sm text-muted-foreground">RiC {code.ric_code} / AdC {code.adc_code}</p>;
    content = (
      <SingleVectorRelationship
        vectors={snapshot.vectors}
        currentVectorId={code.vector_id}
        saving={saving === `code-${code.id}`}
        onSave={(vectorId) => onSaveRicVector(code.id, vectorId)}
        onClose={onClose}
      />
    );
  } else {
    const vector = snapshot.vectors.find((row) => row.id === selection.id);
    if (!vector) return null;
    title = `Vector ${vectorLabel(vector)}`;
    details = <p className="text-sm text-muted-foreground">{vector.vector_code}</p>;
    width = "max-w-5xl";
    content = (
      <VectorRelationshipManager
        vector={vector}
        snapshot={snapshot}
        saving={saving}
        onSavePager={onSavePagerVector}
        onSaveRic={onSaveRicVector}
        onClose={onClose}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title" className={`${isSingleRelationship ? "max-h-[calc(100vh-2rem)] overflow-visible" : "max-h-[calc(100vh-1.5rem)] overflow-y-auto"} w-full ${width} border bg-white p-4 shadow-xl sm:p-5`}>
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="inventory-dialog-title" className="truncate text-lg font-semibold">{title}</h2>
            {details}
          </div>
          <button type="button" aria-label="Sluiten" autoFocus className="grid h-9 w-9 shrink-0 place-items-center border text-lg leading-none hover:bg-muted" onClick={onClose}>×</button>
        </header>
        {error && <div role="alert" className="mb-4 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {content}
      </section>
    </div>,
    document.body,
  );
}
