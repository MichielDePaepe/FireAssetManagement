import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type FireplanInventoryDetail } from "@/lib/api";

function formatDateTime(value: string | null): string {
  if (!value) return "Onbekend";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{value || "Onbekend"}</dd>
    </div>
  );
}

export function FireplanInventoryDetailPage() {
  const { inventoryUuid = "" } = useParams();
  const [inventory, setInventory] = useState<FireplanInventoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.getFireplanInventoryDetail(inventoryUuid)
      .then((result) => { if (active) setInventory(result); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Inventarisdetails laden is niet gelukt.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [inventoryUuid]);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <Button variant="ghost" asChild className="-ml-3">
        <Link to="/fireplan/inventories"><ArrowLeft className="h-4 w-4" />Terug naar inventarissen</Link>
      </Button>
      <header>
        <p className="text-sm font-medium text-primary">Beheer · FirePlan-inventarissen</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">FirePlan-inventaris</h1>
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{inventoryUuid}</p>
      </header>

      {loading ? (
        <div role="status" className="py-8 text-sm text-muted-foreground">Lokale inventarissnapshot laden…</div>
      ) : error ? (
        <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : inventory ? (
        <>
          {inventory.sync_status === "failed" && inventory.last_error && (
            <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">
              Laatste synchronisatiepoging mislukt: {inventory.last_error}
            </div>
          )}

          <Card className="rounded-none">
            <CardHeader>
              <CardTitle>Inventarisgegevens</CardTitle>
              <CardDescription>De laatst succesvol opgeslagen lokale snapshot.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <DetailField label="Voertuigcode" value={inventory.vehicle_alpha_code} />
                <DetailField label="Voertuig" value={inventory.vehicle?.alphacode ?? "Onbekend"} />
                <DetailField label="FirePlan-voertuig-ID" value={inventory.vehicle ? String(inventory.vehicle.fireplan_id) : "Onbekend"} />
                <DetailField label="Vector" value={inventory.vector?.vector_code ?? "Onbekend"} />
                <DetailField label="Vectoreenheid" value={inventory.vector?.name || inventory.vector?.abbreviation || "Onbekend"} />
                <DetailField label="Type" value={inventory.inventory_type_name} />
                <DetailField label="Post/locatie" value={inventory.done_in_name} />
                <DetailField label="Uitgevoerd door" value={inventory.done_by_full_name} />
                <DetailField label="Toezichthouder" value={inventory.overseen_by_full_name} />
                <DetailField label="Aangemaakt" value={formatDateTime(inventory.source_created_at)} />
                <DetailField label="Afgesloten" value={formatDateTime(inventory.source_closed_at)} />
                <DetailField label="Gewijzigd in FirePlan" value={formatDateTime(inventory.source_updated_at)} />
                <DetailField label="Synchronisatiestatus" value={inventory.sync_status} />
                <DetailField label="Laatst succesvol gesynchroniseerd" value={formatDateTime(inventory.last_successful_sync_at)} />
                <DetailField label="Laatste poging" value={formatDateTime(inventory.last_attempted_at)} />
                <DetailField label="Incidentrapporten" value={inventory.has_incident_reports === null ? "Onbekend" : inventory.has_incident_reports ? "Ja" : "Nee"} />
                <DetailField label="Compleet na afsluiten" value={inventory.is_complete_after_completion === null ? "Onbekend" : inventory.is_complete_after_completion ? "Ja" : "Nee"} />
                <DetailField label="Compleet voor afsluiten" value={inventory.is_complete_before_completion === null ? "Onbekend" : inventory.is_complete_before_completion ? "Ja" : "Nee"} />
                <DetailField label="Aantal uitgesloten" value={inventory.is_quantity_count_excluded === null ? "Onbekend" : inventory.is_quantity_count_excluded ? "Ja" : "Nee"} />
                <DetailField label="Teststandaard" value={inventory.is_test_standard === null ? "Onbekend" : inventory.is_test_standard ? "Ja" : "Nee"} />
                <DetailField label="Nog ontbrekend" value={inventory.remaining_missing_followed_count === null ? "Onbekend" : String(inventory.remaining_missing_followed_count)} />
              </dl>
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardHeader>
              <CardTitle>Radio-observaties</CardTitle>
              <CardDescription>{inventory.radio_observations.length} radio&apos;s uit de opgeslagen snapshot</CardDescription>
            </CardHeader>
            <CardContent>
              {inventory.radio_observations.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-left text-sm">
                    <colgroup><col className="w-[35%]" /><col className="w-[25%]" /><col className="w-[40%]" /></colgroup>
                    <thead className="border-b bg-muted/70 text-xs font-medium text-muted-foreground">
                      <tr><th scope="col" className="px-3 py-3">FirePlan-item-ID</th><th scope="col" className="px-3 py-3">Itemtype</th><th scope="col" className="px-3 py-3">TEI</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {inventory.radio_observations.map((observation) => (
                        <tr key={observation.fireplan_item_id}>
                          <td className="break-all px-3 py-3">{observation.fireplan_item_id}</td>
                          <td className="px-3 py-3">{observation.item_type_id}</td>
                          <td className="break-all px-3 py-3 font-mono">{observation.serial_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted-foreground">Geen radio-observaties opgeslagen.</p>}
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardHeader><CardTitle>Opgeslagen radio-JSON</CardTitle></CardHeader>
            <CardContent>
              <pre className="overflow-x-auto border bg-muted/40 p-4 text-xs leading-relaxed">{JSON.stringify(inventory.radio_items, null, 2)}</pre>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
