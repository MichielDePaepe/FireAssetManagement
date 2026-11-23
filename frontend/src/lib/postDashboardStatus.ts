import type { CityGISPostVector, CityGISStatusPeriod } from "@/lib/api";

export type StatusPercentages = {
  available: number;
  other: number;
  outOfService: number;
  unknown: number;
};

type PercentageKey = keyof StatusPercentages;
const percentageKeys: PercentageKey[] = ["available", "other", "outOfService", "unknown"];
const displayTypes = ["APM", "AE", "CMD", "MSERV", "FAUB", "AMB"];
const collator = new Intl.Collator("nl-BE", { numeric: true, sensitivity: "base" });

export function calculateStatusPercentages(
  periods: CityGISStatusPeriod[],
  windowSeconds: number,
): StatusPercentages {
  const seconds: StatusPercentages = { available: 0, other: 0, outOfService: 0, unknown: 0 };
  for (const period of periods) {
    const duration = Math.max(0, period.duration_seconds);
    if (period.is_unknown) seconds.unknown += duration;
    else if (period.status_code === "0" || period.status_code === "6") seconds.available += duration;
    else if (Number.isFinite(Number(period.status_code)) && Number(period.status_code) >= 90) seconds.outOfService += duration;
    else seconds.other += duration;
  }

  if (windowSeconds <= 0) return { available: 0, other: 0, outOfService: 0, unknown: 100 };
  const knownTotal = Object.values(seconds).reduce((sum, value) => sum + value, 0);
  if (knownTotal < windowSeconds) seconds.unknown += windowSeconds - knownTotal;
  const measuredTotal = Object.values(seconds).reduce((sum, value) => sum + value, 0);
  const exact = percentageKeys.map((key) => seconds[key] / measuredTotal * 100);
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
  return Object.fromEntries(percentageKeys.map((key, index) => [key, values[index]])) as StatusPercentages;
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
