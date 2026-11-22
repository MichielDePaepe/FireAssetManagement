import type { CityGISLocation, CityGISVector } from "@/lib/api";

export type DashboardGroupKey = "apm" | "ae" | "amb" | "rest" | "special";

export interface DashboardPostRow {
  location: CityGISLocation;
  groups: Record<DashboardGroupKey, CityGISVector[]>;
  totals: Record<DashboardGroupKey, { available: number; total: number }>;
}

const GROUP_KEYS: DashboardGroupKey[] = ["apm", "ae", "amb", "rest", "special"];
const collator = new Intl.Collator("nl-BE", { numeric: true, sensitivity: "base" });

function compareVectors(left: CityGISVector, right: CityGISVector): number {
  return collator.compare(left.vehicle?.alphacode || left.source_vehicle_name || "", right.vehicle?.alphacode || right.source_vehicle_name || "")
    || collator.compare(left.abbreviation || left.name || "", right.abbreviation || right.name || "")
    || collator.compare(left.vector_code, right.vector_code)
    || left.id - right.id;
}

function groupFor(vector: CityGISVector): DashboardGroupKey {
  if (vector.operational_status_code === "99") return "rest";
  if (Number(vector.operational_status_code) >= 90) return "special";
  if (vector.resource_type_code === "APM") return "apm";
  if (vector.resource_type_code === "AE") return "ae";
  if (vector.resource_type_code === "AMB" || vector.resource_type_code === "AMBINC") return "amb";
  return "rest";
}

function compareRestVectors(left: CityGISVector, right: CityGISVector): number {
  const priority = (vector: CityGISVector) => vector.operational_status_code === "99" ? 3
    : vector.resource_type_code === "CMD" ? 0
      : vector.resource_type_code === "MSERV" ? 1
        : vector.resource_type_code === "FAUB" ? 2 : 4;
  return priority(left) - priority(right)
    || collator.compare(left.resource_type_code, right.resource_type_code)
    || compareVectors(left, right);
}

export function buildPostDashboardRows(
  locations: CityGISLocation[],
  vectors: CityGISVector[],
): DashboardPostRow[] {
  const posts = locations.filter((location) => location.kind === "post");
  const postIds = new Set(posts.map((location) => location.id));
  const groupsByPost = new Map<number, Record<DashboardGroupKey, CityGISVector[]>>();
  for (const post of posts) {
    groupsByPost.set(post.id, { apm: [], ae: [], amb: [], rest: [], special: [] });
  }

  for (const vector of vectors) {
    const postId = vector.post?.id;
    if (!vector.is_current || postId === undefined || !postIds.has(postId)) continue;
    groupsByPost.get(postId)?.[groupFor(vector)].push(vector);
  }

  return posts
    .sort((left, right) => {
      const leftSortName = left.sort_name.trim();
      const rightSortName = right.sort_name.trim();
      if (leftSortName && !rightSortName) return -1;
      if (!leftSortName && rightSortName) return 1;
      return collator.compare(leftSortName, rightSortName)
        || collator.compare(left.name, right.name)
        || left.id - right.id;
    })
    .map((location) => {
      const groups = groupsByPost.get(location.id)!;
      for (const key of GROUP_KEYS) {
        groups[key].sort(key === "rest" ? compareRestVectors : compareVectors);
      }
      const totals = Object.fromEntries(GROUP_KEYS.map((key) => [key, {
        available: groups[key].filter((vector) => vector.operational_status_code === "0" || vector.operational_status_code === "6").length,
        total: groups[key].length,
      }])) as DashboardPostRow["totals"];
      return { location, groups, totals };
    });
}
