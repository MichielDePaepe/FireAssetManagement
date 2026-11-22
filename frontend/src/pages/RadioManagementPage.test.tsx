import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type CityGISSnapshot, type RadioModel } from "@/lib/api";
import { RadioManagementPage } from "@/pages/RadioManagementPage";
import { RadioDetailPage } from "@/pages/RadioDetailPage";

const authState = vi.hoisted(() => ({ isStaff: true }));
const mockedNavigate = vi.hoisted(() => vi.fn());
vi.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({ user: { is_staff: authState.isStaff } }) }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-router-dom")>(),
  useNavigate: () => mockedNavigate,
}));
vi.mock("@/components/PagerScanControl", () => ({
  PagerScanControl: ({ onScan, subject }: { onScan: (scan: string) => void; subject?: string }) => <button type="button" onClick={() => onScan("sample scan")}>Simuleer {subject} scan</button>,
}));
vi.mock("@/lib/api", () => ({
  api: {
    listRadios: vi.fn(), getRadio: vi.fn(), createRadio: vi.fn(), updateRadio: vi.fn(), deleteRadio: vi.fn(),
    listIssis: vi.fn(), createIssi: vi.fn(), updateIssi: vi.fn(), deleteIssi: vi.fn(),
    listOrganizations: vi.fn(), createOrganization: vi.fn(),
    listRadioModels: vi.fn(), createRadioModel: vi.fn(), listTeiRanges: vi.fn(), createTeiRange: vi.fn(),
    listRadioSubscriptions: vi.fn(), assignRadioSubscription: vi.fn(),
    lookupRadioScan: vi.fn(), startFireplanRadioSync: vi.fn(),
    getRadioRelationship: vi.fn(), updateRadioRelationship: vi.fn(), getCityGIS: vi.fn(), listLocations: vi.fn(),
  },
}));

const sampleRadio = {
  id: 7,
  tei: "00000000000001",
  manufacturer: "Example",
  model_name: "Portable X",
  model: { id: 2, manufacturer: "Example", manufacturer_id: 1, name: "Portable X" } satisfies RadioModel,
  fireplan_id: 4321,
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
  current_subscription: {
    id: 9,
    radio: { id: 7, tei: "00000000000001" },
    issi: { id: 11, issi: "0007654321", alias: "Ploeg A" },
    started_at: "2026-11-20T10:00:00Z",
    ended_at: null,
  },
  subscription_history: [
    {
      id: 9,
      radio: { id: 7, tei: "00000000000001" },
      issi: { id: 11, issi: "0007654321", alias: "Ploeg A" },
      started_at: "2026-11-20T10:00:00Z",
      ended_at: null,
    },
  ],
};
const sampleIssi = {
  id: 11,
  issi: "0007654321",
  alias: "Ploeg A",
  organization: { id: 3, name: "Brandweer Brussel" },
  current_subscription: sampleRadio.current_subscription,
  subscription_history: sampleRadio.subscription_history,
};
const emptyRelationship = { current: null, history: [] as never[] };
const sampleCityGIS = {
  vehicles: [{ id: 50, managed_object: { id: 500, kind: "vehicle" as const }, fireplan_id: 50, alphacode: "A50", plate: "1-ABC-500", utilisation: "", chassis: "", fleet_status: "", is_current: true, last_seen_at: null }],
  vectors: [{ id: 60, managed_object: { id: 600, kind: "vector" as const }, vector_code: "BRU-60", abbreviation: "Ploeg 60", name: "Ploeg 60", service_abbreviation: "BB", service: { id: 1, abbreviation: "BB" }, post: { id: 1, name: "Voorbeeldpost", sort_name: "Voorbeeldpost", kind: "post" as const, parent_id: null, service_id: 1 }, resource_type_code: "", resource_code: "", operational_status_code: "", status_description: null, status_abbreviation: null, status_updated_at: null, status_color: null, vehicle: null, source_vehicle_name: "", is_current: true, last_seen_at: null }],
  statuses: [], last_refreshed_at: null, sync_state: { last_attempted_at: null, last_succeeded_at: null, last_error: null },
} satisfies CityGISSnapshot;

function renderPage() {
  return render(<MemoryRouter initialEntries={["/radios"]}><Routes>
    <Route path="/radios" element={<RadioManagementPage />} />
    <Route path="/radios/:radioId" element={<RadioDetailPage />} />
  </Routes></MemoryRouter>);
}

describe("RadioManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isStaff = true;
    vi.mocked(api.listRadios).mockResolvedValue([sampleRadio]);
    vi.mocked(api.getRadio).mockResolvedValue(sampleRadio);
    vi.mocked(api.listIssis).mockResolvedValue([sampleIssi]);
    vi.mocked(api.listOrganizations).mockResolvedValue([{ id: 3, name: "Brandweer Brussel" }]);
    vi.mocked(api.listRadioModels).mockResolvedValue([sampleRadio.model]);
    vi.mocked(api.listTeiRanges).mockResolvedValue([]);
    vi.mocked(api.listRadioSubscriptions).mockResolvedValue([sampleRadio.current_subscription]);
    vi.mocked(api.getRadioRelationship).mockResolvedValue(emptyRelationship);
    vi.mocked(api.updateRadioRelationship).mockResolvedValue(emptyRelationship);
    vi.mocked(api.getCityGIS).mockResolvedValue(sampleCityGIS);
    vi.mocked(api.listLocations).mockResolvedValue([{ id: 70, name: "Meldkamer", sort_name: "Meldkamer", kind: "room", parent_id: null, service_id: null }]);
  });

  it("shows radio, ISSI and subscription tabs with read-only FirePlan identity", async () => {
    renderPage();

    expect(await screen.findByText("00000000000001")).toBeInTheDocument();
    expect(screen.getByText("4321")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Toestellen" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ISSI's" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Abonnementen" })).toBeInTheDocument();
    expect(screen.queryByLabelText("FirePlan-ID")).not.toBeInTheDocument();
  });

  it("keeps an accessible loading state until the module data arrives", () => {
    vi.mocked(api.listRadios).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Radio-inventaris laden");
  });

  it("filters radio rows on TEI, model, FirePlan ID and active ISSI", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("00000000000001");

    await user.type(screen.getByRole("searchbox", { name: "Radio's zoeken" }), "Ploeg A");
    expect(screen.getByText("00000000000001")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Radio's zoeken" }));
    await user.type(screen.getByRole("searchbox", { name: "Radio's zoeken" }), "nomatch");
    expect(screen.getByText("Geen radio's gevonden.")).toBeInTheDocument();
  });

  it("creates a radio with a text TEI", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createRadio).mockResolvedValue(sampleRadio);
    renderPage();
    await screen.findByText("00000000000001");
    await user.click(screen.getByRole("button", { name: "Radio toevoegen" }));
    await user.type(screen.getByLabelText("TEI"), "00000000000002");
    await user.click(screen.getByRole("button", { name: "Radio opslaan" }));

    await waitFor(() => expect(api.createRadio).toHaveBeenCalledWith(expect.objectContaining({
      tei: "00000000000002",
    })));
  });

  it("shows ISSI search results and subscription details", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "ISSI's" }));
    expect(await screen.findByText("0007654321")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Details ISSI 0007654321" }));
    expect(screen.getByText("Abonnementshistoriek")).toBeInTheDocument();
    expect(screen.getByText("Ploeg A")).toBeInTheDocument();
  });

  it("shows active and ended subscription rows", async () => {
    vi.mocked(api.listRadioSubscriptions).mockResolvedValue([
      sampleRadio.current_subscription,
      { ...sampleRadio.current_subscription, id: 10, ended_at: "2026-11-19T10:00:00Z" },
    ]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Abonnementen" }));
    expect(screen.getAllByText(/Actief/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getAllByText(/Looptijd:/)).toHaveLength(2);
  });

  it("opens the radio detail page after scanner identification", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupRadioScan).mockResolvedValue({ raw_scan: "sample scan", radio: sampleRadio });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Simuleer Radio scan" }));
    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith("/radios/7"));
    expect(api.assignRadioSubscription).not.toHaveBeenCalled();
    expect(api.updateRadioRelationship).not.toHaveBeenCalled();
  });

  it("saves a directly selected vector placement and shows its history", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateRadioRelationship).mockResolvedValue({
      current: { id: 20, kind: "assigned_to", target: { id: 600, kind: "vector" }, location: null, started_at: "2026-11-21T10:00:00Z", ended_at: null },
      history: [{ id: 20, kind: "assigned_to", target: { id: 600, kind: "vector" }, location: null, started_at: "2026-11-21T10:00:00Z", ended_at: null }],
    });
    renderPage();
    await screen.findByText("00000000000001");
    await user.click(screen.getByRole("link", { name: "Details radio 00000000000001" }));
    await user.selectOptions(await screen.findByLabelText("Bestemming"), "assigned_to:object:600");
    await user.click(screen.getByRole("button", { name: "Plaatsing bewaren" }));
    await waitFor(() => expect(api.updateRadioRelationship).toHaveBeenCalledWith(7, {
      kind: "assigned_to", target_object_id: 600, location_id: null,
    }));
    expect(screen.getAllByText(/Ploeg 60 · Voorbeeldpost/).length).toBeGreaterThan(1);
    expect(screen.getByText("Plaatsingshistoriek")).toBeInTheDocument();
  });

  it("shows placement validation failures accessibly", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateRadioRelationship).mockRejectedValue(new Error("Kies een geldige vector."));
    renderPage();
    await screen.findByText("00000000000001");
    await user.click(screen.getByRole("link", { name: "Details radio 00000000000001" }));
    await user.selectOptions(await screen.findByLabelText("Bestemming"), "assigned_to:object:600");
    await user.click(screen.getByRole("button", { name: "Plaatsing bewaren" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Kies een geldige vector.");
  });

  it("starts FirePlan radio sync and opens the existing task screen", async () => {
    const user = userEvent.setup();
    mockedNavigate.mockClear();
    vi.mocked(api.startFireplanRadioSync).mockResolvedValue({ task_id: "radio-sync-1", status: "PENDING" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Synchroniseer met FirePlan" }));
    await waitFor(() => expect(api.startFireplanRadioSync).toHaveBeenCalledOnce());
    expect(window.localStorage.getItem("activeFireplanSyncId")).toBe("radio-sync-1");
    expect(mockedNavigate).toHaveBeenCalledWith("/tasks/radio-sync-1");
  });

  it("shows loading and error states and hides write actions from non-staff", async () => {
    vi.mocked(api.listRadios).mockRejectedValue(new Error("Service niet bereikbaar"));
    authState.isStaff = false;
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Service niet bereikbaar");
    expect(screen.queryByRole("button", { name: "Radio toevoegen" })).not.toBeInTheDocument();
  });
});
