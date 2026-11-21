import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type CityGISLocation, type LocationKind, type LocationOverview, type LocationServiceOption, type LocationValues } from "@/lib/api";

const locationKinds: Array<{ value: LocationKind; label: string }> = [
  { value: "post", label: "Post" },
  { value: "building", label: "Gebouw" },
  { value: "room", label: "Lokaal" },
  { value: "other", label: "Andere locatie" },
];

interface LocationFormState {
  name: string;
  sort_name: string;
  kind: LocationKind;
  parent_id: string;
  service_id: string;
}

const emptyForm: LocationFormState = {
  name: "",
  sort_name: "",
  kind: "other",
  parent_id: "",
  service_id: "",
};

function sortLocations(rows: CityGISLocation[]): CityGISLocation[] {
  const compare = (left: string, right: string) =>
    left.localeCompare(right, "nl-BE", { sensitivity: "base", numeric: true });
  return [...rows].sort((left, right) => {
    const leftSortName = left.sort_name.trim();
    const rightSortName = right.sort_name.trim();
    if (leftSortName && !rightSortName) return -1;
    if (!leftSortName && rightSortName) return 1;
    return (leftSortName && rightSortName ? compare(leftSortName, rightSortName) : 0)
      || compare(left.name, right.name)
      || left.id - right.id;
  });
}

function getDescendantIds(locationId: number, rows: CityGISLocation[]): Set<number> {
  const descendants = new Set<number>();
  const pending = [locationId];
  while (pending.length) {
    const parentId = pending.pop();
    if (parentId === undefined) continue;
    for (const child of rows) {
      if (child.parent_id === parentId && !descendants.has(child.id)) {
        descendants.add(child.id);
        pending.push(child.id);
      }
    }
  }
  return descendants;
}

function locationKindLabel(kind: LocationKind): string {
  return locationKinds.find((item) => item.value === kind)?.label ?? kind;
}

function LocationTree({
  locations,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}: {
  locations: CityGISLocation[];
  selectedId: number | null;
  expandedIds: Set<number>;
  onSelect: (location: CityGISLocation) => void;
  onToggle: (id: number) => void;
}) {
  const byParent = new Map<number | null, CityGISLocation[]>();
  for (const location of locations) {
    const parentId = location.parent_id !== null && locations.some((row) => row.id === location.parent_id)
      ? location.parent_id
      : null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), location]);
  }

  const renderLevel = (parentId: number | null, path: Set<number>) => {
    const rows = sortLocations(byParent.get(parentId) ?? []).filter((row) => !path.has(row.id));
    if (!rows.length) return null;
    return <ul className="space-y-1" role={parentId === null ? "tree" : "group"} aria-label={parentId === null ? "Locatiehiërarchie" : undefined}>
      {rows.map((location) => {
        const children = byParent.get(location.id) ?? [];
        const expanded = expandedIds.has(location.id);
        const nextPath = new Set(path).add(location.id);
        return <li key={location.id} role="treeitem" aria-selected={selectedId === location.id} aria-expanded={children.length ? expanded : undefined}>
          <div className="flex items-center gap-1">
            {children.length > 0 ? <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${expanded ? "Verberg" : "Toon"} onderlocaties van ${location.name}`}
              aria-expanded={expanded}
              onClick={() => onToggle(location.id)}
            >{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
              : <span aria-hidden="true" className="h-8 w-8 shrink-0" />}
            <button
              type="button"
              className={`min-w-0 flex-1 px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId === location.id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
              aria-label={location.name}
              aria-current={selectedId === location.id ? "true" : undefined}
              onClick={() => onSelect(location)}
            >
              <span className="block truncate">{location.name}</span>
              <span className="block text-xs font-normal text-muted-foreground">{locationKindLabel(location.kind)}</span>
            </button>
          </div>
          {children.length > 0 && expanded && <div className="ml-4 border-l pl-2">{renderLevel(location.id, nextPath)}</div>}
        </li>;
      })}
    </ul>;
  };

  return renderLevel(null, new Set());
}

export function LocationsPage() {
  const [locations, setLocations] = useState<CityGISLocation[]>([]);
  const [services, setServices] = useState<LocationServiceOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overview, setOverview] = useState<LocationOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CityGISLocation | null>(null);
  const [form, setForm] = useState<LocationFormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextLocations, nextServices] = await Promise.all([
        api.listLocations(),
        api.listLocationServices(),
      ]);
      setLocations(nextLocations);
      setServices(nextServices);
      setSelectedId((current) => nextLocations.some((row) => row.id === current)
        ? current
        : nextLocations[0]?.id ?? null);
      setExpandedIds(new Set(nextLocations.filter((row) => nextLocations.some((child) => child.parent_id === row.id)).map((row) => row.id)));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Locaties laden is niet gelukt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedLocation = locations.find((location) => location.id === selectedId) ?? null;
  const selectedLocationId = selectedLocation?.id;
  const selectedLocationKind = selectedLocation?.kind;

  useEffect(() => {
    if (selectedLocationId === undefined || selectedLocationKind !== "post") {
      setOverview(null);
      setOverviewError("");
      setOverviewLoading(false);
      return;
    }

    let active = true;
    setOverview(null);
    setOverviewError("");
    setOverviewLoading(true);
    api.getLocationOverview(selectedLocationId).then((data) => {
      if (active) setOverview(data);
    }).catch((reason: unknown) => {
      if (active) setOverviewError(reason instanceof Error ? reason.message : "Postgegevens laden is niet gelukt.");
    }).finally(() => {
      if (active) setOverviewLoading(false);
    });
    return () => { active = false; };
  }, [selectedLocationId, selectedLocationKind]);
  const descendantIds = useMemo(
    () => editingLocation ? getDescendantIds(editingLocation.id, locations) : new Set<number>(),
    [editingLocation, locations],
  );
  const parentOptions = sortLocations(locations).filter((location) =>
    location.id !== editingLocation?.id && !descendantIds.has(location.id));
  const serviceOptions = services.filter((service) =>
    service.location_id === null || service.location_id === editingLocation?.id);
  const hasChildren = (location: CityGISLocation) => locations.some((child) => child.parent_id === location.id);

  const openCreateForm = (parentId: number | null) => {
    setEditingLocation(null);
    setForm({ ...emptyForm, parent_id: parentId === null ? "" : String(parentId) });
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (location: CityGISLocation) => {
    setEditingLocation(location);
    setForm({
      name: location.name,
      sort_name: location.sort_name,
      kind: location.kind,
      parent_id: location.parent_id === null ? "" : String(location.parent_id),
      service_id: location.service_id === null ? "" : String(location.service_id),
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingLocation(null);
    setFormError("");
  };

  const saveLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError("Vul een locatienaam in.");
      return;
    }
    const values: LocationValues = {
      name,
      sort_name: form.sort_name.trim(),
      kind: form.kind,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      service_id: form.kind === "post" && form.service_id ? Number(form.service_id) : null,
    };
    setSaving(true);
    setFormError("");
    try {
      const saved = editingLocation
        ? await api.updateLocation(editingLocation.id, values)
        : await api.createLocation(values);
      closeForm();
      await refresh();
      setSelectedId(saved.id);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Locatie opslaan is niet gelukt.");
    } finally {
      setSaving(false);
    }
  };

  const removeLocation = async (location: CityGISLocation) => {
    if (hasChildren(location) || location.service_id !== null) return;
    if (!window.confirm(`Locatie ${location.name} verwijderen?`)) return;
    setDeleting(true);
    setError("");
    try {
      await api.deleteLocation(location.id);
      setSelectedId(location.parent_id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Locatie verwijderen is niet gelukt.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-primary">Beheer</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Locaties</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Beheer posten, gebouwen en lokalen. CityGIS-diensten en operationele gegevens blijven bronbeheerd.</p>
      </div>
      <Button size="icon" aria-label="Locatie toevoegen" title="Locatie toevoegen" onClick={() => openCreateForm(null)}><Plus className="h-4 w-4" /></Button>
    </div>

    {error && <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

    <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.5fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Locatiehiërarchie</CardTitle>
          <CardDescription>Selecteer een locatie om details te beheren.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p role="status" className="text-sm text-muted-foreground">Locaties laden…</p>
            : locations.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen locaties</p>
              : <LocationTree
                locations={locations}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={(location) => setSelectedId(location.id)}
                onToggle={toggleExpanded}
              />}
        </CardContent>
      </Card>

      <Card>
        {formOpen ? <>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{editingLocation ? "Locatie bewerken" : "Locatie toevoegen"}</CardTitle>
                <CardDescription>{editingLocation ? "Wijzig de lokale locatiegegevens." : "Voeg een locatie toe aan de hiërarchie."}</CardDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Formulier sluiten" onClick={closeForm}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" noValidate aria-describedby={formError ? "location-form-error" : undefined} onSubmit={(event) => void saveLocation(event)}>
              <label className="space-y-2 text-sm font-medium" htmlFor="location-name">
                Naam
                <Input id="location-name" required maxLength={160} aria-invalid={Boolean(formError)} aria-describedby={formError ? "location-form-error" : undefined} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="space-y-2 text-sm font-medium" htmlFor="location-kind">
                Type
                <select id="location-kind" aria-invalid={Boolean(formError)} aria-describedby={formError ? "location-form-error" : undefined} className="h-10 w-full border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as LocationKind, service_id: event.target.value === "post" ? current.service_id : "" }))}>
                  {locationKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium" htmlFor="location-parent">
                Bovenliggende locatie
                <select id="location-parent" aria-invalid={Boolean(formError)} aria-describedby={formError ? "location-form-error" : undefined} className="h-10 w-full border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.parent_id} onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value }))}>
                  <option value="">Geen (hoofdniveau)</option>
                  {parentOptions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
              {form.kind === "post" && <div className="space-y-2">
                <label className="block space-y-2 text-sm font-medium" htmlFor="location-service">
                  CityGIS-dienst
                  <select id="location-service" aria-invalid={Boolean(formError)} aria-describedby={formError ? "location-service-help location-form-error" : "location-service-help"} className="h-10 w-full border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.service_id} onChange={(event) => setForm((current) => ({ ...current, service_id: event.target.value }))}>
                    <option value="">Geen dienst</option>
                    {serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.abbreviation}</option>)}
                  </select>
                </label>
                <p id="location-service-help" role="note" className="text-xs font-normal text-muted-foreground">Diensten worden door CityGIS beheerd.</p>
              </div>}
              <details className="sm:col-span-2">
                <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Geavanceerde opties</summary>
                <label className="mt-4 block space-y-2 text-sm font-medium" htmlFor="location-sort-name">
                  Sorteernaam
                  <Input id="location-sort-name" maxLength={160} aria-describedby="location-sort-name-help" value={form.sort_name} onChange={(event) => setForm((current) => ({ ...current, sort_name: event.target.value }))} />
                </label>
                <p id="location-sort-name-help" className="mt-1 text-xs text-muted-foreground">Wordt gebruikt voor de volgorde binnen hetzelfde niveau. Zonder sorteernaam volgt de locatie na locaties met een sorteernaam.</p>
              </details>
              {formError && <div id="location-form-error" role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{formError}</div>}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
                <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Annuleren</Button>
              </div>
            </form>
          </CardContent>
        </> : selectedLocation ? <>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />{locationKindLabel(selectedLocation.kind)}</p>
                <CardTitle className="mt-2">{selectedLocation.name}</CardTitle>
                <CardDescription>{selectedLocation.parent_id === null ? "Hoofdniveau" : `Onderdeel van ${locations.find((location) => location.id === selectedLocation.parent_id)?.name ?? "andere locatie"}`}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="icon" aria-label={`Onderlocatie toevoegen aan ${selectedLocation.name}`} title={`Onderlocatie toevoegen aan ${selectedLocation.name}`} onClick={() => openCreateForm(selectedLocation.id)}><Plus className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" aria-label={`Locatie bewerken: ${selectedLocation.name}`} title={`Locatie bewerken: ${selectedLocation.name}`} onClick={() => openEditForm(selectedLocation)}><Pencil className="h-4 w-4" /></Button>
                {!hasChildren(selectedLocation) && selectedLocation.service_id === null && <Button variant="destructive" size="icon" aria-label={`Locatie verwijderen: ${selectedLocation.name}`} title={`Locatie verwijderen: ${selectedLocation.name}`} onClick={() => void removeLocation(selectedLocation)} disabled={deleting}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bovenliggende locatie</dt><dd className="mt-1 text-sm">{selectedLocation.parent_id === null ? "Geen" : locations.find((location) => location.id === selectedLocation.parent_id)?.name ?? "Onbekend"}</dd></div>
              <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Onderlocaties</dt><dd className="mt-1 text-sm">{locations.filter((location) => location.parent_id === selectedLocation.id).length}</dd></div>
            </dl>
            {selectedLocation.kind === "post" ? <section aria-labelledby="location-overview-title" className="mt-6 border-t pt-5">
              <h4 id="location-overview-title" className="text-base font-semibold">CityGIS-overzicht</h4>
              {overviewLoading ? <p role="status" className="mt-3 text-sm text-muted-foreground">Postgegevens laden…</p>
                : overviewError ? <p role="alert" className="mt-3 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{overviewError}</p>
                  : overview?.service ? <>
                    <p className="mt-2 text-sm"><span className="font-medium">Dienst:</span> {overview.service.abbreviation}</p>
                    {overview.vectors.length ? <div className="mt-4 overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm" aria-label="CityGIS-vectoren">
                        <thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                          <th scope="col" className="px-3 py-2 font-medium">Vector</th>
                          <th scope="col" className="px-3 py-2 font-medium">Operationele status</th>
                          <th scope="col" className="px-3 py-2 font-medium">Gekoppeld voertuig</th>
                        </tr></thead>
                        <tbody>{overview.vectors.map((vector) => <tr key={vector.id} className="border-b last:border-0">
                          <td className="px-3 py-3 font-medium">{vector.abbreviation || vector.name || vector.vector_code}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{vector.vector_code}</span></td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-2 border px-2 py-1 text-xs font-medium">
                              <span role="img" aria-label={`Statuskleur: ${vector.status_description || vector.operational_status_code || "Onbekend"}`} className="h-3 w-3 border border-black/20" style={{ backgroundColor: vector.status_color ?? "#E5E7EB" }} />
                              {vector.operational_status_code || "?"} · {vector.status_description || "Onbekende status"}
                            </span>
                          </td>
                          <td className="px-3 py-3">{vector.vehicle ? `${vector.vehicle.alphacode} · ${vector.vehicle.plate || "Geen nummerplaat"}` : vector.source_vehicle_name || "Geen gekoppeld voertuig"}</td>
                        </tr>)}</tbody>
                      </table>
                    </div> : <p className="mt-3 text-sm text-muted-foreground">Geen vectors voor deze post.</p>}
                  </> : <>
                    <p className="mt-3 text-sm text-muted-foreground">Geen CityGIS-dienst gekoppeld</p>
                    <p className="mt-1 text-sm text-muted-foreground">Geen vectors voor deze post.</p>
                  </>}
            </section> : <p className="mt-5 border-t pt-4 text-sm text-muted-foreground">CityGIS-overzicht is alleen beschikbaar voor posten.</p>}
          </CardContent>
        </> : <CardContent><p className="text-sm text-muted-foreground">Selecteer een locatie of voeg een nieuwe toe.</p></CardContent>}
      </Card>
    </div>
  </div>;
}
