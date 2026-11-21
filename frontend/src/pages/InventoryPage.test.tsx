import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { InventoryPage } from "@/pages/InventoryPage";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getInventory: vi.fn(),
      scanPager: vi.fn(),
      updatePagerVector: vi.fn(),
      updateRicCodeVector: vi.fn(),
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const inventory = {
  locations: [
    { id: 1, name: "Post Anderlecht", sort_name: "", kind: "post" as const, parent_id: null, service_id: 1 },
    { id: 2, name: "Dispatch", sort_name: "", kind: "room" as const, parent_id: null, service_id: 2 },
  ],
  vectors: [
    {
      id: 10,
      managed_object: { id: 10, kind: "vector" as const },
      vector_code: "VEC-1",
      name: "Ambulance",
      abbreviation: "P-AND2",
      service_abbreviation: "AND",
      service: { id: 1, abbreviation: "AND" },
      post: { id: 1, name: "Post Anderlecht", sort_name: "", kind: "post" as const, parent_id: null, service_id: 1 },
      resource_type_code: "APM",
      resource_code: "SOURCE-CODE",
      operational_status_code: "3",
      status_description: "Ter plaatse",
      status_abbreviation: "Ter pl.",
      status_updated_at: null,
      status_color: "#00FF00",
      vehicle: {
        id: 4,
        managed_object: { id: 4, kind: "vehicle" as const },
        fireplan_id: 42,
        alphacode: "P8",
        plate: "1-ABC-123",
        utilisation: "Ambulance",
        chassis: "",
        fleet_status: "Actief",
        is_current: true,
        last_seen_at: null,
      },
      source_vehicle_name: "P8",
      is_current: true,
      last_seen_at: null,
    },
    {
      id: 11,
      managed_object: { id: 11, kind: "vector" as const },
      vector_code: "VEC-2",
      name: "Dispatch resource",
      abbreviation: "DISP1",
      service_abbreviation: "DISP",
      service: { id: 2, abbreviation: "DISP" },
      post: null,
      resource_type_code: "APM",
      resource_code: "SOURCE-CODE-2",
      operational_status_code: "0",
      status_description: "Beschikbaar",
      status_abbreviation: "Beschikbaar",
      status_updated_at: null,
      status_color: "#00FF00",
      vehicle: null,
      source_vehicle_name: "",
      is_current: true,
      last_seen_at: null,
    },
    {
      id: 12,
      managed_object: { id: 12, kind: "vector" as const },
      vector_code: "OLD-1",
      name: "Retired dispatch resource",
      abbreviation: "OLD1",
      service_abbreviation: "OLD",
      service: { id: 3, abbreviation: "OLD" },
      post: null,
      resource_type_code: "APM",
      resource_code: "OLD-SOURCE",
      operational_status_code: "0",
      status_description: "Niet meer gemeld",
      status_abbreviation: "Oud",
      status_updated_at: null,
      status_color: "#999999",
      vehicle: null,
      source_vehicle_name: "",
      is_current: false,
      last_seen_at: null,
    },
  ],
  pagers: [
    {
      id: 1,
      managed_object: { id: 20, kind: "pager" as const },
      serial_number: "SN-1",
      type: { id: 1, name: "TETRA" },
      created_at: "2026-11-15T12:00:00Z",
      updated_at: "2026-11-15T12:00:00Z",
      assigned_vector_id: 10,
    },
    {
      id: 2,
      managed_object: { id: 21, kind: "pager" as const },
      serial_number: "SN-2",
      type: { id: 1, name: "TETRA" },
      created_at: "2026-11-15T12:00:00Z",
      updated_at: "2026-11-15T12:00:00Z",
      assigned_vector_id: null,
    },
  ],
  ric_codes: [
    { id: 7, ric_code: "123456", adc_code: "234567", alias: "Dispatch AND", vector_id: 10 },
    { id: 8, ric_code: "123457", adc_code: "234568", alias: "Spare code", vector_id: null },
  ],
};

const mockedApi = vi.mocked(api);

describe("InventoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getInventory.mockResolvedValue(inventory);
    mockedApi.scanPager.mockResolvedValue({ raw_scan: "QR-1", pager: inventory.pagers[0] });
    mockedApi.updatePagerVector.mockResolvedValue({ vector_id: 10 });
    mockedApi.updateRicCodeVector.mockResolvedValue({ vector_id: 10 });
  });

  it("opens the existing pager dialog after scanning a registered pager", async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);
    await screen.findByRole("heading", { name: "Toewijzingen" });

    await user.click(screen.getByRole("button", { name: "Scanmodus inschakelen" }));
    await user.type(screen.getByLabelText("Scaninvoer"), "QR-1{Enter}");

    expect(await screen.findByRole("dialog", { name: "Pager SN-1" })).toBeInTheDocument();
    expect(mockedApi.scanPager).toHaveBeenCalledWith("QR-1");
  });

  it("shows an error toast when a scanned pager cannot be resolved", async () => {
    const user = userEvent.setup();
    mockedApi.scanPager.mockRejectedValueOnce(new Error("Onbekende QR-code."));
    render(<InventoryPage />);
    await screen.findByRole("heading", { name: "Toewijzingen" });

    await user.click(screen.getByRole("button", { name: "Scanmodus inschakelen" }));
    await user.type(screen.getByLabelText("Scaninvoer"), "QR-UNKNOWN{Enter}");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Onbekende QR-code."));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("links a scanned free pager from a vector dialog and refreshes inventory", async () => {
    const user = userEvent.setup();
    mockedApi.scanPager.mockResolvedValueOnce({ raw_scan: "QR-2", pager: inventory.pagers[1] });
    render(<InventoryPage />);
    await screen.findByRole("heading", { name: "Toewijzingen" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Type managed object" }), "vector");
    await user.click(screen.getByRole("button", { name: "Beheer koppelingen voor vector P-AND2" }));
    const dialog = screen.getByRole("dialog", { name: "Vector P-AND2" });

    await user.click(within(dialog).getByRole("button", { name: "Scanmodus inschakelen" }));
    await user.type(within(dialog).getByLabelText("Scaninvoer"), "QR-2{Enter}");

    await waitFor(() => expect(mockedApi.updatePagerVector).toHaveBeenCalledWith(2, 10));
    await waitFor(() => expect(mockedApi.getInventory).toHaveBeenCalledTimes(2));
  });

  it("refuses to move a scanned pager that is already linked elsewhere", async () => {
    const user = userEvent.setup();
    mockedApi.getInventory.mockResolvedValueOnce({
      ...inventory,
      pagers: inventory.pagers.map((pager) => ({ ...pager, assigned_vector_id: pager.id === 1 ? 11 : null })),
    });
    mockedApi.scanPager.mockResolvedValueOnce({ raw_scan: "QR-1", pager: inventory.pagers[0] });
    render(<InventoryPage />);
    await screen.findByRole("heading", { name: "Toewijzingen" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Type managed object" }), "vector");
    await user.click(screen.getByRole("button", { name: "Beheer koppelingen voor vector P-AND2" }));
    const dialog = screen.getByRole("dialog", { name: "Vector P-AND2" });

    await user.click(within(dialog).getByRole("button", { name: "Scanmodus inschakelen" }));
    await user.type(within(dialog).getByLabelText("Scaninvoer"), "QR-1{Enter}");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Deze pager is niet vrij en wordt niet verplaatst."));
    expect(mockedApi.updatePagerVector).not.toHaveBeenCalled();
  });

  it("shows an error for an unknown scan in a vector dialog", async () => {
    const user = userEvent.setup();
    mockedApi.scanPager.mockRejectedValueOnce(new Error("Onbekende QR-code."));
    render(<InventoryPage />);
    await screen.findByRole("heading", { name: "Toewijzingen" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Type managed object" }), "vector");
    await user.click(screen.getByRole("button", { name: "Beheer koppelingen voor vector P-AND2" }));
    const dialog = screen.getByRole("dialog", { name: "Vector P-AND2" });

    await user.click(within(dialog).getByRole("button", { name: "Scanmodus inschakelen" }));
    await user.type(within(dialog).getByLabelText("Scaninvoer"), "QR-UNKNOWN{Enter}");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Onbekende QR-code."));
    expect(mockedApi.updatePagerVector).not.toHaveBeenCalled();
  });

  it("lets staff choose an object type and search its compact list", async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);

    expect(await screen.findByRole("heading", { name: "Toewijzingen" })).toBeInTheDocument();
    const typePicker = screen.getByRole("combobox", { name: "Type managed object" });
    expect(typePicker).toHaveValue("pager");
    expect(screen.getByRole("button", { name: "Beheer koppelingen voor pager SN-1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Type/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Toegewezen aan/ })).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "TETRA" })).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "P-AND2 · Post Anderlecht" })).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Zoek objecten" });
    await user.type(search, "SN-2");
    expect(screen.getByRole("button", { name: "Beheer koppelingen voor pager SN-2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Beheer koppelingen voor pager SN-1" })).not.toBeInTheDocument();

    await user.selectOptions(typePicker, "vector");
    expect(screen.getByRole("button", { name: "Beheer koppelingen voor vector P-AND2" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Dienst/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Post/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Voertuig/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Status/ })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "AND" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Post Anderlecht" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "P8 · 1-ABC-123" })).toBeInTheDocument();
    expect(screen.getByTitle("Status 3 · Ter plaatse")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /voertuig/i })).not.toBeInTheDocument();
    const vectorHeader = screen.getByRole("columnheader", { name: /Vector/ });
    expect(vectorHeader).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByRole("button", { name: "Sorteer op Vector" }));
    expect(vectorHeader).toHaveAttribute("aria-sort", "descending");
    expect(screen.getAllByRole("button", { name: /Beheer koppelingen voor vector/ }).map((button) => button.getAttribute("aria-label")))
      .toEqual(["Beheer koppelingen voor vector P-AND2", "Beheer koppelingen voor vector OLD1", "Beheer koppelingen voor vector DISP1"]);

    await user.selectOptions(typePicker, "ric_code");
    expect(screen.getByRole("columnheader", { name: /Alias/ })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: /RiC\/AdC/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Gekoppelde vector/ })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "RiC 123456 / AdC 234567" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "P-AND2" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sorteer op RiC/AdC" }));
    expect(screen.getByRole("columnheader", { name: /RiC\/AdC/ })).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByRole("button", { name: "Sorteer op RiC/AdC" }));
    expect(screen.getByRole("columnheader", { name: /RiC\/AdC/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("filters pagers by type and assignment, and keeps an unassigned pager cell blank", async () => {
    const user = userEvent.setup();
    mockedApi.getInventory.mockResolvedValueOnce({
      ...inventory,
      pagers: inventory.pagers.map((pager) => pager.id === 2 ? { ...pager, type: { id: 2, name: "RES.Q XS" } } : pager),
    });
    render(<InventoryPage />);
    await screen.findByRole("heading", { name: "Toewijzingen" });

    const freePagerRow = screen.getByRole("button", { name: "Beheer koppelingen voor pager SN-2" }).closest("tr") as HTMLElement;
    expect(within(freePagerRow).getAllByRole("cell")[2]).toBeEmptyDOMElement();

    const typeHeader = screen.getByRole("columnheader", { name: /Type/ });
    await user.click(within(typeHeader).getByRole("button", { name: "Open filter voor Type" }));
    await user.click(within(screen.getByRole("group", { name: "Filter op type" })).getByLabelText("RES.Q XS"));
    expect(screen.getByRole("button", { name: "Beheer koppelingen voor pager SN-2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Beheer koppelingen voor pager SN-1" })).not.toBeInTheDocument();

    const assignmentHeader = screen.getByRole("columnheader", { name: /Toegewezen aan/ });
    await user.click(within(assignmentHeader).getByRole("button", { name: "Open filter voor Toegewezen aan" }));
    await user.click(within(screen.getByRole("group", { name: "Filter op toegewezen aan" })).getByLabelText("(Leeg)"));
    expect(screen.getByRole("button", { name: "Beheer koppelingen voor pager SN-2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Beheer koppelingen voor pager SN-1" })).not.toBeInTheDocument();
  });

  it("uses a searchable single-vector choice from a pager and preserves one-link behavior", async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);
    await user.click(await screen.findByRole("button", { name: "Beheer koppelingen voor pager SN-2" }));

    const dialog = screen.getByRole("dialog", { name: "Pager SN-2" });
    expect(dialog).toHaveClass("overflow-visible");
    expect(dialog).not.toHaveClass("h-[min(78vh,56rem)]", "overflow-y-auto");
    const vectorSearch = within(dialog).getByRole("combobox", { name: "Zoek vector" });
    await user.click(vectorSearch);
    const vectorList = screen.getByRole("listbox");
    expect(dialog).not.toContainElement(vectorList);
    expect(vectorList).toHaveClass("fixed", "max-h-[min(58vh,42rem)]", "overflow-y-auto");
    expect(vectorList).toHaveStyle({ top: "4px" });
    await user.clear(vectorSearch);
    expect(screen.queryByRole("option", { name: /OLD1/ })).not.toBeInTheDocument();
    await user.type(vectorSearch, "P-AND2");
    await user.click(screen.getByRole("option", { name: /P-AND2.*Post Anderlecht/ }));
    await user.click(within(dialog).getByRole("button", { name: "Koppeling opslaan" }));

    await waitFor(() => expect(mockedApi.updatePagerVector).toHaveBeenCalledWith(2, 10));
    expect(mockedApi.getInventory).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows free and linked columns when managing a vector", async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Type managed object" }), "vector");
    await user.click(screen.getByRole("button", { name: "Beheer koppelingen voor vector P-AND2" }));

    const dialog = screen.getByRole("dialog", { name: "Vector P-AND2" });
    expect(within(dialog).getByRole("region", { name: "Vrije pagers" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Gekoppelde pagers" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("tab", { name: /RiC\/AdC/ }));
    expect(within(dialog).getByRole("region", { name: "Vrije RiC/AdC-codes" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Gekoppelde RiC/AdC-codes" })).toBeInTheDocument();
    expect(within(dialog).getByText("AND")).toBeInTheDocument();
    expect(within(dialog).getByText("Post Anderlecht")).toBeInTheDocument();
    expect(within(dialog).getByText(/P8.*1-ABC-123/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox", { name: /dienst|voertuig|status/i })).not.toBeInTheDocument();
  });

  it("adds and removes multiple pager and RiC links from the vector modal", async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Type managed object" }), "vector");
    await user.click(screen.getByRole("button", { name: "Beheer koppelingen voor vector P-AND2" }));
    const dialog = screen.getByRole("dialog", { name: "Vector P-AND2" });

    await user.type(within(dialog).getByRole("searchbox", { name: "Zoek vrije pagers" }), "SN-2");
    await user.click(within(dialog).getByRole("button", { name: "Koppel pager SN-2 aan P-AND2" }));
    await waitFor(() => expect(mockedApi.updatePagerVector).toHaveBeenCalledWith(2, 10));
    await user.click(within(dialog).getByRole("button", { name: "Ontkoppel pager SN-1 van P-AND2" }));
    await waitFor(() => expect(mockedApi.updatePagerVector).toHaveBeenCalledWith(1, null));

    await user.click(within(dialog).getByRole("tab", { name: /RiC\/AdC/ }));
    const ricSearch = within(dialog).getByRole("searchbox", { name: "Zoek vrije RiC/AdC-codes" });
    await user.clear(ricSearch);
    await user.type(ricSearch, "Spare");
    await user.click(within(dialog).getByRole("button", { name: "Koppel RiC-code Spare code aan P-AND2" }));
    await waitFor(() => expect(mockedApi.updateRicCodeVector).toHaveBeenCalledWith(8, 10));
    await user.click(within(dialog).getByRole("button", { name: "Ontkoppel RiC-code Dispatch AND van P-AND2" }));
    await waitFor(() => expect(mockedApi.updateRicCodeVector).toHaveBeenCalledWith(7, null));
    expect(mockedApi.getInventory).toHaveBeenCalledTimes(5);
  });

  it("lets staff start from a RiC/AdC record and search for its vector", async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);
    const typePicker = await screen.findByRole("combobox", { name: "Type managed object" });
    await user.selectOptions(typePicker, "ric_code");
    await user.click(screen.getByRole("button", { name: "Beheer koppelingen voor RiC/AdC Dispatch AND" }));
    const dialog = screen.getByRole("dialog", { name: "RiC/AdC Dispatch AND" });
    const vectorSearch = within(dialog).getByRole("combobox", { name: "Zoek vector" });
    await user.clear(vectorSearch);
    await user.type(vectorSearch, "DISP1");
    await user.click(screen.getByRole("option", { name: /DISP1.*Zonder post/ }));
    await user.click(within(dialog).getByRole("button", { name: "Koppeling opslaan" }));
    await waitFor(() => expect(mockedApi.updateRicCodeVector).toHaveBeenCalledWith(7, 11));
  });

  it("closes the relationship dialog with Escape", async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);
    await user.click(await screen.findByRole("button", { name: "Beheer koppelingen voor pager SN-1" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows loading, API failure, and empty-list states", async () => {
    mockedApi.getInventory.mockRejectedValueOnce(new Error("Geen toegang"));
    const { unmount } = render(<InventoryPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Inventaris laden…");
    expect(await screen.findByRole("alert")).toHaveTextContent("Geen toegang");

    mockedApi.getInventory.mockResolvedValueOnce({ locations: [], vectors: [], pagers: [], ric_codes: [] });
    unmount();
    render(<InventoryPage />);
    expect(await screen.findByText("Geen objecten gevonden.")).toBeInTheDocument();
  });
});
