import { describe, expect, it } from "vitest";
import type { CityGISPostVector, CityGISStatusPeriod } from "@/lib/api";
import { calculateStatusSummary, groupPostVectors, mergeConsecutiveStatusPeriods } from "@/lib/postDashboardStatus";

const period = (status_code: string | null, duration_seconds: number, is_unknown = false) => ({
  status_code,
  status_description: status_code ? `Status ${status_code}` : null,
  status_abbreviation: status_code,
  status_color: "#008000",
  starts_at: "2026-11-23T00:00:00Z",
  ends_at: "2026-11-23T00:00:00Z",
  duration_seconds,
  is_unknown,
}) satisfies CityGISStatusPeriod;

const vector = (id: number, type: string) => ({
  id,
  resource_type_code: type,
  vector_code: `V${id}`,
  abbreviation: `V${id}`,
  name: `V${id}`,
  vehicle: null,
  source_vehicle_name: "",
}) as CityGISPostVector;

describe("post dashboard status", () => {
  it("combines status 0 and 6 as available and reports duration with four percentages", () => {
    const values = calculateStatusSummary([
      period("0", 8_640),
      period("6", 8_640),
      period("12", 8_640),
      period("90", 8_640),
      period(null, 8_640, true),
    ], 43_200);
    expect(values).toEqual({
      available: { seconds: 17_280, percentage: 40 },
      onIntervention: { seconds: 8_640, percentage: 20 },
      outOfService: { seconds: 8_640, percentage: 20 },
      unknown: { seconds: 8_640, percentage: 20 },
    });
    expect(Object.values(values).reduce((sum, value) => sum + value.percentage, 0)).toBe(100);
  });

  it("merges adjacent periods with the same status and keeps separated periods apart", () => {
    const periods = [
      { ...period("0", 60), starts_at: "2026-11-23T00:00:00Z", ends_at: "2026-11-23T00:01:00Z" },
      { ...period("0", 120), starts_at: "2026-11-23T00:01:00Z", ends_at: "2026-11-23T00:03:00Z" },
      { ...period("6", 60), starts_at: "2026-11-23T00:03:00Z", ends_at: "2026-11-23T00:04:00Z" },
      { ...period("0", 60), starts_at: "2026-11-23T00:05:00Z", ends_at: "2026-11-23T00:06:00Z" },
    ];
    const merged = mergeConsecutiveStatusPeriods(periods);
    expect(merged).toHaveLength(3);
    expect(merged[0]).toMatchObject({ status_code: "0", duration_seconds: 180, starts_at: "2026-11-23T00:00:00Z", ends_at: "2026-11-23T00:03:00Z" });
    expect(merged[1].status_code).toBe("6");
    expect(merged[2].status_code).toBe("0");
  });

  it("uses the required open group order and combines AMBINC with AMB", () => {
    const groups = groupPostVectors([
      vector(1, "AMBINC"), vector(2, "AMB"), vector(3, "FAUB"), vector(4, "APM"),
      vector(5, "AE"), vector(6, "CMD"), vector(7, "MSERV"), vector(8, "MISC"),
    ]);
    expect(groups.map((group) => group.key)).toEqual(["APM", "AE", "CMD", "MSERV", "FAUB", "AMB", "Overige"]);
    expect(groups.find((group) => group.key === "AMB")?.vectors.map((item) => item.resource_type_code)).toEqual(expect.arrayContaining(["AMB", "AMBINC"]));
    expect(groups.find((group) => group.key === "Overige")?.vectors).toHaveLength(1);
  });

  it("omits the other-types group when no other vector type is present", () => {
    expect(groupPostVectors([vector(1, "APM")]).map((group) => group.key)).toEqual(["APM", "AE", "CMD", "MSERV", "FAUB", "AMB"]);
  });
});
