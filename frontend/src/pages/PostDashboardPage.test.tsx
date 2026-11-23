import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, subscribeToCityGIS, type CityGISSnapshot, type LocationOverview } from "@/lib/api";
import { PostDashboardPage } from "@/pages/PostDashboardPage";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, getLocationOverview: vi.fn() }, subscribeToCityGIS: vi.fn() };
});

const post = { id: 1, name: "Helihaven", sort_name: "", kind: "post" as const, parent_id: null, service_id: 1 };
const vector = {
  id: 11,
  managed_object: { id: 11, kind: "vector" as const },
  vector_code: "P-HEL",
  name: "Pomp",
  abbreviation: "P-HEL",
  service_abbreviation: "HEL",
  service: { id: 1, abbreviation: "HEL" },
  post,
  resource_type_code: "APM",
  resource_code: "P47",
  operational_status_code: "0",
  status_description: "Beschikbaar",
  status_abbreviation: "Vrij",
  status_updated_at: null,
  status_color: "#008000",
  vehicle: { id: 21, managed_object: { id: 21, kind: "vehicle" as const }, fireplan_id: 5, alphacode: "P47", plate: "1-AAA-111", utilisation: "Autopomp", chassis: "", fleet_status: "Actief", is_current: true, last_seen_at: null },
  source_vehicle_name: "P47",
  is_current: true,
  last_seen_at: null,
  pagers: [{ id: 31, managed_object: { id: 31, kind: "pager" as const }, serial_number: "PAGER-1", type: { id: 1, name: "Alpha" }, fireplan_id: null, fireplan_qr_url: null, created_at: "", updated_at: "" }],
  radios: [{ id: 41, managed_object: { id: 41, kind: "radio" as const }, tei: "123456789012345", manufacturer: "", model_name: "", model: null, fireplan_id: null, fireplan_qr_url: null, created_at: "", updated_at: "" }],
  status_periods: [],
};
const overview = {
  location: post,
  service: { id: 1, abbreviation: "HEL" },
  status_window: { starts_at: "2026-11-22T12:00:00Z", ends_at: "2026-11-23T12:00:00Z" },
  vectors: [vector],
} as unknown as LocationOverview;
const snapshot = { vectors: [{ ...vector, operational_status_code: "6", status_description: "Ter plaatse" }] } as unknown as CityGISSnapshot;

const mockedApi = vi.mocked(api);
const mockedSubscribe = vi.mocked(subscribeToCityGIS);
let onLiveUpdate: ((value: CityGISSnapshot) => void) | undefined;
let onDisconnect: (() => void) | undefined;

describe("PostDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onLiveUpdate = undefined;
    onDisconnect = undefined;
    mockedApi.getLocationOverview.mockResolvedValue(overview);
    mockedSubscribe.mockImplementation((update, disconnect) => {
      onLiveUpdate = update;
      onDisconnect = disconnect;
      return vi.fn();
    });
  });

  it("shows the selected post, vehicle, and active physical assets", async () => {
    render(<MemoryRouter initialEntries={["/posts/1"]}><Routes><Route path="/posts/:postId" element={<PostDashboardPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Helihaven" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Terug naar postenoverzicht/ })).toHaveAttribute("href", "/");
    expect(screen.getByText("P47")).toBeInTheDocument();
    expect(screen.getByText(/PAGER-1/)).toBeInTheDocument();
    expect(screen.getByText("123456789012345")).toBeInTheDocument();
    expect(screen.queryByText(/RiC|AdC/)).not.toBeInTheDocument();
  });

  it("keeps the detail route live and reports a temporary disconnect", async () => {
    render(<MemoryRouter initialEntries={["/posts/1"]}><Routes><Route path="/posts/:postId" element={<PostDashboardPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("0 · Beschikbaar")).toBeInTheDocument();
    act(() => onDisconnect?.());
    expect(screen.getByText(/Liveverbinding tijdelijk onderbroken/)).toBeInTheDocument();
    act(() => onLiveUpdate?.(snapshot));
    expect(await screen.findByText("6 · Ter plaatse")).toBeInTheDocument();
    expect(screen.queryByText(/Liveverbinding tijdelijk onderbroken/)).not.toBeInTheDocument();
  });

  it("renders period tooltips and four percentages over the full status window", async () => {
    const periods = [
      { status_code: "0", status_description: "Beschikbaar", status_abbreviation: "Vrij", status_color: "#008000", starts_at: "2026-11-22T12:00:00Z", ends_at: "2026-11-23T00:00:00Z", duration_seconds: 43_200, is_unknown: false },
      { status_code: null, status_description: null, status_abbreviation: null, status_color: null, starts_at: "2026-11-23T00:00:00Z", ends_at: "2026-11-23T12:00:00Z", duration_seconds: 43_200, is_unknown: true },
    ];
    mockedApi.getLocationOverview.mockResolvedValueOnce({ ...overview, vectors: [{ ...vector, status_periods: periods }] } as unknown as LocationOverview);
    render(<MemoryRouter initialEntries={["/posts/1"]}><Routes><Route path="/posts/:postId" element={<PostDashboardPage />} /></Routes></MemoryRouter>);

    const segment = await screen.findByRole("button", { name: /0 · Beschikbaar/ });
    expect(segment).toHaveAttribute("title", expect.stringContaining("12 u 0 min"));
    expect(segment).toHaveAttribute("title", expect.stringContaining("22/11/2026"));
    const fiftyPercents = screen.getAllByText("50%", { selector: "span" });
    expect(fiftyPercents[0].closest("p")).toHaveTextContent("Beschikbaar");
    expect(fiftyPercents[1].closest("p")).toHaveTextContent("Onbekend");
    expect(screen.getAllByText("0%")[0].closest("p")).toHaveTextContent("Andere status <90");
    expect(screen.getAllByText("0%")[1].closest("p")).toHaveTextContent("Status 90+");
  });

  it("groups the six main resource types and collapses remaining types", async () => {
    const otherVector = { ...vector, id: 12, vector_code: "OTHER-1", abbreviation: "OTHER-1", resource_type_code: "MISC" };
    mockedApi.getLocationOverview.mockResolvedValueOnce({ ...overview, vectors: [vector, otherVector] } as unknown as LocationOverview);
    render(<MemoryRouter initialEntries={["/posts/1"]}><Routes><Route path="/posts/:postId" element={<PostDashboardPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole("region", { name: "Vectortype APM" })).toBeInTheDocument();
    const others = screen.getByText("Overige vectortypes (1)").closest("details");
    expect(others).not.toHaveAttribute("open");
    const user = userEvent.setup();
    await user.click(screen.getByText("Overige vectortypes (1)"));
    expect(others).toHaveTextContent("OTHER-1");
  });

  it("shows loading, empty, API error, and retry states", async () => {
    const user = userEvent.setup();
    mockedApi.getLocationOverview.mockImplementationOnce(() => new Promise(() => {}));
    const { unmount } = render(<MemoryRouter initialEntries={["/posts/1"]}><Routes><Route path="/posts/:postId" element={<PostDashboardPage />} /></Routes></MemoryRouter>);
    expect(screen.getByText("Postgegevens laden…")).toBeInTheDocument();
    unmount();

    mockedApi.getLocationOverview.mockResolvedValueOnce({ ...overview, vectors: [] } as LocationOverview);
    const view = render(<MemoryRouter initialEntries={["/posts/1"]}><Routes><Route path="/posts/:postId" element={<PostDashboardPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Geen actuele vectoren voor deze post.")).toBeInTheDocument();
    view.unmount();

    mockedApi.getLocationOverview.mockRejectedValueOnce(new Error("Post niet gevonden"));
    render(<MemoryRouter initialEntries={["/posts/1"]}><Routes><Route path="/posts/:postId" element={<PostDashboardPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Post niet gevonden");
    await user.click(screen.getByRole("button", { name: "Opnieuw proberen" }));
    expect(await screen.findByRole("heading", { name: "Helihaven" })).toBeInTheDocument();
  });

  it("lets keyboard users focus a status segment", async () => {
    const user = userEvent.setup();
    const statusPeriod = { status_code: "0", status_description: "Beschikbaar", status_abbreviation: "Vrij", status_color: "#008000", starts_at: "2026-11-22T12:00:00Z", ends_at: "2026-11-23T12:00:00Z", duration_seconds: 86_400, is_unknown: false };
    mockedApi.getLocationOverview.mockResolvedValueOnce({ ...overview, vectors: [{ ...vector, status_periods: [statusPeriod] }] } as unknown as LocationOverview);
    render(<MemoryRouter initialEntries={["/posts/1"]}><Routes><Route path="/posts/:postId" element={<PostDashboardPage />} /></Routes></MemoryRouter>);
    const segment = await screen.findByRole("button", { name: /0 · Beschikbaar/ });
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(segment);
  });
});
