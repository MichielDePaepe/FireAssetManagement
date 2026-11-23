import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { FireplanInventoryDetail, FireplanInventoryPage } from "@/lib/api";
import { FireplanInventoriesPage } from "@/pages/FireplanInventoriesPage";
import { FireplanInventoryDetailPage } from "@/pages/FireplanInventoryDetailPage";

vi.mock("@/lib/api", () => ({
  api: {
    getFireplanInventories: vi.fn(),
    getFireplanInventoryDetail: vi.fn(),
    startFireplanInventorySync: vi.fn(),
    startFireplanInventoryResync: vi.fn(),
  },
}));

const inventoryPage: FireplanInventoryPage = {
  count: 2,
  page: 1,
  page_size: 25,
  results: [
    {
      uuid: "inv-1",
      vehicle_alpha_code: "AMB-1",
      inventory_type_name: "Inventory close",
      done_in_name: "Post A",
      done_by_full_name: "Operator",
      overseen_by_full_name: "Supervisor",
      created_at: "2026-11-20T08:00:00+01:00",
      closed_at: "2026-11-20T09:00:00+01:00",
      updated_at: "2026-11-20T09:00:00+01:00",
      has_incident_reports: false,
      is_complete_after_completion: true,
      is_complete_before_completion: false,
      is_quantity_count_excluded: false,
      is_test_standard: false,
      remaining_missing_followed_count: 0,
      sync_status: "not_synced",
      last_successful_sync_at: null,
      last_error: "",
      vector_code: "V-HISTORY",
      vector_name: "History",
    },
    {
      uuid: "inv-synced",
      vehicle_alpha_code: "AMB-2",
      inventory_type_name: "Inventory close",
      done_in_name: "Post B",
      done_by_full_name: "Operator B",
      overseen_by_full_name: "Supervisor B",
      created_at: "2026-11-20T08:00:00+01:00",
      closed_at: "2026-11-20T09:00:00+01:00",
      updated_at: "2026-11-20T09:00:00+01:00",
      has_incident_reports: false,
      is_complete_after_completion: true,
      is_complete_before_completion: false,
      is_quantity_count_excluded: false,
      is_test_standard: false,
      remaining_missing_followed_count: 0,
      sync_status: "synced",
      last_successful_sync_at: "2026-11-20T10:00:00+01:00",
      last_error: "",
      vector_code: "V-LOCAL",
      vector_name: "Local vector",
    },
  ],
};

const inventoryDetail: FireplanInventoryDetail = {
  uuid: "inv-synced",
  vehicle_alpha_code: "AMB-2",
  inventory_type_name: "Inventory close",
  done_in_name: "Post B",
  done_by_full_name: "Operator B",
  overseen_by_full_name: "Supervisor B",
  source_created_at: "2026-11-20T08:00:00+01:00",
  source_closed_at: "2026-11-20T09:00:00+01:00",
  source_updated_at: "2026-11-20T09:00:00+01:00",
  has_incident_reports: false,
  is_complete_after_completion: true,
  is_complete_before_completion: false,
  is_quantity_count_excluded: false,
  is_test_standard: false,
  remaining_missing_followed_count: 0,
  vehicle: { alphacode: "AMB-2", fireplan_id: 502 },
  vector: { vector_code: "V-LOCAL", name: "Local vector", abbreviation: "LV" },
  sync_status: "failed",
  last_attempted_at: "2026-11-21T09:00:00+01:00",
  last_successful_sync_at: "2026-11-20T10:00:00+01:00",
  last_error: "FirePlan tijdelijk onbeschikbaar",
  radio_items: [{ fireplan_item_id: "item-1", serial_number: "00001234" }],
  radio_observations: [
    { fireplan_item_id: "item-1", item_type_id: 1010, serial_number: "12345678901234", radio: { id: 5, tei: "123456789012340", issi_alias: "Ploeg Alfa", is_active: true } },
    { fireplan_item_id: "item-2", item_type_id: 1010, serial_number: "987654321098765", radio: { id: 6, tei: "987654321098765", issi_alias: null, is_active: false } },
    { fireplan_item_id: "item-unmatched", item_type_id: 1010, serial_number: "unmatched-value", radio: null },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/fireplan/inventories"]}>
      <Routes>
        <Route path="/fireplan/inventories" element={<FireplanInventoriesPage />} />
        <Route path="/fireplan/inventories/:inventoryUuid" element={<FireplanInventoryDetailPage />} />
        <Route path="/tasks/:taskId" element={<p>Taakdetail <span data-testid="task-id" /></p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FireplanInventoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getFireplanInventories).mockResolvedValue(inventoryPage);
    vi.mocked(api.getFireplanInventoryDetail).mockResolvedValue(inventoryDetail);
    vi.mocked(api.startFireplanInventoryResync).mockResolvedValue({
      task_id: "single-inventory-task",
      status: "PENDING",
    });
  });

  it("shows loading, source rows, unsynced status, and the updatedAt limitation", async () => {
    let resolvePage!: (value: typeof inventoryPage) => void;
    vi.mocked(api.getFireplanInventories).mockReturnValue(
      new Promise((resolve) => { resolvePage = resolve; }),
    );
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Inventarissen laden");
    resolvePage(inventoryPage);

    expect(await screen.findByText("AMB-1")).toBeInTheDocument();
    expect(screen.getByText("Niet gesynchroniseerd")).toBeInTheDocument();
    expect(screen.getByText(/updatedAt.*niet bevestigd/)).toBeInTheDocument();
    expect(api.getFireplanInventories).toHaveBeenCalledWith(1, 25);
  });

  it("shows stored and historical vectors and only links synced inventories", async () => {
    renderPage();

    expect(await screen.findByText("History")).toBeInTheDocument();
    expect(screen.getByText("Local vector")).toBeInTheDocument();
    expect(screen.queryByText("V-HISTORY")).not.toBeInTheDocument();
    expect(screen.queryByText("V-LOCAL")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Type" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /AMB-2/ })).toHaveAttribute(
      "href",
      "/fireplan/inventories/inv-synced",
    );
    expect(screen.queryByRole("link", { name: /AMB-1/ })).not.toBeInTheDocument();
  });

  it("opens the local snapshot and shows each observation's raw radio JSON in a modal", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("link", { name: /AMB-2/ }));

    expect(await screen.findByRole("heading", { name: "FirePlan-inventaris" })).toBeInTheDocument();
    expect(api.getFireplanInventoryDetail).toHaveBeenCalledWith("inv-synced");
    expect(screen.getByRole("alert")).toHaveTextContent("FirePlan tijdelijk onbeschikbaar");
    expect(screen.queryByText(/"serial_number": "00001234"/)).not.toBeInTheDocument();
    expect(screen.getByText("V-LOCAL")).toBeInTheDocument();
    expect(screen.getAllByText("123456789012340")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Ploeg Alfa/ })).toHaveAttribute("href", "/radios/5");
    const activeRadioIcon = screen.getByRole("link", { name: /Ploeg Alfa/ }).querySelector("svg.lucide-radio")?.parentElement;
    expect(activeRadioIcon).toHaveClass("text-emerald-700");
    const inactiveRadioIcon = screen.getByRole("link", { name: /987654321098765/ }).querySelector("svg.lucide-radio")?.parentElement;
    expect(inactiveRadioIcon).toHaveClass("text-red-700");
    expect(screen.getByText("Niet gekoppeld")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ruwe JSON bekijken voor item-1" }));
    expect(screen.getByRole("dialog", { name: "Radio-observatie · item-1" })).toHaveTextContent('"serial_number": "00001234"');
  });

  it("starts a targeted sync from the detail page and opens existing task progress", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("link", { name: /AMB-2/ }));
    await user.click(await screen.findByRole("button", { name: "Inventaris opnieuw synchroniseren" }));

    await waitFor(() => expect(api.startFireplanInventoryResync).toHaveBeenCalledWith("inv-synced"));
    expect(await screen.findByText("Taakdetail")).toBeInTheDocument();
    expect(localStorage.getItem("activeTaskId")).toBe("single-inventory-task");
  });

  it("disables the sync button while the targeted task is being queued", async () => {
    const user = userEvent.setup();
    let resolveTask!: (value: { task_id: string; status: "PENDING" }) => void;
    vi.mocked(api.startFireplanInventoryResync).mockReturnValue(
      new Promise((resolve) => { resolveTask = resolve; }),
    );
    renderPage();
    await user.click(await screen.findByRole("link", { name: /AMB-2/ }));
    const syncButton = await screen.findByRole("button", { name: "Inventaris opnieuw synchroniseren" });
    await user.click(syncButton);

    expect(syncButton).toBeDisabled();
    resolveTask({ task_id: "single-inventory-task", status: "PENDING" });
    expect(await screen.findByText("Taakdetail")).toBeInTheDocument();
  });

  it("shows a sync-start error accessibly on the detail page", async () => {
    const user = userEvent.setup();
    vi.mocked(api.startFireplanInventoryResync).mockRejectedValue(new Error("Taak starten mislukt"));
    renderPage();
    await user.click(await screen.findByRole("link", { name: /AMB-2/ }));
    await user.click(await screen.findByRole("button", { name: "Inventaris opnieuw synchroniseren" }));

    expect(await screen.findByText("Taak starten mislukt")).toBeInTheDocument();
  });

  it("shows empty and API error states", async () => {
    vi.mocked(api.getFireplanInventories).mockResolvedValue({
      count: 0,
      page: 1,
      page_size: 25,
      results: [],
    });
    const empty = renderPage();
    expect(await screen.findByText("Geen FirePlan-inventarissen gevonden.")).toBeInTheDocument();
    empty.unmount();

    vi.mocked(api.getFireplanInventories).mockRejectedValue(new Error("FirePlan niet bereikbaar"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("FirePlan niet bereikbaar");
  });

  it("paginates through source summaries on the server", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getFireplanInventories)
      .mockResolvedValueOnce({ ...inventoryPage, count: 30 })
      .mockResolvedValueOnce({ ...inventoryPage, page: 2, count: 30 });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Volgende pagina" }));

    await waitFor(() => expect(api.getFireplanInventories).toHaveBeenLastCalledWith(2, 25));
    expect(screen.getByText("Pagina 2 van 2")).toBeInTheDocument();
  });

  it("rejects missing or reversed periods before calling the API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Herverwerk periode" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vul zowel een begindatum als einddatum in.");

    await user.type(screen.getByLabelText("Begindatum"), "2026-11-21");
    await user.type(screen.getByLabelText("Einddatum"), "2026-11-20");
    await user.click(screen.getByRole("button", { name: "Herverwerk periode" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Begindatum moet op of voor de einddatum liggen.");
    expect(api.startFireplanInventorySync).not.toHaveBeenCalled();
  });

  it("starts a valid inclusive period and opens the existing task detail page", async () => {
    const user = userEvent.setup();
    vi.mocked(api.startFireplanInventorySync).mockResolvedValue({
      task_id: "inventory-task-42",
      status: "PENDING",
    });
    renderPage();

    await user.type(await screen.findByLabelText("Begindatum"), "2026-11-01");
    await user.type(screen.getByLabelText("Einddatum"), "2026-11-30");
    await user.click(screen.getByRole("button", { name: "Herverwerk periode" }));

    await waitFor(() => expect(api.startFireplanInventorySync).toHaveBeenCalledWith(
      "2026-11-01",
      "2026-11-30",
    ));
    expect(await screen.findByText("Taakdetail")).toBeInTheDocument();
  });
});
