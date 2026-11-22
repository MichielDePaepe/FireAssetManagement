import { describe, expect, it } from "vitest";
import { buildPostDashboardRows, type DashboardGroupKey } from "@/lib/dashboardGrouping";
import type { CityGISLocation, CityGISVector } from "@/lib/api";

const post = (id: number, name: string, sort_name = name): CityGISLocation => ({
  id, name, sort_name, kind: "post", parent_id: null, service_id: id,
});

const vector = (id: number, postId: number, type: string, status: string, code = `V-${id}`, vehicle = `A${id}`): CityGISVector => ({
  id,
  managed_object: { id, kind: "vector" },
  vector_code: code,
  name: code,
  abbreviation: code,
  service_abbreviation: "TST",
  service: { id: postId, abbreviation: "TST" },
  post: post(postId, `Post ${postId}`),
  resource_type_code: type,
  resource_code: type,
  operational_status_code: status,
  status_description: null,
  status_abbreviation: null,
  status_updated_at: null,
  status_color: "#00ff00",
  vehicle: { id, managed_object: { id, kind: "vehicle" }, fireplan_id: id, alphacode: vehicle, plate: "", utilisation: "", chassis: "", fleet_status: "", is_current: true, last_seen_at: null },
  source_vehicle_name: "",
  is_current: true,
  last_seen_at: null,
});

describe("buildPostDashboardRows", () => {
  it("lists only posts, sorts them by sort name and retains posts without vectors", () => {
    const rows = buildPostDashboardRows([
      { ...post(3, "Non-post", "00"), kind: "building" },
      post(2, "Anderlecht", "04.01"),
      post(1, "Helihaven", "01.01"),
    ], []);

    expect(rows.map((row) => row.location.name)).toEqual(["Helihaven", "Anderlecht"]);
    expect(rows[0].groups.apm).toEqual([]);
  });

  it("sorts posts with configured sort names first and uses numeric names as tie breakers", () => {
    const rows = buildPostDashboardRows([
      post(4, "Post 10", ""),
      post(2, "Post 2", "01.01"),
      post(1, "Post 1", "01.01"),
      post(3, "Post 3", ""),
    ], []);
    expect(rows.map((row) => row.location.name)).toEqual(["Post 1", "Post 2", "Post 3", "Post 10"]);
  });

  it("applies exact type and status rules, with availability only for 0 and 6", () => {
    const rows = buildPostDashboardRows([post(1, "Post")], [
      vector(1, 1, "APM", "0"),
      vector(2, 1, "AE", "6"),
      vector(3, 1, "AMB", "1"),
      vector(4, 1, "AMBINC", "0"),
      vector(5, 1, "AE64", "0"),
      vector(6, 1, "CMD", "99"),
      vector(7, 1, "APM", "90"),
      vector(8, 1, "AMB", "91"),
    ]);
    const [row] = rows;

    expect(row.groups.apm.map((item) => item.id)).toEqual([1]);
    expect(row.groups.ae.map((item) => item.id)).toEqual([2]);
    expect(row.groups.amb.map((item) => item.id)).toEqual([3, 4]);
    expect(row.groups.rest.map((item) => item.id)).toContain(5);
    expect(row.groups.rest.map((item) => item.id)).toContain(6);
    expect(row.groups.special.map((item) => item.id)).toEqual([7, 8]);
    expect(row.totals.apm).toEqual({ available: 1, total: 1 });
    expect(row.totals.ae).toEqual({ available: 1, total: 1 });
    expect(row.totals.amb).toEqual({ available: 1, total: 2 });
  });

  it("orders Rest as CMD, MSERV, FAUB, status 99, then other types", () => {
    const rows = buildPostDashboardRows([post(1, "Post")], [
      vector(1, 1, "CET", "0"),
      vector(2, 1, "FAUB", "0"),
      vector(3, 1, "MSERV", "0"),
      vector(4, 1, "CMDSEM", "0"),
      vector(5, 1, "CMD", "0"),
      vector(6, 1, "APM", "99"),
      vector(7, 1, "CMD", "99"),
    ]);

    expect(rows[0].groups.rest.map((item) => item.id)).toEqual([5, 3, 2, 6, 7, 1, 4]);
  });

  it("ignores non-current vectors and vectors whose post is not listed", () => {
    const oldVector = { ...vector(1, 1, "APM", "0"), is_current: false };
    const rows = buildPostDashboardRows([post(1, "Post")], [oldVector, vector(2, 9, "APM", "0")]);
    expect(rows[0].groups.apm).toEqual([]);
  });

  it("returns all five groups in a stable group record", () => {
    const rows = buildPostDashboardRows([post(1, "Post")], []);
    const keys: DashboardGroupKey[] = ["apm", "ae", "amb", "rest", "special"];
    expect(Object.keys(rows[0].groups)).toEqual(keys);
  });
});
