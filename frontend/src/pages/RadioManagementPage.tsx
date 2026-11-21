import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { RadioScanLookup } from "@/components/RadioScanLookup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type CityGISLocation, type CityGISSnapshot, type IssiAsset, type Organization, type RadioAsset, type RadioModel, type RadioRelationshipSnapshot, type RadioSubscription, type TeiRange } from "@/lib/api";

type RadioTab = "radios" | "issis" | "subscriptions";
type Application = RadioAsset["application"];
type SortDirection = "ascending" | "descending";
type RadioColumn = "tei" | "application" | "model" | "fireplan_id" | "issi";
type IssiColumn = "issi" | "alias" | "organization" | "radio";

const applicationLabels: Record<Application, string> = {
  portable: "Draagbaar",
  vehicle: "Voertuiggebonden",
  fixed: "Vast",
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "nl-BE", { numeric: true, sensitivity: "base" });
}

function subscriptionStatus(item: RadioSubscription): string {
  return item.ended_at ? "Beëindigd" : "Actief";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function relationshipLabel(
  entry: NonNullable<RadioRelationshipSnapshot["current"]>,
  catalogs: { citygis: CityGISSnapshot; locations: CityGISLocation[] } | null,
): string {
  if (entry.location) return entry.location.name;
  if (!entry.target) return "Geen plaatsing";
  const { id, kind } = entry.target;
  if (kind === "vector") {
    const vector = catalogs?.citygis.vectors.find((item) => item.managed_object.id === id);
    return vector ? `${vector.abbreviation || vector.name || vector.vector_code} · ${vector.post?.name ?? "Zonder post"}` : `Vector #${id}`;
  }
  if (kind === "vehicle") {
    const vehicle = catalogs?.citygis.vehicles.find((item) => item.managed_object.id === id);
    return vehicle ? `${vehicle.alphacode} · ${vehicle.plate}` : `Voertuig #${id}`;
  }
  return `Pager #${id}`;
}

export function RadioManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = Boolean(user?.is_staff);
  const [activeTab, setActiveTab] = useState<RadioTab>("radios");
  const [radios, setRadios] = useState<RadioAsset[]>([]);
  const [issis, setIssis] = useState<IssiAsset[]>([]);
  const [subscriptions, setSubscriptions] = useState<RadioSubscription[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [models, setModels] = useState<RadioModel[]>([]);
  const [ranges, setRanges] = useState<TeiRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [radioSort, setRadioSort] = useState<{ column: RadioColumn; direction: SortDirection }>({
    column: "tei", direction: "ascending",
  });
  const [issiSort, setIssiSort] = useState<{ column: IssiColumn; direction: SortDirection }>({
    column: "issi", direction: "ascending",
  });
  const [selectedRadioId, setSelectedRadioId] = useState<number | null>(null);
  const [selectedIssiId, setSelectedIssiId] = useState<number | null>(null);
  const [radioFormOpen, setRadioFormOpen] = useState(false);
  const [editingRadio, setEditingRadio] = useState<RadioAsset | null>(null);
  const [radioFormError, setRadioFormError] = useState("");
  const [radioForm, setRadioForm] = useState({
    tei: "", manufacturer: "", model_name: "", application: "portable" as Application, model_id: "",
  });
  const [issiFormOpen, setIssiFormOpen] = useState(false);
  const [editingIssi, setEditingIssi] = useState<IssiAsset | null>(null);
  const [issiFormError, setIssiFormError] = useState("");
  const [issiForm, setIssiForm] = useState({ issi: "", alias: "", organization_id: "" });
  const [assignmentForm, setAssignmentForm] = useState({ radio_id: "", issi_id: "" });
  const [assignmentError, setAssignmentError] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [organizationForm, setOrganizationForm] = useState({ id: 0, name: "" });
  const [modelForm, setModelForm] = useState({
    id: 0, manufacturer: "", name: "", application: "portable" as Application,
  });
  const [rangeForm, setRangeForm] = useState({ id: 0, model_id: "", start_tei: "", end_tei: "" });
  const [radioRelationship, setRadioRelationship] = useState<RadioRelationshipSnapshot | null>(null);
  const [relationshipCatalogs, setRelationshipCatalogs] = useState<{ citygis: CityGISSnapshot; locations: CityGISLocation[] } | null>(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipError, setRelationshipError] = useState("");
  const [relationshipTarget, setRelationshipTarget] = useState("");
  const [syncError, setSyncError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [radioRows, issiRows, subscriptionRows, organizationRows, modelRows, rangeRows] = await Promise.all([
        api.listRadios(), api.listIssis(), api.listRadioSubscriptions(), api.listOrganizations(),
        api.listRadioModels(), api.listTeiRanges(),
      ]);
      setRadios(radioRows);
      setIssis(issiRows);
      setSubscriptions(subscriptionRows);
      setOrganizations(organizationRows);
      setModels(modelRows);
      setRanges(rangeRows);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Radio-inventaris laden is niet gelukt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!selectedRadioId) {
      setRadioRelationship(null);
      return;
    }
    let active = true;
    setRelationshipLoading(true);
    setRelationshipError("");
    void Promise.all([api.getRadioRelationship(selectedRadioId), api.getCityGIS(), api.listLocations()])
      .then(([relationship, citygis, locations]) => {
        if (!active) return;
        setRadioRelationship(relationship);
        setRelationshipCatalogs({ citygis, locations });
        const current = relationship.current;
        setRelationshipTarget(current?.location ? `location:${current.location.id}` : current?.target ? `object:${current.target.id}` : "");
      })
      .catch((reason: unknown) => {
        if (active) setRelationshipError(reason instanceof Error ? reason.message : "Plaatsingsgegevens laden is niet gelukt.");
      })
      .finally(() => { if (active) setRelationshipLoading(false); });
    return () => { active = false; };
  }, [selectedRadioId]);

  const visibleRadios = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    const rows = radios.filter((radio) => {
      const active = radio.current_subscription;
      const searchable = [
        radio.tei, radio.manufacturer, radio.model_name, radio.model?.manufacturer, radio.model?.name,
        String(radio.fireplan_id ?? ""), radio.fireplan_qr_url, active?.issi.issi, active?.issi.alias,
      ].join(" ").toLocaleLowerCase("nl-BE");
      return !needle || searchable.includes(needle);
    });
    const direction = radioSort.direction === "ascending" ? 1 : -1;
    return rows.sort((left, right) => {
      const value = (radio: RadioAsset) => {
        switch (radioSort.column) {
          case "tei": return radio.tei;
          case "application": return applicationLabels[radio.application];
          case "model": return `${radio.model?.manufacturer ?? radio.manufacturer} ${radio.model?.name ?? radio.model_name}`;
          case "fireplan_id": return String(radio.fireplan_id ?? "");
          case "issi": return radio.current_subscription?.issi.issi ?? "";
        }
      };
      return compareText(value(left), value(right)) * direction || left.id - right.id;
    });
  }, [query, radioSort, radios]);

  const visibleIssis = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    const rows = issis.filter((item) => {
      const active = item.current_subscription;
      const searchable = [item.issi, item.alias, item.organization?.name, active?.radio.tei]
        .join(" ").toLocaleLowerCase("nl-BE");
      return !needle || searchable.includes(needle);
    });
    const direction = issiSort.direction === "ascending" ? 1 : -1;
    return rows.sort((left, right) => {
      const value = (item: IssiAsset) => {
        switch (issiSort.column) {
          case "issi": return item.issi;
          case "alias": return item.alias;
          case "organization": return item.organization?.name ?? "";
          case "radio": return item.current_subscription?.radio.tei ?? "";
        }
      };
      return compareText(value(left), value(right)) * direction || left.id - right.id;
    });
  }, [issiSort, issis, query]);

  const selectedRadio = radios.find((radio) => radio.id === selectedRadioId) ?? null;
  const selectedIssi = issis.find((item) => item.id === selectedIssiId) ?? null;

  function toggleRadioSort(column: RadioColumn) {
    setRadioSort((current) => ({
      column,
      direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
    }));
  }

  function toggleIssiSort(column: IssiColumn) {
    setIssiSort((current) => ({
      column,
      direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
    }));
  }

  function openRadioForm(radio: RadioAsset | null = null) {
    setEditingRadio(radio);
    setRadioFormError("");
    setRadioForm(radio ? {
      tei: radio.tei,
      manufacturer: radio.manufacturer,
      model_name: radio.model_name,
      application: radio.application,
      model_id: radio.model?.id ? String(radio.model.id) : "",
    } : { tei: "", manufacturer: "", model_name: "", application: "portable", model_id: "" });
    setRadioFormOpen(true);
  }

  async function saveRadio(event: FormEvent) {
    event.preventDefault();
    setRadioFormError("");
    const values = {
      tei: radioForm.tei,
      manufacturer: radioForm.manufacturer,
      model_name: radioForm.model_name,
      application: radioForm.application,
      ...(radioForm.model_id ? { model_id: Number(radioForm.model_id) } : {}),
    };
    try {
      if (editingRadio) await api.updateRadio(editingRadio.id, values);
      else await api.createRadio(values);
      setRadioFormOpen(false);
      setEditingRadio(null);
      toast.success(editingRadio ? "Radio bijgewerkt." : "Radio toegevoegd.");
      await refresh();
    } catch (reason) {
      setRadioFormError(reason instanceof Error ? reason.message : "Radio opslaan is niet gelukt.");
    }
  }

  async function removeRadio(radio: RadioAsset) {
    if (!window.confirm(`Radio ${radio.tei} verwijderen?`)) return;
    try {
      await api.deleteRadio(radio.id);
      if (selectedRadioId === radio.id) setSelectedRadioId(null);
      toast.success("Radio verwijderd.");
      await refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Radio verwijderen is niet gelukt.");
    }
  }

  async function startRadioSync() {
    setSyncError("");
    try {
      const task = await api.startFireplanRadioSync();
      window.localStorage.setItem("activeFireplanSyncId", task.task_id);
      window.dispatchEvent(new Event("fireplan-sync-task-change"));
      navigate(`/tasks/${encodeURIComponent(task.task_id)}`);
    } catch (reason) {
      setSyncError(reason instanceof Error ? reason.message : "Radiosynchronisatie starten is niet gelukt.");
    }
  }

  async function saveRadioRelationship(event: FormEvent) {
    event.preventDefault();
    if (!selectedRadio) return;
    setRelationshipError("");
    const kind = selectedRadio.application === "portable" ? "assigned_to" : selectedRadio.application === "vehicle" ? "mounted_in" : "installed_in";
    const locationId = relationshipTarget.startsWith("location:") ? Number(relationshipTarget.slice("location:".length)) : null;
    const objectId = relationshipTarget.startsWith("object:") ? Number(relationshipTarget.slice("object:".length)) : null;
    try {
      const updated = await api.updateRadioRelationship(selectedRadio.id, {
        kind, target_object_id: objectId, location_id: locationId,
      });
      setRadioRelationship(updated);
      const current = updated.current;
      setRelationshipTarget(current?.location ? `location:${current.location.id}` : current?.target ? `object:${current.target.id}` : "");
      await refresh();
      toast.success("Radio-plaatsing bijgewerkt.");
    } catch (reason) {
      setRelationshipError(reason instanceof Error ? reason.message : "Radio-plaatsing opslaan is niet gelukt.");
    }
  }

  function openIssiForm(item: IssiAsset | null = null) {
    setEditingIssi(item);
    setIssiFormError("");
    setIssiForm(item ? {
      issi: item.issi, alias: item.alias, organization_id: item.organization?.id ? String(item.organization.id) : "",
    } : { issi: "", alias: "", organization_id: "" });
    setIssiFormOpen(true);
  }

  async function saveIssi(event: FormEvent) {
    event.preventDefault();
    setIssiFormError("");
    const values = {
      issi: issiForm.issi,
      alias: issiForm.alias,
      organization_id: issiForm.organization_id ? Number(issiForm.organization_id) : null,
    };
    try {
      if (editingIssi) await api.updateIssi(editingIssi.id, values);
      else await api.createIssi(values);
      setIssiFormOpen(false);
      setEditingIssi(null);
      toast.success(editingIssi ? "ISSI bijgewerkt." : "ISSI toegevoegd.");
      await refresh();
    } catch (reason) {
      setIssiFormError(reason instanceof Error ? reason.message : "ISSI opslaan is niet gelukt.");
    }
  }

  async function removeIssi(item: IssiAsset) {
    if (!window.confirm(`ISSI ${item.issi} verwijderen?`)) return;
    try {
      await api.deleteIssi(item.id);
      if (selectedIssiId === item.id) setSelectedIssiId(null);
      toast.success("ISSI verwijderd.");
      await refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "ISSI verwijderen is niet gelukt.");
    }
  }

  async function assignSubscription(event: FormEvent) {
    event.preventDefault();
    setAssignmentError("");
    try {
      await api.assignRadioSubscription(Number(assignmentForm.radio_id), Number(assignmentForm.issi_id));
      setAssignmentForm({ radio_id: "", issi_id: "" });
      toast.success("Abonnement bijgewerkt.");
      await refresh();
    } catch (reason) {
      setAssignmentError(reason instanceof Error ? reason.message : "Abonnement wijzigen is niet gelukt.");
    }
  }

  async function saveOrganization(event: FormEvent) {
    event.preventDefault();
    setReferenceError("");
    try {
      if (organizationForm.id) await api.updateOrganization(organizationForm.id, { name: organizationForm.name });
      else await api.createOrganization({ name: organizationForm.name });
      setOrganizationForm({ id: 0, name: "" });
      await refresh();
    } catch (reason) {
      setReferenceError(reason instanceof Error ? reason.message : "Organisatie opslaan is niet gelukt.");
    }
  }

  async function saveModel(event: FormEvent) {
    event.preventDefault();
    setReferenceError("");
    const values = { manufacturer: modelForm.manufacturer, name: modelForm.name, application: modelForm.application };
    try {
      if (modelForm.id) await api.updateRadioModel(modelForm.id, values);
      else await api.createRadioModel(values);
      setModelForm({ id: 0, manufacturer: "", name: "", application: "portable" });
      await refresh();
    } catch (reason) {
      setReferenceError(reason instanceof Error ? reason.message : "Radiomodel opslaan is niet gelukt.");
    }
  }

  async function saveRange(event: FormEvent) {
    event.preventDefault();
    setReferenceError("");
    const values = {
      model_id: Number(rangeForm.model_id), start_tei: rangeForm.start_tei, end_tei: rangeForm.end_tei,
    };
    try {
      if (rangeForm.id) await api.updateTeiRange(rangeForm.id, values);
      else await api.createTeiRange(values);
      setRangeForm({ id: 0, model_id: "", start_tei: "", end_tei: "" });
      await refresh();
    } catch (reason) {
      setReferenceError(reason instanceof Error ? reason.message : "TEI-bereik opslaan is niet gelukt.");
    }
  }

  async function removeReference(kind: "organization" | "model" | "range", id: number) {
    if (!window.confirm("Deze referentie verwijderen?")) return;
    try {
      if (kind === "organization") await api.deleteOrganization(id);
      if (kind === "model") await api.deleteRadioModel(id);
      if (kind === "range") await api.deleteTeiRange(id);
      await refresh();
    } catch (reason) {
      setReferenceError(reason instanceof Error ? reason.message : "Referentie verwijderen is niet gelukt.");
    }
  }

  function sortedHeader(label: string, column: string, active: boolean, direction: SortDirection | null, onClick: () => void) {
    const icon = active ? (direction === "ascending" ? "↑" : "↓") : "↕";
    return <th key={column} scope="col" aria-sort={active ? direction ?? undefined : undefined} className="px-3 py-2.5 align-middle font-normal">
      <button type="button" className="inline-flex items-center gap-2 whitespace-nowrap font-medium" aria-label={`Sorteer op ${label.toLocaleLowerCase("nl-BE")}`} onClick={onClick}>
        {label}<span aria-hidden="true" className="text-muted-foreground">{icon}</span>
      </button>
    </th>;
  }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Radio-inventaris laden…</p>;
  if (loadError) return <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{loadError}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Assetbeheer</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Radio's</h1>
        <p className="mt-2 text-sm text-muted-foreground">Radio's, ISSI's, abonnementen en configureerbare TEI-modelbereiken.</p>
      </div>

      <div role="tablist" aria-label="Radiobeheer" className="flex flex-wrap gap-2 border-b">
        {([["radios", "Radio's"], ["issis", "ISSI's"], ["subscriptions", "Abonnementen"]] as const).map(([tab, label]) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={`border-b-2 px-4 py-2.5 text-sm ${activeTab === tab ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`} onClick={() => { setActiveTab(tab); setQuery(""); }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab !== "subscriptions" && <label className="block max-w-md space-y-1 text-sm font-medium" htmlFor="radio-module-search">
        <span>{activeTab === "radios" ? "Radio's zoeken" : "ISSI's zoeken"}</span>
        <Input id="radio-module-search" type="search" role="searchbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeTab === "radios" ? "TEI, model, FirePlan-ID of ISSI" : "ISSI, alias, organisatie of radio"} />
      </label>}

      {activeTab === "radios" && <div className="flex flex-wrap items-start justify-between gap-4 border p-4">
        <RadioScanLookup onRadioIdentified={(radio) => setSelectedRadioId(radio.id)} />
        {isStaff && <div className="space-y-2">
          <Button type="button" onClick={() => void startRadioSync()}>Synchroniseer radio's met FirePlan</Button>
          {syncError && <p role="alert" className="text-sm text-red-700">{syncError}</p>}
        </div>}
      </div>}

      {activeTab === "radios" && <Card>
        <CardHeader className="flex-col items-stretch gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Radio's</CardTitle><CardDescription>{radios.length} geregistreerd</CardDescription></div>
          {isStaff && <Button type="button" onClick={() => openRadioForm()}><Plus className="h-4 w-4" />Radio toevoegen</Button>}
        </CardHeader>
        <CardContent className="p-0">
          {radios.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
            <colgroup><col className="w-[18%]" /><col className="w-[17%]" /><col className="w-[27%]" /><col className="w-[16%]" /><col className="w-[22%]" /></colgroup>
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
              {sortedHeader("TEI", "tei", radioSort.column === "tei", radioSort.direction, () => toggleRadioSort("tei"))}
              {sortedHeader("Toepassing", "application", radioSort.column === "application", radioSort.direction, () => toggleRadioSort("application"))}
              {sortedHeader("Model", "model", radioSort.column === "model", radioSort.direction, () => toggleRadioSort("model"))}
              {sortedHeader("FirePlan-ID", "fireplan_id", radioSort.column === "fireplan_id", radioSort.direction, () => toggleRadioSort("fireplan_id"))}
              <th scope="col" className="px-3 py-2.5 align-middle font-normal">ISSI · Acties</th>
            </tr></thead>
            <tbody className="divide-y">
              {visibleRadios.map((radio) => <tr key={radio.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-mono"><button type="button" className="text-left hover:underline" aria-label={`Details radio ${radio.tei}`} onClick={() => setSelectedRadioId(selectedRadioId === radio.id ? null : radio.id)}>{radio.tei}</button></td>
                <td className="px-3 py-2.5">{applicationLabels[radio.application]}</td>
                <td className="px-3 py-2.5">{radio.model ? `${radio.model.manufacturer} ${radio.model.name}` : radio.model_name || radio.manufacturer || "Model onbekend"}</td>
                <td className="px-3 py-2.5">{radio.fireplan_id ?? "—"}</td>
                <td className="px-3 py-2.5"><div className="flex items-center justify-between gap-2"><span>{radio.current_subscription?.issi.issi ?? "Geen ISSI"}</span><span className="inline-flex shrink-0 gap-1">
                  {isStaff && <>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Bewerk radio ${radio.tei}`} title={`Bewerk radio ${radio.tei}`} onClick={() => openRadioForm(radio)}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Verwijder radio ${radio.tei}`} title={`Verwijder radio ${radio.tei}`} onClick={() => void removeRadio(radio)}><Trash2 className="h-4 w-4 text-red-700" /></Button>
                  </>}
                </span></div></td>
              </tr>)}
              {!visibleRadios.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Geen radio's gevonden.</td></tr>}
            </tbody>
          </table></div>}
          {radios.length === 0 && <p className="p-8 text-sm text-muted-foreground">Nog geen radio's geregistreerd.</p>}
          {selectedRadio && <div className="border-t p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Radio {selectedRadio.tei}</h2>
              <Button type="button" size="icon" variant="ghost" aria-label="Sluit radio details" title="Sluit radio details" onClick={() => setSelectedRadioId(null)}><X className="h-4 w-4" /></Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">FirePlan-ID: {selectedRadio.fireplan_id ?? "—"}{selectedRadio.fireplan_qr_url ? <> · QR: <a className="underline" href={selectedRadio.fireplan_qr_url} target="_blank" rel="noreferrer">open bron-QR</a></> : ""}</p>
            <h3 className="mt-4 font-medium">Abonnementshistoriek</h3>
            {selectedRadio.subscription_history?.length ? <ol className="mt-3 space-y-2">{selectedRadio.subscription_history.map((item) => <li key={item.id} className="border bg-white p-3 text-sm"><span className="font-medium">{item.issi.issi} · {item.issi.alias}</span><span className="ml-2 text-muted-foreground">{item.ended_at ? "Beëindigd" : "Actief"}</span><span className="mt-1 block text-xs text-muted-foreground">{formatDate(item.started_at)} – {formatDate(item.ended_at)}</span></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">Geen abonnementshistoriek.</p>}
            <section aria-label="Radio plaatsing" className="mt-5 space-y-3">
              <h3 className="font-medium">Plaatsing</h3>
              {relationshipLoading && <p role="status" className="text-sm text-muted-foreground">Plaatsingshistoriek laden…</p>}
              {relationshipError && <p role="alert" className="text-sm text-red-700">{relationshipError}</p>}
              {radioRelationship && <>
                <p className="text-sm">Huidige bestemming: {radioRelationship.current ? relationshipLabel(radioRelationship.current, relationshipCatalogs) : "Geen plaatsing"}</p>
                {isStaff && relationshipCatalogs && <form onSubmit={(event) => void saveRadioRelationship(event)} className="flex flex-wrap items-end gap-2">
                  <label className="min-w-64 flex-1 space-y-1 text-sm font-medium" htmlFor="radio-placement-target">{selectedRadio.application === "portable" ? "Vector" : selectedRadio.application === "vehicle" ? "Voertuig" : "Locatie"}
                    <select id="radio-placement-target" className="flex h-10 w-full border bg-white px-3 text-sm" value={relationshipTarget} onChange={(event) => setRelationshipTarget(event.target.value)}>
                      <option value="">Geen plaatsing</option>
                      {selectedRadio.application === "portable" && relationshipCatalogs.citygis.vectors.filter((item) => item.is_current).map((item) => <option key={item.managed_object.id} value={`object:${item.managed_object.id}`}>{item.abbreviation || item.name || item.vector_code} · {item.post?.name ?? "Zonder post"}</option>)}
                      {selectedRadio.application === "vehicle" && relationshipCatalogs.citygis.vehicles.filter((item) => item.is_current).map((item) => <option key={item.managed_object.id} value={`object:${item.managed_object.id}`}>{item.alphacode} · {item.plate}</option>)}
                      {selectedRadio.application === "fixed" && relationshipCatalogs.locations.map((item) => <option key={item.id} value={`location:${item.id}`}>{item.name}</option>)}
                    </select>
                  </label>
                  <Button type="submit">Plaatsing bewaren</Button>
                </form>}
                <h4 className="text-sm font-medium">Plaatsingshistoriek</h4>
                {radioRelationship.history.length ? <ul className="space-y-1 text-sm text-muted-foreground">{radioRelationship.history.map((item) => <li key={item.id}>{relationshipLabel(item, relationshipCatalogs)} · {formatDate(item.started_at)} – {item.ended_at ? formatDate(item.ended_at) : "Actueel"}</li>)}</ul> : <p className="text-sm text-muted-foreground">Geen plaatsingshistoriek.</p>}
              </>}
            </section>
          </div>}
          {radioFormOpen && <form onSubmit={(event) => void saveRadio(event)} className="grid gap-3 border-t p-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold sm:col-span-2">{editingRadio ? "Radio bewerken" : "Radio toevoegen"}</h2>
            <label className="space-y-1 text-sm font-medium" htmlFor="radio-tei">TEI<Input id="radio-tei" required maxLength={15} value={radioForm.tei} onChange={(event) => setRadioForm({ ...radioForm, tei: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="radio-application">Radio toepassing<select id="radio-application" className="flex h-10 w-full border bg-white px-3 text-sm" value={radioForm.application} onChange={(event) => setRadioForm({ ...radioForm, application: event.target.value as Application })}><option value="portable">Draagbaar</option><option value="vehicle">Voertuiggebonden</option><option value="fixed">Vast</option></select></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="radio-manufacturer">Fabrikant<Input id="radio-manufacturer" value={radioForm.manufacturer} onChange={(event) => setRadioForm({ ...radioForm, manufacturer: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="radio-model-name">Modelnaam<Input id="radio-model-name" value={radioForm.model_name} onChange={(event) => setRadioForm({ ...radioForm, model_name: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2" htmlFor="radio-model-reference">TEI-modelreferentie<select id="radio-model-reference" className="flex h-10 w-full border bg-white px-3 text-sm" value={radioForm.model_id} onChange={(event) => setRadioForm({ ...radioForm, model_id: event.target.value })}><option value="">Automatisch op TEI-bereik</option>{models.filter((model) => model.application === radioForm.application).map((model) => <option key={model.id} value={model.id}>{model.manufacturer} {model.name}</option>)}</select></label>
            {radioFormError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{radioFormError}</p>}
            <div className="flex gap-2 sm:col-span-2"><Button type="submit">Radio opslaan</Button><Button type="button" variant="outline" onClick={() => setRadioFormOpen(false)}>Annuleren</Button></div>
          </form>}
        </CardContent>
      </Card>}

      {activeTab === "issis" && <Card>
        <CardHeader className="flex-col items-stretch gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>ISSI's</CardTitle><CardDescription>{issis.length} geregistreerd</CardDescription></div>
          {isStaff && <Button type="button" onClick={() => openIssiForm()}><Plus className="h-4 w-4" />ISSI toevoegen</Button>}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] table-fixed border-collapse text-left text-sm">
            <colgroup><col className="w-[22%]" /><col className="w-[27%]" /><col className="w-[28%]" /><col className="w-[23%]" /></colgroup>
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
              {sortedHeader("ISSI", "issi", issiSort.column === "issi", issiSort.direction, () => toggleIssiSort("issi"))}
              {sortedHeader("Alias", "alias", issiSort.column === "alias", issiSort.direction, () => toggleIssiSort("alias"))}
              {sortedHeader("Organisatie", "organization", issiSort.column === "organization", issiSort.direction, () => toggleIssiSort("organization"))}
              <th scope="col" className="px-3 py-2.5 align-middle font-normal">Radio · Acties</th>
            </tr></thead>
            <tbody className="divide-y">
              {visibleIssis.map((item) => <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-mono"><button type="button" className="text-left hover:underline" aria-label={`Details ISSI ${item.issi}`} onClick={() => setSelectedIssiId(selectedIssiId === item.id ? null : item.id)}>{item.issi}</button></td>
                <td className="px-3 py-2.5">{item.alias}</td><td className="px-3 py-2.5">{item.organization?.name ?? "—"}</td>
                <td className="px-3 py-2.5"><div className="flex items-center justify-between gap-2"><span>{item.current_subscription?.radio.tei ?? "Geen radio"}</span><span className="inline-flex shrink-0 gap-1">{isStaff && <>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Bewerk ISSI ${item.issi}`} title={`Bewerk ISSI ${item.issi}`} onClick={() => openIssiForm(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Verwijder ISSI ${item.issi}`} title={`Verwijder ISSI ${item.issi}`} onClick={() => void removeIssi(item)}><Trash2 className="h-4 w-4 text-red-700" /></Button>
                </>}</span></div></td>
              </tr>)}
              {!visibleIssis.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Geen ISSI's gevonden.</td></tr>}
            </tbody>
          </table></div>
          {selectedIssi && <HistoryPanel title={`ISSI ${selectedIssi.issi}`} history={selectedIssi.subscription_history ?? []} onClose={() => setSelectedIssiId(null)} />}
          {issiFormOpen && <form onSubmit={(event) => void saveIssi(event)} className="grid gap-3 border-t p-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold sm:col-span-2">{editingIssi ? "ISSI bewerken" : "ISSI toevoegen"}</h2>
            <label className="space-y-1 text-sm font-medium" htmlFor="issi-number">ISSI<Input id="issi-number" required maxLength={20} value={issiForm.issi} onChange={(event) => setIssiForm({ ...issiForm, issi: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="issi-alias">Alias<Input id="issi-alias" required maxLength={120} value={issiForm.alias} onChange={(event) => setIssiForm({ ...issiForm, alias: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2" htmlFor="issi-organization">Organisatie<select id="issi-organization" className="flex h-10 w-full border bg-white px-3 text-sm" value={issiForm.organization_id} onChange={(event) => setIssiForm({ ...issiForm, organization_id: event.target.value })}><option value="">Geen organisatie</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            {issiFormError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{issiFormError}</p>}
            <div className="flex gap-2 sm:col-span-2"><Button type="submit">ISSI opslaan</Button><Button type="button" variant="outline" onClick={() => setIssiFormOpen(false)}>Annuleren</Button></div>
          </form>}
        </CardContent>
      </Card>}

      {activeTab === "subscriptions" && <Card>
        <CardHeader><CardTitle>Abonnementen</CardTitle><CardDescription>Actuele en beëindigde radio-ISSI-koppelingen</CardDescription></CardHeader>
        {isStaff && <form onSubmit={(event) => void assignSubscription(event)} className="grid gap-3 border-y p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-1 text-sm font-medium" htmlFor="subscription-radio">Radio<select id="subscription-radio" required className="flex h-10 w-full border bg-white px-3 text-sm" value={assignmentForm.radio_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, radio_id: event.target.value })}><option value="">Kies een radio</option>{radios.map((radio) => <option key={radio.id} value={radio.id}>{radio.tei}</option>)}</select></label>
          <label className="space-y-1 text-sm font-medium" htmlFor="subscription-issi">ISSI<select id="subscription-issi" required className="flex h-10 w-full border bg-white px-3 text-sm" value={assignmentForm.issi_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, issi_id: event.target.value })}><option value="">Kies een ISSI</option>{issis.map((item) => <option key={item.id} value={item.id}>{item.issi} · {item.alias}</option>)}</select></label>
          <Button type="submit" className="self-end">Koppeling bevestigen</Button>
          {assignmentError && <p role="alert" className="text-sm text-red-700 sm:col-span-3">{assignmentError}</p>}
        </form>}
        <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
          <colgroup><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[17%]" /><col className="w-[17%]" /></colgroup>
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th scope="col" className="px-3 py-2.5 font-normal">Radio</th><th scope="col" className="px-3 py-2.5 font-normal">ISSI</th><th scope="col" className="px-3 py-2.5 font-normal">Alias</th><th scope="col" className="px-3 py-2.5 font-normal">Status</th><th scope="col" className="px-3 py-2.5 font-normal">Start / einde</th></tr></thead>
          <tbody className="divide-y">{subscriptions.map((item) => <tr key={item.id}><td className="px-3 py-2.5 font-mono">{item.radio.tei}</td><td className="px-3 py-2.5 font-mono">{item.issi.issi}</td><td className="px-3 py-2.5">{item.issi.alias}</td><td className="px-3 py-2.5">{subscriptionStatus(item)}</td><td className="px-3 py-2.5">{formatDate(item.started_at)}<span className="block text-xs text-muted-foreground">{formatDate(item.ended_at)}</span></td></tr>)}
            {!subscriptions.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nog geen abonnementen geregistreerd.</td></tr>}</tbody>
        </table></div></CardContent>
      </Card>}

      {activeTab === "radios" && isStaff && <ReferenceManagement
        organizations={organizations} models={models} ranges={ranges}
        organizationForm={organizationForm} setOrganizationForm={setOrganizationForm} onSaveOrganization={saveOrganization}
        modelForm={modelForm} setModelForm={setModelForm} onSaveModel={saveModel}
        rangeForm={rangeForm} setRangeForm={setRangeForm} onSaveRange={saveRange}
        onRemove={removeReference} error={referenceError}
      />}
    </div>
  );
}

function HistoryPanel({ title, history, onClose }: { title: string; history: RadioSubscription[]; onClose: () => void }) {
  return <section className="border-t bg-muted/20 p-4" aria-label={`${title} details`}>
    <div className="flex items-center justify-between"><div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Abonnementshistoriek</p></div><Button type="button" variant="ghost" size="icon" aria-label="Details sluiten" title="Details sluiten" onClick={onClose}><X className="h-4 w-4" /></Button></div>
    {!history.length ? <p className="mt-3 text-sm text-muted-foreground">Geen abonnementshistoriek.</p> : <ol className="mt-3 space-y-2">{history.map((item) => <li key={item.id} className="border bg-white p-3 text-sm"><span className="font-medium">{item.issi.issi} · {item.issi.alias}</span><span className="ml-2 text-muted-foreground">{item.ended_at ? "Beëindigd" : "Actief"}</span><span className="mt-1 block text-xs text-muted-foreground">{formatDate(item.started_at)} – {formatDate(item.ended_at)}</span></li>)}</ol>}
  </section>;
}

function ReferenceManagement({
  organizations, models, ranges, organizationForm, setOrganizationForm, onSaveOrganization,
  modelForm, setModelForm, onSaveModel, rangeForm, setRangeForm, onSaveRange, onRemove, error,
}: {
  organizations: Organization[];
  models: RadioModel[];
  ranges: TeiRange[];
  organizationForm: { id: number; name: string };
  setOrganizationForm: (value: { id: number; name: string }) => void;
  onSaveOrganization: (event: FormEvent) => void;
  modelForm: { id: number; manufacturer: string; name: string; application: Application };
  setModelForm: (value: { id: number; manufacturer: string; name: string; application: Application }) => void;
  onSaveModel: (event: FormEvent) => void;
  rangeForm: { id: number; model_id: string; start_tei: string; end_tei: string };
  setRangeForm: (value: { id: number; model_id: string; start_tei: string; end_tei: string }) => void;
  onSaveRange: (event: FormEvent) => void;
  onRemove: (kind: "organization" | "model" | "range", id: number) => void;
  error: string;
}) {
  return <details className="border bg-white">
    <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Organisaties, radiomodellen en TEI-bereiken beheren</summary>
    <div className="grid gap-6 border-t p-4 xl:grid-cols-3">
      <section className="space-y-3"><h2 className="font-semibold">Organisaties</h2><form onSubmit={(event) => void onSaveOrganization(event)} className="flex gap-2"><label className="sr-only" htmlFor="organization-name">Organisatienaam</label><Input id="organization-name" required value={organizationForm.name} onChange={(event) => setOrganizationForm({ ...organizationForm, name: event.target.value })} placeholder="Organisatienaam" /><Button type="submit">{organizationForm.id ? "Bewaren" : "Toevoegen"}</Button></form>
        <ul className="divide-y border text-sm">{organizations.map((item) => <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2"><span>{item.name}</span><span className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Bewerk organisatie ${item.name}`} title={`Bewerk organisatie ${item.name}`} onClick={() => setOrganizationForm({ id: item.id, name: item.name })}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Verwijder organisatie ${item.name}`} title={`Verwijder organisatie ${item.name}`} onClick={() => onRemove("organization", item.id)}><Trash2 className="h-4 w-4 text-red-700" /></Button></span></li>)}</ul>
      </section>
      <section className="space-y-3"><h2 className="font-semibold">Radiomodellen</h2><form onSubmit={(event) => void onSaveModel(event)} className="grid gap-2"><label className="sr-only" htmlFor="model-manufacturer">Fabrikant</label><Input id="model-manufacturer" required value={modelForm.manufacturer} onChange={(event) => setModelForm({ ...modelForm, manufacturer: event.target.value })} placeholder="Fabrikant" /><label className="sr-only" htmlFor="model-name">Modelnaam</label><Input id="model-name" required value={modelForm.name} onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })} placeholder="Modelnaam" /><label className="sr-only" htmlFor="model-application">Toepassing</label><select id="model-application" className="flex h-10 border bg-white px-3 text-sm" value={modelForm.application} onChange={(event) => setModelForm({ ...modelForm, application: event.target.value as Application })}><option value="portable">Draagbaar</option><option value="vehicle">Voertuiggebonden</option><option value="fixed">Vast</option></select><Button type="submit">{modelForm.id ? "Model bewaren" : "Model toevoegen"}</Button></form>
        <ul className="divide-y border text-sm">{models.map((item) => <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2"><span>{item.manufacturer} {item.name} · {applicationLabels[item.application]}</span><span className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Bewerk model ${item.name}`} title={`Bewerk model ${item.name}`} onClick={() => setModelForm({ id: item.id, manufacturer: item.manufacturer, name: item.name, application: item.application })}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Verwijder model ${item.name}`} title={`Verwijder model ${item.name}`} onClick={() => onRemove("model", item.id)}><Trash2 className="h-4 w-4 text-red-700" /></Button></span></li>)}</ul>
      </section>
      <section className="space-y-3"><h2 className="font-semibold">TEI-bereiken</h2><form onSubmit={(event) => void onSaveRange(event)} className="grid gap-2"><label className="sr-only" htmlFor="range-model">Radiomodel</label><select id="range-model" required className="flex h-10 border bg-white px-3 text-sm" value={rangeForm.model_id} onChange={(event) => setRangeForm({ ...rangeForm, model_id: event.target.value })}><option value="">Kies model</option>{models.map((item) => <option key={item.id} value={item.id}>{item.manufacturer} {item.name}</option>)}</select><label className="sr-only" htmlFor="range-start">Eerste TEI</label><Input id="range-start" required maxLength={15} value={rangeForm.start_tei} onChange={(event) => setRangeForm({ ...rangeForm, start_tei: event.target.value })} placeholder="Eerste TEI" /><label className="sr-only" htmlFor="range-end">Laatste TEI</label><Input id="range-end" required maxLength={15} value={rangeForm.end_tei} onChange={(event) => setRangeForm({ ...rangeForm, end_tei: event.target.value })} placeholder="Laatste TEI" /><Button type="submit">{rangeForm.id ? "Bereik bewaren" : "Bereik toevoegen"}</Button></form>
        <ul className="divide-y border text-sm">{ranges.map((item) => <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2"><span className="min-w-0"><span className="block truncate">{item.model.manufacturer} {item.model.name}</span><span className="block font-mono text-xs text-muted-foreground">{item.start_tei} – {item.end_tei}</span></span><span className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Bewerk TEI-bereik ${item.start_tei}`} title={`Bewerk TEI-bereik ${item.start_tei}`} onClick={() => setRangeForm({ id: item.id, model_id: String(item.model.id), start_tei: item.start_tei, end_tei: item.end_tei })}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Verwijder TEI-bereik ${item.start_tei}`} title={`Verwijder TEI-bereik ${item.start_tei}`} onClick={() => onRemove("range", item.id)}><Trash2 className="h-4 w-4 text-red-700" /></Button></span></li>)}</ul>
      </section>
      {error && <p role="alert" className="text-sm text-red-700 xl:col-span-3">{error}</p>}
    </div>
  </details>;
}
