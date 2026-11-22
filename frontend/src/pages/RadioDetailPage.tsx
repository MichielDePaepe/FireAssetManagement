import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type CityGISLocation, type CityGISSnapshot, type RadioAsset, type RadioRelationshipEntry, type RadioRelationshipSnapshot } from "@/lib/api";

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

  return <div className="mx-auto max-w-5xl space-y-7">
    <Button variant="ghost" asChild className="-ml-3"><Link to="/radios"><ArrowLeft className="h-4 w-4" />Terug naar radio's</Link></Button>
    {radioLoading ? <p role="status" className="py-8 text-sm text-muted-foreground">Radiogegevens laden…</p> : radioError ? <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">{radioError}</div> : radio && <>
      <header>
        <p className="text-sm font-medium text-primary">Assetbeheer · Radio</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Radio {radio.tei}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{radio.model ? `${radio.model.manufacturer} ${radio.model.name}` : radio.model_name || radio.manufacturer || "Model onbekend"}</p>
      </header>

      <Card>
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

      <Card>
        <CardHeader><CardTitle>Abonnementen</CardTitle><CardDescription>{radio.subscription_history?.length ?? 0} registraties</CardDescription></CardHeader>
        <CardContent>
          {radio.subscription_history?.length ? <ol className="space-y-2">{radio.subscription_history.map((item) => <li key={item.id} className="border p-3 text-sm">
            <span className="font-medium">{item.issi.issi} · {item.issi.alias}</span><span className="ml-2 text-muted-foreground">{item.ended_at ? "Beëindigd" : "Actief"}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{formatDate(item.started_at)} – {formatDate(item.ended_at)}</span>
          </li>)}</ol> : <p className="text-sm text-muted-foreground">Geen abonnementshistoriek.</p>}
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
