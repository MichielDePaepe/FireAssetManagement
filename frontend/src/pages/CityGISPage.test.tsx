import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, subscribeToCityGIS, type CityGISSnapshot } from "@/lib/api";
import { CityGISPage } from "@/pages/CityGISPage";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, getCityGIS: vi.fn(), startCityGISRefresh: vi.fn() }, subscribeToCityGIS: vi.fn() };
});

const snapshot: CityGISSnapshot = {
  vehicles: [],
  vectors: [{
    id: 10, managed_object: { id: 10, kind: "vector" }, vector_code: "PBANDE02P", name: "AP AND2", abbreviation: "P-AND2",
    service_abbreviation: "AND", resource_type_code: "APM", resource_code: "1-CYX-076",
    service: { id: 1, abbreviation: "AND" }, post: { id: 1, name: "Post Anderlecht", sort_name: "", kind: "post", parent_id: null, service_id: 1 },
    operational_status_code: "3", status_description: "Ter plaatse", status_abbreviation: "Ter pl.",
    status_updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status_color: "#FF0000", vehicle: {
      id: 1, managed_object: { id: 1, kind: "vehicle" }, fireplan_id: 42, alphacode: "P8", plate: "1-ABC-123", utilisation: "Ambulance",
      chassis: "", fleet_status: "Actif", is_current: true, last_seen_at: "2026-11-14T12:00:00Z",
    }, source_vehicle_name: "P8", is_current: true, last_seen_at: "2026-11-14T12:00:00Z",
  }],
  statuses: [{ code: "3", description: "Ter plaatse", abbreviation: "Ter pl.", color: "#FF0000" }],
  last_refreshed_at: "2026-11-14T12:00:00Z",
  sync_state: { last_attempted_at: null, last_succeeded_at: "2026-11-14T12:00:00Z", last_error: null },
};

const mockedApi = vi.mocked(api);
const mockedSubscribe = vi.mocked(subscribeToCityGIS);
let emitSnapshot: ((data: CityGISSnapshot) => void) | undefined;
let emitError: (() => void) | undefined;

describe("CityGISPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitSnapshot = undefined;
    emitError = undefined;
    mockedApi.getCityGIS.mockResolvedValue(snapshot);
    mockedApi.startCityGISRefresh.mockResolvedValue({ task_id: "task-123", status: "PENDING" });
    mockedSubscribe.mockImplementation((onUpdate, onError) => {
      emitSnapshot = onUpdate;
      emitError = onError;
      return vi.fn();
    });
  });

  it("loads vector status and its catalog color", async () => {
    render(<CityGISPage />);
    expect(screen.getByText("CityGIS-gegevens laden…")).toBeInTheDocument();
    expect(await screen.findByText("P-AND2")).toBeInTheDocument();
    expect(screen.getByText("P8")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Dienst/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Type/ })).toBeInTheDocument();
    expect(screen.queryByText("Vlootstatus")).not.toBeInTheDocument();
    expect(screen.queryByText("1-ABC-123")).not.toBeInTheDocument();
    expect(screen.queryByText("1-CYX-076")).not.toBeInTheDocument();
    expect(screen.getByText(/uur geleden/)).toHaveAttribute("title");
    const status = screen.getByText("3 · Ter plaatse");
    expect(status.querySelector("span")).toHaveStyle({ backgroundColor: "#FF0000" });
  });

  it("sorts columns in ascending and descending order", async () => {
    const user = userEvent.setup();
    const secondVector = {
      ...snapshot.vectors[0], id: 11, vector_code: "VEC-2", abbreviation: "P-ZED2",
      service_abbreviation: "ZED", resource_type_code: "APX", source_vehicle_name: "P12", vehicle: null,
    };
    mockedApi.getCityGIS.mockResolvedValueOnce({ ...snapshot, vectors: [snapshot.vectors[0], secondVector] });
    render(<CityGISPage />);
    await screen.findByText("P-AND2");

    const serviceSort = screen.getByRole("button", { name: "Sorteer op Dienst" });
    await user.click(serviceSort);
    const table = screen.getByRole("table");
    let rows = within(table.querySelector("tbody")!).getAllByRole("row");
    expect(within(rows[0]).getByText("AND")).toBeInTheDocument();
    expect(within(rows[1]).getByText("ZED")).toBeInTheDocument();

    await user.click(serviceSort);
    rows = within(table.querySelector("tbody")!).getAllByRole("row");
    expect(within(rows[0]).getByText("ZED")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Dienst/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("filters vectors by service and operational status", async () => {
    const user = userEvent.setup();
    const secondVector = {
      ...snapshot.vectors[0], id: 11, vector_code: "VEC-2", abbreviation: "P-AND3",
      service_abbreviation: "ZED", operational_status_code: "2", status_description: "Vertrek",
      status_abbreviation: "Vertrek", status_color: "#FF9900", source_vehicle_name: "P9", vehicle: null,
    };
    mockedApi.getCityGIS.mockResolvedValueOnce({
      ...snapshot,
      vectors: [snapshot.vectors[0], secondVector],
      statuses: [...snapshot.statuses, { code: "2", description: "Vertrek", abbreviation: "Vertrek", color: "#FF9900" }],
    });
    render(<CityGISPage />);
    await screen.findByText("P-AND2");

    const serviceHeader = screen.getByRole("columnheader", { name: /Dienst/ });
    await user.click(within(serviceHeader).getByRole("button", { name: "Open filter voor Dienst" }));
    await user.click(screen.getByRole("checkbox", { name: "ZED" }));
    expect(screen.queryByRole("group", { name: "Filter op dienst" })).not.toBeInTheDocument();
    await user.click(within(serviceHeader).getByRole("button", { name: /Open filter voor Dienst/ }));
    await user.click(screen.getByRole("checkbox", { name: "AND" }));
    expect(screen.getByText("P-AND3")).toBeInTheDocument();
    expect(screen.getByText("P-AND2")).toBeInTheDocument();

    const statusHeader = screen.getByRole("columnheader", { name: /Operationele status/ });
    await user.click(within(statusHeader).getByRole("button", { name: "Open filter voor Operationele status" }));
    await user.click(screen.getByRole("checkbox", { name: "2 · Vertrek" }));
    await user.click(within(statusHeader).getByRole("button", { name: /Open filter voor Operationele status/ }));
    await user.click(screen.getByRole("checkbox", { name: "3 · Ter plaatse" }));
    expect(screen.getByText("P-AND3")).toBeInTheDocument();
    expect(screen.getByText("P-AND2")).toBeInTheDocument();

    await user.click(within(serviceHeader).getByRole("button", { name: /Open filter voor Dienst/ }));
    await user.click(screen.getByRole("button", { name: "Wissen" }));
    await user.click(within(statusHeader).getByRole("button", { name: /Open filter voor Operationele status/ }));
    await user.click(screen.getByRole("button", { name: "Wissen" }));
    expect(screen.getByText("P-AND2")).toBeInTheDocument();
  });

  it("shows seconds for statuses updated less than a minute ago", async () => {
    mockedApi.getCityGIS.mockResolvedValueOnce({
      ...snapshot,
      vectors: [{ ...snapshot.vectors[0], status_updated_at: new Date(Date.now() - 42_000).toISOString() }],
    });
    render(<CityGISPage />);
    expect(await screen.findByText("42 seconden geleden")).toBeInTheDocument();
  });

  it("keeps the last snapshot visible and explains live/source errors", async () => {
    render(<CityGISPage />);
    expect(await screen.findByText("P-AND2")).toBeInTheDocument();
    act(() => emitError?.());
    expect(screen.getByText(/Liveverbinding tijdelijk onderbroken/)).toBeInTheDocument();
    act(() => emitSnapshot?.({ ...snapshot, sync_state: { ...snapshot.sync_state, last_error: "Bron tijdelijk niet bereikbaar" } }));
    expect(screen.getByText(/De laatst opgeslagen gegevens blijven zichtbaar/)).toBeInTheDocument();
    expect(screen.getByText("P-AND2")).toBeInTheDocument();
  });

  it("shows an initial snapshot loading failure", async () => {
    mockedApi.getCityGIS.mockRejectedValueOnce(new Error("Toegang geweigerd"));
    render(<CityGISPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Toegang geweigerd");
  });

  it("applies live snapshots and starts a manual refresh", async () => {
    const user = userEvent.setup();
    render(<CityGISPage />);
    expect(await screen.findByText("P-AND2")).toBeInTheDocument();
    act(() => emitSnapshot?.({ ...snapshot, vectors: [] }));
    expect(await screen.findByText(/Nog geen vectorgegevens/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nu verversen" }));
    await waitFor(() => expect(mockedApi.startCityGISRefresh).toHaveBeenCalledOnce());
  });
});
