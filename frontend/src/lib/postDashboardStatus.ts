import type { CityGISPostVector, CityGISStatusPeriod } from "@/lib/api";

export type StatusSummary = {
  available: { seconds: number; percentage: number };
  onIntervention: { seconds: number; percentage: number };
  outOfService: { seconds: number; percentage: number };
  unknown: { seconds: number; percentage: number };
};

type StatusCategory = keyof StatusSummary;
const statusCategories: StatusCategory[] = ["available", "onIntervention", "outOfService", "unknown"];
const displayTypes = ["APM", "AE", "CMD", "MSERV", "FAUB", "AMB"];
const collator = new Intl.Collator("nl-BE", { numeric: true, sensitivity: "base" });

export function calculateStatusSummary(
  periods: CityGISStatusPeriod[],
  windowSeconds: number,
): StatusSummary {
  const seconds: Record<StatusCategory, number> = {
    available: 0,
    onIntervention: 0,
    outOfService: 0,
    unknown: 0,
  };
  for (const period of periods) {
    const duration = Math.max(0, period.duration_seconds);
    if (period.is_unknown) seconds.unknown += duration;
    else if (period.status_code === "0" || period.status_code === "6") seconds.available += duration;
    else if (Number.isFinite(Number(period.status_code)) && Number(period.status_code) >= 90) seconds.outOfService += duration;
    else seconds.onIntervention += duration;
  }

  if (windowSeconds <= 0) {
    return {
      available: { seconds: 0, percentage: 0 },
      onIntervention: { seconds: 0, percentage: 0 },
      outOfService: { seconds: 0, percentage: 0 },
      unknown: { seconds: 0, percentage: 100 },
    };
  }
  const knownTotal = Object.values(seconds).reduce((sum, value) => sum + value, 0);
  if (knownTotal < windowSeconds) seconds.unknown += windowSeconds - knownTotal;
  const measuredTotal = Object.values(seconds).reduce((sum, value) => sum + value, 0);
  const exact = statusCategories.map((key) => seconds[key] / measuredTotal * 100);
  const values = exact.map(Math.floor);
  let remaining = 100 - values.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (const item of byRemainder) {
    if (remaining <= 0) break;
    values[item.index] += 1;
    remaining -= 1;
  }
  return Object.fromEntries(statusCategories.map((key, index) => [key, {
    seconds: seconds[key],
    percentage: values[index],
  }])) as StatusSummary;
}

export function mergeConsecutiveStatusPeriods(periods: CityGISStatusPeriod[]): CityGISStatusPeriod[] {
  return periods.reduce<CityGISStatusPeriod[]>((merged, period) => {
    const previous = merged.at(-1);
    const sameStatus = previous
      && previous.status_code === period.status_code
      && previous.is_unknown === period.is_unknown;
    const adjacent = previous
      && new Date(previous.ends_at).getTime() === new Date(period.starts_at).getTime();
    if (previous && sameStatus && adjacent) {
      previous.ends_at = period.ends_at;
      previous.duration_seconds += period.duration_seconds;
    } else {
      merged.push({ ...period });
    }
    return merged;
  }, []);
}

export function groupPostVectors(vectors: CityGISPostVector[]) {
  const groups = new Map<string, CityGISPostVector[]>(displayTypes.map((type) => [type, []]));
  const other: CityGISPostVector[] = [];
  for (const vector of vectors) {
    const type = vector.resource_type_code;
    if (type === "AMBINC") groups.get("AMB")?.push(vector);
    else if (groups.has(type)) groups.get(type)?.push(vector);
    else other.push(vector);
  }
  const sort = (items: CityGISPostVector[]) => items.sort((left, right) =>
    collator.compare(left.vehicle?.alphacode || left.source_vehicle_name || "", right.vehicle?.alphacode || right.source_vehicle_name || "")
    || collator.compare(left.abbreviation || left.name || left.vector_code, right.abbreviation || right.name || right.vector_code)
    || left.id - right.id,
  );
  const result = displayTypes.map((key) => ({ key, vectors: sort(groups.get(key) ?? []) }));
  if (other.length) result.push({ key: "Overige", vectors: sort(other) });
  return result;
}
