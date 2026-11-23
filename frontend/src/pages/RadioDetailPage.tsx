import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type CityGISLocation, type CityGISSnapshot, type FireplanRadioInventory, type FireplanRadioInventoryPage, type RadioAsset, type RadioRelationshipEntry, type RadioRelationshipSnapshot } from "@/lib/api";

const INVENTORY_PAGE_SIZE = 10;

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

function RadioField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="break-words text-sm">{children || "—"}</dd></div>;
}

function InventoryHistoryRow({ inventory }: { inventory: FireplanRadioInventory }) {
  const description = [inventory.vehicle?.alphacode, inventory.vector?.vector_code, inventory.vector?.name]
    .filter(Boolean)
    .join(" · ");
  const date = formatDate(inventory.source_closed_at);
  return <div className="flex items-center justify-between gap-3 border px-3 py-2.5">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Link className="font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/fireplan/inventories/${encodeURIComponent(inventory.uuid)}`}>{date}</Link>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{description || "Geen voertuig- of vectorinformatie"}</p>
    </div>
    <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
  </div>;
}

export function RadioDetailPage() {
  const { radioId = "" } = useParams();
  const { user } = useAuth();
  const isStaff = Boolean(user?.is_staff);
  const [radio, setRadio] = useState<RadioAsset | null>(null);
  const [radioLoading, setRadioLoading] = useState(true);
  const [radioError, setRadioError] = useState("");
  const [relationship, setRelationship] = useState<RadioRelationshipSnapshot | null>(null);
  const [catalogs, setCatalogs] = useState<{ citygis: CityGISSnapshot; locations: CityGISLocation[] } | null>(null);
  const [relationshipLoading, setRelationshipLoading] = useState(true);
  const [relationshipError, setRelationshipError] = useState("");
  const [target, setTarget] = useState("");
  const [inventoryPage, setInventoryPage] = useState<FireplanRadioInventoryPage | null>(null);
  const [latestInventory, setLatestInventory] = useState<FireplanRadioInventory | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryExpanded, setInventoryExpanded] = useState(false);
  const [inventoryPageNumber, setInventoryPageNumber] = useState(1);
  const [subscriptionHistoryExpanded, setSubscriptionHistoryExpanded] = useState(false);

  const refreshRadio = useCallback(async () => {
    setRadioLoading(true);
    setRadioError("");
    try {
      setRadio(await api.getRadio(Number(radioId)));
    } catch (reason) {
      setRadioError(reason instanceof Error ? reason.message : "Radiogegevens laden is niet gelukt.");
    } finally {
      setRadioLoading(false);
    }
  }, [radioId]);

  useEffect(() => { void refreshRadio(); }, [refreshRadio]);

  useEffect(() => {
    let active = true;
    setInventoryLoading(true);
    setInventoryError("");
    void api.getRadioFireplanInventories(Number(radioId), inventoryPageNumber, INVENTORY_PAGE_SIZE)
      .then((result) => {
        if (!active) return;
        setInventoryPage(result);
        if (inventoryPageNumber === 1) setLatestInventory(result.results[0] ?? null);
      })
      .catch((reason: unknown) => {
        if (active) setInventoryError(reason instanceof Error ? reason.message : "Inventarissen laden is niet gelukt.");
      })
      .finally(() => { if (active) setInventoryLoading(false); });
    return () => { active = false; };
  }, [radioId, inventoryPageNumber]);

  useEffect(() => {
    let active = true;
    setRelationshipLoading(true);
    setRelationshipError("");
    void Promise.all([api.getRadioRelationship(Number(radioId)), api.getCityGIS(), api.listLocations()])
      .then(([currentRelationship, citygis, locations]) => {
        if (!active) return;
        setRelationship(currentRelationship);
        setCatalogs({ citygis, locations });
        const current = currentRelationship.current;
        setTarget(current?.location ? `${current.kind}:location:${current.location.id}` : current?.target ? `${current.kind}:object:${current.target.id}` : "");
      })
      .catch((reason: unknown) => {
        if (active) setRelationshipError(reason instanceof Error ? reason.message : "Plaatsingsgegevens laden is niet gelukt.");
      })
      .finally(() => { if (active) setRelationshipLoading(false); });
    return () => { active = false; };
  }, [radioId]);

  async function savePlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!radio) return;
    setRelationshipError("");
    const [kindValue, targetType, targetValue] = target.split(":");
    const kind = (kindValue || relationship?.current?.kind || "assigned_to") as RadioRelationshipEntry["kind"];
    try {
      const updated = await api.updateRadioRelationship(radio.id, {
        kind,
        target_object_id: targetType === "object" ? Number(targetValue) : null,
        location_id: targetType === "location" ? Number(targetValue) : null,
      });
      setRelationship(updated);
      const current = updated.current;
      setTarget(current?.location ? `${current.kind}:location:${current.location.id}` : current?.target ? `${current.kind}:object:${current.target.id}` : "");
      await refreshRadio();
    } catch (reason) {
      setRelationshipError(reason instanceof Error ? reason.message : "Radio-plaatsing opslaan is niet gelukt.");
    }
  }

  const subscriptionHistory = [...(radio?.subscription_history ?? [])]
    .sort((left, right) => right.started_at.localeCompare(left.started_at));
  const visibleSubscriptionHistory = subscriptionHistoryExpanded
    ? subscriptionHistory
    : subscriptionHistory.slice(0, 1);

  return <div className="mx-auto max-w-5xl space-y-7">
    <Button variant="ghost" asChild className="-ml-3"><Link to="/radios"><ArrowLeft className="h-4 w-4" />Terug naar radio's</Link></Button>
    {radioLoading ? <p role="status" className="py-8 text-sm text-muted-foreground">Radiogegevens laden…</p> : radioError ? <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">{radioError}</div> : radio && <>
      <header>
        <p className="text-sm font-medium text-primary">Assetbeheer · Radio</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Radio {radio.tei}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{radio.model ? `${radio.model.manufacturer} ${radio.model.name}` : radio.model_name || radio.manufacturer || "Model onbekend"}</p>
      </header>

      <Card className="rounded-none">
        <CardHeader><CardTitle>Radiogegevens</CardTitle><CardDescription>Identificatie en registratie</CardDescription></CardHeader>
        <CardContent><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <RadioField label="TEI"><span className="font-mono">{radio.tei}</span></RadioField>
          <RadioField label="Fabrikant">{radio.model?.manufacturer || radio.manufacturer}</RadioField>
          <RadioField label="Model">{radio.model?.name || radio.model_name}</RadioField>
          <RadioField label="FirePlan-ID">{radio.fireplan_id === null ? "—" : String(radio.fireplan_id)}</RadioField>
          <RadioField label="FirePlan-QR">{radio.fireplan_qr_url ? <a className="underline" href={radio.fireplan_qr_url} target="_blank" rel="noreferrer">Open bron-QR</a> : "—"}</RadioField>
          <RadioField label="Geregistreerd">{formatDate(radio.created_at)}</RadioField>
          <RadioField label="Laatst bijgewerkt">{formatDate(radio.updated_at)}</RadioField>
        </dl></CardContent>
      </Card>

      <Card className="rounded-none">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Abonnementen</CardTitle>
              <CardDescription>{radio.subscription_history?.length ?? 0} registraties</CardDescription>
            </div>
            <span
              role="status"
              aria-label={radio.current_subscription ? "Radio actief" : "Radio inactief"}
              className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 text-xs font-medium ${radio.current_subscription ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
            >
              <span className={`h-2 w-2 rounded-full ${radio.current_subscription ? "bg-emerald-600" : "bg-red-600"}`} />
              {radio.current_subscription ? "Actief" : "Inactief"}
            </span>
          </CardHeader>
          <CardContent>
            {visibleSubscriptionHistory.length ? <ol className="space-y-2">{visibleSubscriptionHistory.map((item) => <li key={item.id} className="border p-3 text-sm">
              <span className="font-medium">{item.issi.issi} · {item.issi.alias}</span><span className="ml-2 text-muted-foreground">{item.ended_at ? "Beëindigd" : "Actief"}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{formatDate(item.started_at)} – {formatDate(item.ended_at)}</span>
            </li>)}</ol> : <p className="text-sm text-muted-foreground">Geen abonnementshistoriek.</p>}
            {subscriptionHistory.length > 1 && <Button
              type="button"
              variant="ghost"
              className="mt-2 h-auto w-fit justify-start gap-2 rounded-none px-0 py-1 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
              aria-expanded={subscriptionHistoryExpanded}
              onClick={() => setSubscriptionHistoryExpanded((expanded) => !expanded)}
            >
              <span>{subscriptionHistoryExpanded ? "Verberg oudere abonnementen" : `Toon oudere abonnementen (${subscriptionHistory.length - 1})`}</span>
              <ArrowDown className={`h-4 w-4 transition-transform ${subscriptionHistoryExpanded ? "rotate-180" : ""}`} />
            </Button>}
          </CardContent>
        </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>FirePlan-inventarissen</CardTitle>
          <CardDescription>{inventoryPage?.count ?? "…"} inventariswaarnemingen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {inventoryLoading && <p role="status" className="text-sm text-muted-foreground">Inventarissen laden…</p>}
          {inventoryError && <p role="alert" className="text-sm text-red-700">{inventoryError}</p>}
          {!inventoryLoading && !inventoryError && !latestInventory && <p className="text-sm text-muted-foreground">Geen FirePlan-inventariswaarnemingen.</p>}
          {latestInventory && <InventoryHistoryRow inventory={latestInventory} />}
          {inventoryExpanded && inventoryPage && inventoryPage.results
            .filter((item) => inventoryPageNumber !== 1 || item.uuid !== latestInventory?.uuid)
            .map((item) => <InventoryHistoryRow key={item.uuid} inventory={item} />)}
          {inventoryPage && inventoryPage.count > 1 && <Button
            type="button"
            variant="ghost"
            className="h-auto w-fit justify-start gap-2 rounded-none px-0 py-1 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
            aria-expanded={inventoryExpanded}
            onClick={() => {
              if (inventoryExpanded) {
                setInventoryExpanded(false);
                if (inventoryPageNumber !== 1) setInventoryPageNumber(1);
              } else {
                setInventoryExpanded(true);
              }
            }}
          >
            <span>{inventoryExpanded ? "Verberg oudere inventarissen" : `Toon oudere inventarissen (${inventoryPage.count - 1})`}</span>
            <ArrowDown className={`h-4 w-4 transition-transform ${inventoryExpanded ? "rotate-180" : ""}`} />
          </Button>}
          {inventoryExpanded && inventoryPage && inventoryPage.count > inventoryPage.page_size && <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">Pagina {inventoryPage.page} van {Math.ceil(inventoryPage.count / inventoryPage.page_size)}</span>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="icon" className="rounded-none" title="Vorige pagina" aria-label="Vorige pagina" disabled={inventoryPageNumber <= 1 || inventoryLoading} onClick={() => setInventoryPageNumber((page) => page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button type="button" variant="outline" size="icon" className="rounded-none" title="Volgende pagina" aria-label="Volgende pagina" disabled={inventoryPage.page * inventoryPage.page_size >= inventoryPage.count || inventoryLoading} onClick={() => setInventoryPageNumber((page) => page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plaatsing</CardTitle><CardDescription>Huidige bestemming en historiek</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {relationshipLoading && <p role="status" className="text-sm text-muted-foreground">Plaatsingsgegevens laden…</p>}
          {relationshipError && <p role="alert" className="text-sm text-red-700">{relationshipError}</p>}
          {relationship && <>
            <p className="text-sm">Huidige bestemming: {relationship.current ? relationshipLabel(relationship.current, catalogs) : "Geen plaatsing"}</p>
            {isStaff && catalogs && <form onSubmit={(event) => void savePlacement(event)} className="flex flex-wrap items-end gap-2">
              <label className="min-w-64 flex-1 space-y-1 text-sm font-medium" htmlFor="radio-placement-target">Bestemming
                <select id="radio-placement-target" className="flex h-10 w-full border bg-white px-3 text-sm" value={target} onChange={(event) => setTarget(event.target.value)}>
                  <option value="">Geen plaatsing</option>
                  <optgroup label="Vectoren">{catalogs.citygis.vectors.filter((item) => item.is_current).map((item) => <option key={item.managed_object.id} value={`assigned_to:object:${item.managed_object.id}`}>{item.abbreviation || item.name || item.vector_code} · {item.post?.name ?? "Zonder post"}</option>)}</optgroup>
                  <optgroup label="Voertuigen">{catalogs.citygis.vehicles.filter((item) => item.is_current).map((item) => <option key={item.managed_object.id} value={`mounted_in:object:${item.managed_object.id}`}>{item.alphacode} · {item.plate}</option>)}</optgroup>
                  <optgroup label="Locaties">{catalogs.locations.map((item) => <option key={item.id} value={`installed_in:location:${item.id}`}>{item.name}</option>)}</optgroup>
                </select>
              </label>
              <Button type="submit">Plaatsing bewaren</Button>
            </form>}
            <div>
              <h3 className="text-sm font-medium">Plaatsingshistoriek</h3>
              {relationship.history.length ? <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{relationship.history.map((item) => <li key={item.id}>{relationshipLabel(item, catalogs)} · {formatDate(item.started_at)} – {item.ended_at ? formatDate(item.ended_at) : "Actueel"}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Geen plaatsingshistoriek.</p>}
            </div>
          </>}
        </CardContent>
      </Card>
    </>}
  </div>;
}
