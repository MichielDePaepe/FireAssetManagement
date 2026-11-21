import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { FireplanInventoryPage } from "@/lib/api";
import { FireplanInventoriesPage } from "@/pages/FireplanInventoriesPage";

vi.mock("@/lib/api", () => ({
  api: {
    getFireplanInventories: vi.fn(),
    startFireplanInventorySync: vi.fn(),
  },
}));

const inventoryPage: FireplanInventoryPage = {
  count: 1,
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
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/fireplan/inventories"]}>
      <Routes>
        <Route path="/fireplan/inventories" element={<FireplanInventoriesPage />} />
        <Route path="/tasks/:taskId" element={<p>Taakdetail <span data-testid="task-id" /></p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FireplanInventoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getFireplanInventories).mockResolvedValue(inventoryPage);
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
