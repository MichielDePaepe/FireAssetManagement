import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Signal, SignalZero } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, subscribeToCityGIS, type CityGISSnapshot, type CityGISVector, type LocationOverview } from "@/lib/api";
import { calculateStatusSummary, groupPostVectors, mergeConsecutiveStatusPeriods } from "@/lib/postDashboardStatus";

const dateTimeFormatter = new Intl.DateTimeFormat("nl-BE", { dateStyle: "short", timeStyle: "short" });
const statusAxisFormatter = new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", hour: "numeric", minute: "2-digit", hourCycle: "h23" });

function statusAxisTicks(startsAt: string, endsAt: string) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const ticks: { position: number; label: string }[] = [];
  const cursor = new Date(start);
  cursor.setUTCSeconds(0, 0);
  while (cursor.getTime() <= end) {
    const parts = statusAxisFormatter.formatToParts(cursor);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (hour % 4 === 0 && minute === 0 && cursor.getTime() >= start) {
      ticks.push({ position: ((cursor.getTime() - start) / (end - start)) * 100, label: `${hour}u` });
    }
    cursor.setTime(cursor.getTime() + 60_000);
  }
  return ticks;
}

function formatVisibleDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours} u ${remainingMinutes} min` : `${remainingMinutes} min`;
}
function mergeLiveVectors(overview: LocationOverview, snapshot: CityGISSnapshot): LocationOverview {
  const liveById = new Map(snapshot.vectors.map((vector) => [vector.id, vector]));
  return {
    ...overview,
    vectors: overview.vectors.map((vector) => {
      const live = liveById.get(vector.id);
      return live ? {
        ...vector,
        operational_status_code: live.operational_status_code,
        status_description: live.status_description,
        status_abbreviation: live.status_abbreviation,
        status_updated_at: live.status_updated_at,
        status_color: live.status_color,
        vehicle: live.vehicle,
        source_vehicle_name: live.source_vehicle_name,
        last_seen_at: live.last_seen_at,
      } : vector;
    }),
  };
}

function vehicleDescription(vector: CityGISVector): string {
  return vector.vehicle?.alphacode || vector.source_vehicle_name || "Onbekend voertuig";
}

export function PostDashboardPage() {
  const { postId } = useParams();
  const id = Number(postId);
  const [overview, setOverview] = useState<LocationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(true);
  const groups = overview ? groupPostVectors(overview.vectors).filter((group) => group.vectors.length) : [];
  const windowSeconds = overview
    ? Math.max(0, (new Date(overview.status_window.ends_at).getTime() - new Date(overview.status_window.starts_at).getTime()) / 1000)
    : 0;

  const refresh = useCallback(async () => {
    if (!Number.isInteger(id) || id < 1) {
      setError("Deze post bestaat niet.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.getLocationOverview(id);
      if (result.location.kind !== "post") {
        setError("Deze locatie is geen post.");
        setOverview(null);
      } else {
        setOverview(result);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Postdashboard kon niet worden geladen.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToCityGIS((snapshot) => {
      if (!active) return;
      setOverview((current) => current ? mergeLiveVectors(current, snapshot) : current);
      setConnected(true);
      setError("");
      void api.getLocationOverview(id).then((fresh) => {
        if (active && fresh.location.kind === "post") setOverview(mergeLiveVectors(fresh, snapshot));
      }).catch(() => {
        if (active) setError("Postgegevens konden niet live worden vernieuwd.");
      });
    }, () => {
      if (active) setConnected(false);
    });
    void refresh();
    return () => { active = false; unsubscribe(); };
  }, [id, refresh]);

  return <main className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
      <div>
        <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />Terug naar postenoverzicht
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">CityGIS · Postdashboard</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{overview?.location.name ?? "Post"}</h1>
      </div>
      <span role="status" className={`inline-flex items-center gap-2 border px-2.5 py-1.5 text-xs ${connected ? "text-foreground" : "border-amber-400 bg-amber-50 text-amber-900"}`}>
        {connected ? <Signal aria-hidden="true" className="h-3.5 w-3.5 text-emerald-700" /> : <SignalZero aria-hidden="true" className="h-3.5 w-3.5" />}
        {connected ? "Live verbonden" : "Liveverbinding tijdelijk onderbroken · laatste gegevens blijven zichtbaar"}
      </span>
    </header>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-900"><span className="inline-flex items-center gap-2"><AlertCircle aria-hidden="true" className="h-4 w-4" />{error}</span><Button variant="outline" size="sm" onClick={() => void refresh()}>Opnieuw proberen</Button></div>}
    {loading && !overview ? <p role="status" className="border bg-white px-4 py-8 text-sm text-muted-foreground">Postgegevens laden…</p>
      : overview && overview.vectors.length === 0 ? <p role="status" className="border bg-white px-4 py-8 text-center text-sm text-muted-foreground">Geen actuele vectoren voor deze post.</p>
        : overview && <div className="space-y-6">
          {groups.map((group) => <section key={group.key} aria-label={`Vectortype ${group.key}`} className="space-y-3">
            {group.key === "Overige" ? <details className="border bg-white p-4">
              <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Overige vectortypes ({group.vectors.length})</summary>
              <div className="mt-3 space-y-3">{group.vectors.map((vector) => <VectorCard key={vector.id} vector={vector} windowSeconds={windowSeconds} windowStartsAt={overview.status_window.starts_at} windowEndsAt={overview.status_window.ends_at} />)}</div>
            </details> : <>
              <h2 className="border-b pb-2 text-lg font-semibold">{group.key}</h2>
              {group.vectors.map((vector) => <VectorCard key={vector.id} vector={vector} windowSeconds={windowSeconds} windowStartsAt={overview.status_window.starts_at} windowEndsAt={overview.status_window.ends_at} />)}
            </>}
          </section>)}
        </div>}
  </main>;
}

function VectorCard({ vector, windowSeconds, windowStartsAt, windowEndsAt }: { vector: LocationOverview["vectors"][number]; windowSeconds: number; windowStartsAt: string; windowEndsAt: string }) {
  const statusSummary = calculateStatusSummary(vector.status_periods, windowSeconds);
  const statusPeriods = mergeConsecutiveStatusPeriods(vector.status_periods);
  const percentageRows = [
    { label: "Beschikbaar", ...statusSummary.available },
    { label: "Op interventie", ...statusSummary.onIntervention },
    { label: "Buiten dienst", ...statusSummary.outOfService },
    { label: "Onbekend", ...statusSummary.unknown },
  ].filter((item) => item.percentage > 0);
  const axisTicks = statusAxisTicks(windowStartsAt, windowEndsAt);
  return <article className="border bg-white p-4 shadow-sm">
            <header className="flex items-center gap-3 border-b pb-3">
              <span
                role="img"
                aria-label={`Huidige status ${vector.operational_status_code || "?"} · ${vector.status_description || "Onbekende status"}`}
                title={`Huidige status ${vector.operational_status_code || "?"} · ${vector.status_description || "Onbekende status"}`}
                className="h-10 w-[6px] shrink-0 rounded-none"
                style={{ backgroundColor: vector.status_color ?? "#E5E7EB" }}
              />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{vector.abbreviation || vector.name || vector.vector_code}</h2>
                <p className="text-sm text-muted-foreground">{vehicleDescription(vector)}</p>
              </div>
            </header>
            <section aria-label={`Statusverloop laatste 24 uur voor ${vector.vector_code}`} className="mt-4">
              <h3 className="text-sm font-semibold">Statusverloop · laatste 24 uur</h3>
              <div className="mt-2 grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="min-w-0">
                <div role="group" aria-label={`Statusperioden van ${vector.vector_code}`} className="!rounded-none flex h-7 min-w-0 overflow-visible border bg-muted/20">
                {statusPeriods.map((period, index) => {
                  const status = period.is_unknown ? "Onbekend" : `${period.status_code ?? "?"} · ${period.status_description ?? period.status_abbreviation ?? "Status"}`;
                  const starts = dateTimeFormatter.format(new Date(period.starts_at));
                  const ends = dateTimeFormatter.format(new Date(period.ends_at));
                  const duration = formatVisibleDuration(period.duration_seconds);
                  const warnLongStatusOne = period.status_code === "1" && period.duration_seconds > 180;
                  return <button
                    key={`${period.starts_at}-${period.ends_at}-${index}`}
                    type="button"
                    aria-label={`${status}, ${duration}, van ${starts} tot ${ends}${warnLongStatusOne ? ", waarschuwing: status 1 duurde langer dan 3 minuten" : ""}`}
                    title={`${status} · ${duration} · ${starts} – ${ends}${warnLongStatusOne ? " · Waarschuwing: status 1 duurde langer dan 3 minuten" : ""}`}
                    className={`!rounded-none relative min-w-[2px] border-r border-white focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring${warnLongStatusOne ? " z-10" : ""}`}
                    style={{ flexGrow: Math.max(0, period.duration_seconds), flexBasis: 0, background: period.is_unknown ? "repeating-linear-gradient(135deg, #e5e7eb, #e5e7eb 5px, #f8fafc 5px, #f8fafc 10px)" : period.status_color ?? "#9ca3af" }}
                  >{warnLongStatusOne && <span aria-hidden="true" className="pointer-events-none absolute -top-4 left-1/2 z-20 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white ring-2 ring-white">!</span>}</button>;
                })}
              </div>
                <div aria-hidden="true" className="relative mt-1 h-4 text-[10px] leading-4 text-muted-foreground/70">
                  {axisTicks.map(({ position, label }, index) => <span key={`${position}-${label}`} className="absolute top-0 whitespace-nowrap" style={{ left: `${position}%`, transform: `translateX(${index === 0 ? "0" : index === axisTicks.length - 1 ? "-100%" : "-50%"})` }}>{label}</span>)}
                </div>
                </div>
                <ul aria-label="Statuspercentages" className="flex flex-col gap-1 text-xs">
                  {percentageRows.map(({ label, percentage, seconds }) => <li key={label} className="flex justify-between gap-2 border-b pb-1 last:border-b-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="shrink-0 font-medium text-foreground">{percentage}% · {formatVisibleDuration(seconds)}</span>
                  </li>)}
                </ul>
              </div>
            </section>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <section aria-label="Voertuiggegevens">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voertuig</h3>
                <p className="mt-1 font-medium">{vehicleDescription(vector)}</p>
                {vector.vehicle?.plate && <p className="text-sm text-muted-foreground">{vector.vehicle.plate}</p>}
                {vector.vehicle?.utilisation && <p className="text-sm text-muted-foreground">{vector.vehicle.utilisation}</p>}
                {vector.vehicle?.fleet_status && <p className="text-sm text-muted-foreground">{vector.vehicle.fleet_status}</p>}
              </section>
              <section aria-label="Toegewezen pagers">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagers</h3>
                {vector.pagers.length ? <ul className="mt-1 space-y-1">{vector.pagers.map((pager) => <li key={pager.id}>{pager.serial_number} · {pager.type.name}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Geen pagers toegewezen</p>}
              </section>
              <section aria-label="Geplaatste radio's">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Radio’s</h3>
                {vector.radios.length ? <ul className="mt-1 space-y-1">{vector.radios.map((radio) => <li key={radio.id}>{radio.tei}{radio.model ? ` · ${radio.model.manufacturer} ${radio.model.name}` : ""}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Geen radio’s geplaatst</p>}
              </section>
            </div>
  </article>;
}
