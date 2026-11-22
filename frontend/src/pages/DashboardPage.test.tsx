import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, subscribeToCityGIS, type CityGISLocation, type CityGISSnapshot, type CityGISVector } from "@/lib/api";
import { DashboardPage } from "@/pages/DashboardPage";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, listLocations: vi.fn(), getCityGIS: vi.fn() }, subscribeToCityGIS: vi.fn() };
});

vi.mock("@/components/CityGISStatusHistoryDialog", () => ({
  CityGISStatusHistoryDialog: ({ vectorId, vectorLabel }: { vectorId: number; vectorLabel: string }) => <div role="dialog">Historiek {vectorId} · {vectorLabel}</div>,
}));

const post: CityGISLocation = { id: 1, name: "Helihaven", sort_name: "01.01", kind: "post", parent_id: null, service_id: 1 };
const locations: CityGISLocation[] = [post];

function vector(id: number, type: string, status: string, code = `V-${id}`, vehicle = `A${id}`): CityGISVector {
  return {
    id,
    managed_object: { id, kind: "vector" },
    vector_code: code,
    name: code,
    abbreviation: code,
    service_abbreviation: "HEL",
    service: { id: 1, abbreviation: "HEL" },
    post,
    resource_type_code: type,
    resource_code: type,
    operational_status_code: status,
    status_description: `Status ${status}`,
    status_abbreviation: status,
    status_updated_at: null,
    status_color: "#00ff00",
    vehicle: { id, managed_object: { id, kind: "vehicle" }, fireplan_id: id, alphacode: vehicle, plate: "", utilisation: "", chassis: "", fleet_status: "", is_current: true, last_seen_at: null },
    source_vehicle_name: vehicle,
    is_current: true,
    last_seen_at: null,
  };
}

const snapshot: CityGISSnapshot = {
  vehicles: [],
  vectors: [vector(1, "APM", "0", "P-HEL", "P47"), vector(2, "AMB", "6", "A-HEL", "A47"), vector(3, "AMB", "5", "AMBINC", "A48")],
  statuses: [
    { code: "0", description: "Vrij", abbreviation: "Vrij", color: "#00ff00" },
    { code: "5", description: "Onderweg", abbreviation: "Onderweg", color: "#ff0000" },
    { code: "6", description: "Beschikbaar", abbreviation: "Beschikbaar", color: "#00ff00" },
  ],
  last_refreshed_at: "2026-11-22T12:00:00Z",
  sync_state: { last_attempted_at: null, last_succeeded_at: "2026-11-22T12:00:00Z", last_error: null },
};

const mockedApi = vi.mocked(api);
const mockedSubscribe = vi.mocked(subscribeToCityGIS);
let emitSnapshot: ((value: CityGISSnapshot) => void) | undefined;
let emitError: (() => void) | undefined;

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitSnapshot = undefined;
    emitError = undefined;
    mockedApi.listLocations.mockResolvedValue(locations);
    mockedApi.getCityGIS.mockResolvedValue(snapshot);
    mockedSubscribe.mockImplementation((onUpdate, onError) => {
      emitSnapshot = onUpdate;
      emitError = onError;
      return vi.fn();
    });
  });

  it("loads the post overview and replaces generic task dashboard content", async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText("Posten en voertuigen laden…")).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /Helihaven/ })).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Helihaven/ });
    expect(within(row).getAllByRole("cell")[1]).toBeEmptyDOMElement();
    expect(screen.getByText("P47")).toBeInTheDocument();
    expect(screen.getByText("P-HEL")).toBeInTheDocument();
    expect(screen.queryByText("01.01")).not.toBeInTheDocument();
    expect(screen.getByText("P-HEL")).toHaveClass("break-words");
    expect(screen.getByRole("columnheader", { name: /APM/ })).toHaveTextContent("1/1");
    expect(screen.getByRole("columnheader", { name: /AMB/ })).toHaveTextContent("1/2");
    expect(screen.queryByText("Recent background tasks")).not.toBeInTheDocument();
  });

  it("shows all five ambulances within three two-column rows and expands larger cells", async () => {
    const user = userEvent.setup();
    const ambulances = [1, 2, 3, 4, 5, 6, 7].map((id) => vector(id, "AMB", "0", `AMB-${id}`, `A${id}`));
    mockedApi.getCityGIS.mockResolvedValueOnce({ ...snapshot, vectors: ambulances });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await screen.findByText("A1");

    const row = screen.getByRole("row", { name: /Helihaven/ });
    const ambCell = within(row).getByRole("cell", { name: /AMB/ });
    for (const vehicle of ["A1", "A2", "A3", "A4", "A5", "A6"]) expect(within(ambCell).getByText(vehicle)).toBeInTheDocument();
    expect(within(ambCell).queryByText("A7")).not.toBeInTheDocument();
    await user.click(within(ambCell).getByRole("button", { name: /Toon/ }));
    expect(within(ambCell).getByText("A7")).toBeInTheDocument();
  });

  it("opens status history for the clicked vector", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await screen.findByText("P47");
    const statusButton = screen.getByRole("button", { name: /P47.*status 0/ });
    expect(statusButton.firstElementChild).toHaveStyle({ backgroundColor: "#00ff00" });
    await user.click(statusButton);
    expect(screen.getByRole("dialog")).toHaveTextContent("Historiek 1 · P-HEL");
  });

  it("applies live updates and keeps the last data visible when disconnected", async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText("P47")).toBeInTheDocument();
    act(() => emitError?.());
    expect(screen.getByText(/Liveverbinding tijdelijk onderbroken/)).toBeInTheDocument();
    act(() => emitSnapshot?.({ ...snapshot, vectors: [vector(4, "AE", "6", "E-HEL", "E47")] }));
    expect(await screen.findByText("E47")).toBeInTheDocument();
    expect(screen.queryByText(/Liveverbinding tijdelijk onderbroken/)).not.toBeInTheDocument();
  });

  it("shows status colors as a narrow vertical line and keeps status details accessible", async () => {
    const twoDigit = { ...vector(11, "APM", "90", "P-90", "P90"), status_color: "#0000ff" };
    const unknown = { ...vector(12, "APM", "77", "P-77", "P77"), status_color: "#00ff00" };
    mockedApi.getCityGIS.mockResolvedValueOnce({
      ...snapshot,
      vectors: [twoDigit, unknown],
      statuses: [...snapshot.statuses, { code: "90", description: "Buiten dienst", abbreviation: "BD", color: "#0000ff" }],
    });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    const status90 = await screen.findByRole("button", { name: /P90.*status 90/ });
    expect(status90).not.toHaveTextContent("90");
    expect(status90).toHaveAttribute("title", expect.stringContaining("90"));
    expect(status90.firstElementChild).toHaveClass("w-[6px]");
    expect(status90.parentElement).toHaveClass("gap-1");
    expect(status90.firstElementChild).toHaveClass("rounded-none");
    expect(status90.firstElementChild).toHaveStyle({ backgroundColor: "#0000ff" });
    const unknownStatus = screen.getByRole("button", { name: /P77.*status \?/ });
    expect(unknownStatus).not.toHaveTextContent("77");
    expect(unknownStatus).toHaveAttribute("title", expect.stringContaining("Status ?"));
    expect(unknownStatus.firstElementChild).toHaveStyle({ backgroundColor: "#E5E7EB" });
    expect(unknownStatus.parentElement).not.toHaveClass("border-b");
  });

  it("uses at most three Rest columns", async () => {
    const restVectors = [1, 2, 3, 4].map((id) => vector(id, "CMD", "0", `CMD-${id}`, `C${id}`));
    mockedApi.getCityGIS.mockResolvedValueOnce({ ...snapshot, vectors: restVectors });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await screen.findByText("C1");
    const row = screen.getByRole("row", { name: /Helihaven/ });
    const restCell = within(row).getAllByRole("cell")[3];
    expect(restCell.querySelector("[style*='grid-template-columns']")).toHaveStyle({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" });
  });

  it("explains when a post has no current vectors", async () => {
    mockedApi.getCityGIS.mockResolvedValueOnce({ ...snapshot, vectors: [] });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText("Er zijn nog geen actuele vectoren voor deze posten.")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Helihaven/ })).toBeInTheDocument();
  });

  it("shows empty-post, API-error and retry states", async () => {
    const user = userEvent.setup();
    mockedApi.listLocations.mockRejectedValueOnce(new Error("Toegang geweigerd"));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Toegang geweigerd");
    await user.click(screen.getByRole("button", { name: "Opnieuw proberen" }));
    expect(await screen.findByRole("row", { name: /Helihaven/ })).toBeInTheDocument();

    mockedApi.listLocations.mockResolvedValueOnce([]);
    await user.click(screen.getByRole("button", { name: "Postenoverzicht vernieuwen" }));
    expect(await screen.findByText("Geen posten gevonden")).toBeInTheDocument();
  });
});
