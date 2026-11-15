import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagersPage } from "@/pages/PagersPage";
import { api } from "@/lib/api";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/api", () => ({
  api: {
    listPagers: vi.fn(),
    listPagerTypes: vi.fn(),
    createPager: vi.fn(),
    updatePager: vi.fn(),
    deletePager: vi.fn(),
    listRicCodes: vi.fn(),
    createRicCode: vi.fn(),
    updateRicCode: vi.fn(),
    deleteRicCode: vi.fn(),
    startFireplanSync: vi.fn(),
  },
}));

const authState = vi.hoisted(() => ({ isStaff: true }));
vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { is_staff: authState.isStaff } }),
}));

function CurrentPath() {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
}

function renderPage() {
  return render(<MemoryRouter><PagersPage /><CurrentPath /></MemoryRouter>);
}

const types = [
  { id: 1, name: "Swissphone s.QUAD X35" },
  { id: 2, name: "Swissphone RES.Q XS" },
];

const samplePager = {
  id: 10,
  managed_object: { id: 10, kind: "pager" as const },
  serial_number: "SN-123",
  type: types[0],
  created_at: "2026-11-13T10:00:00Z",
  updated_at: "2026-11-13T10:00:00Z",
};

describe("PagersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    authState.isStaff = true;
    vi.mocked(api.listPagers).mockResolvedValue([samplePager]);
    vi.mocked(api.listPagerTypes).mockResolvedValue(types);
    vi.mocked(api.listRicCodes).mockResolvedValue([]);
  });

  it("shows the pager list and its type", async () => {
    renderPage();
    expect(await screen.findByText("SN-123")).toBeInTheDocument();
    expect(screen.getByText("Swissphone s.QUAD X35")).toBeInTheDocument();
  });

  it("creates a pager from the add form", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createPager).mockResolvedValue({ ...samplePager, serial_number: "SN-456" });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Pager toevoegen" }));
    await user.type(screen.getByLabelText("Serienummer"), "SN-456");
    await user.selectOptions(screen.getByLabelText("Type"), "2");
    await user.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() =>
      expect(api.createPager).toHaveBeenCalledWith({ serial_number: "SN-456", type_id: 2 }),
    );
    expect(toast.success).toHaveBeenCalledWith("Pager toegevoegd.");
  });

  it("opens the edit form with the selected pager values", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Bewerk pager SN-123" }));
    expect(screen.getByRole("dialog", { name: "Toestel bewerken" })).toBeInTheDocument();
    expect(screen.getByLabelText("Serienummer")).toHaveValue("SN-123");
    expect(screen.getByLabelText("Type")).toHaveValue("1");
  });

  it("manages standalone RiC and AdC codes", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createRicCode).mockResolvedValue({
      id: 45,
      ric_code: "760711",
      adc_code: "652711",
      alias: "A HELI 1",
    });
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "RiC-codes" }));
    await user.click(screen.getByRole("button", { name: "RiC-code toevoegen" }));
    expect(screen.getByRole("dialog", { name: "RiC-code toevoegen" })).toBeInTheDocument();
    await user.type(await screen.findByLabelText("RiC-code"), "760711");
    await user.type(screen.getByLabelText("AdC-code"), "652711");
    await user.type(screen.getByLabelText("Alias"), "A HELI 1");
    await user.click(screen.getByRole("button", { name: "Code toevoegen" }));

    await waitFor(() => expect(api.createRicCode).toHaveBeenCalledWith({
      ric_code: "760711",
      adc_code: "652711",
      alias: "A HELI 1",
    }));
    expect(api.listRicCodes).toHaveBeenCalled();
  });

  it("opens a RiC-code edit modal with the current values", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listRicCodes).mockResolvedValue([
      { id: 5, ric_code: "760796", adc_code: "652747", alias: "A HSP 1" },
    ]);
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "RiC-codes" }));
    await user.click(await screen.findByRole("button", { name: "Bewerk code A HSP 1" }));

    expect(screen.getByRole("dialog", { name: "RiC-code bewerken" })).toBeInTheDocument();
    expect(screen.getByLabelText("RiC-code")).toHaveValue("760796");
    expect(screen.getByLabelText("AdC-code")).toHaveValue("652747");
    expect(screen.getByLabelText("Alias")).toHaveValue("A HSP 1");
  });

  it("shows an error when the pager list cannot be loaded", async () => {
    vi.mocked(api.listPagers).mockRejectedValue(new Error("Server niet bereikbaar"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Server niet bereikbaar");
  });

  it("shows the Fireplan sync control only to staff", async () => {
    const firstView = renderPage();
    expect(await screen.findByRole("button", { name: "Synchroniseer met Fireplan" })).toBeInTheDocument();

    firstView.unmount();
    authState.isStaff = false;
    renderPage();
    expect(await screen.findByText("SN-123")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Synchroniseer met Fireplan" })).not.toBeInTheDocument();
  });

  it("queues Fireplan sync, stores its task ID and opens task detail", async () => {
    const user = userEvent.setup();
    vi.mocked(api.startFireplanSync).mockResolvedValue({ task_id: "sync-123", status: "PENDING" });
    const view = renderPage();

    await user.click(await screen.findByRole("button", { name: "Synchroniseer met Fireplan" }));

    await waitFor(() => expect(api.startFireplanSync).toHaveBeenCalledOnce());
    expect(window.localStorage.getItem("activeFireplanSyncId")).toBe("sync-123");
    await waitFor(() =>
      expect(screen.getByLabelText("Current path")).toHaveTextContent("/tasks/sync-123"),
    );

    view.unmount();
    authState.isStaff = true;
    renderPage();
    expect(await screen.findByRole("link", { name: "Laatste synchronisatie" })).toHaveAttribute(
      "href",
      "/tasks/sync-123",
    );
  });

  it("shows a helpful error when Fireplan sync cannot be queued", async () => {
    const user = userEvent.setup();
    vi.mocked(api.startFireplanSync).mockRejectedValue(new Error("Fireplan-sessie ongeldig"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Synchroniseer met Fireplan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fireplan-sessie ongeldig");
  });
});
