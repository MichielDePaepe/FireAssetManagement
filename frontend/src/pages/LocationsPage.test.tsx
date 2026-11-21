import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationsPage } from "@/pages/LocationsPage";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    listLocations: vi.fn(),
    listLocationServices: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    deleteLocation: vi.fn(),
    getLocationOverview: vi.fn(),
  },
}));

interface LocationRecord {
  id: number;
  name: string;
  sort_name: string;
  kind: "post" | "building" | "room" | "other";
  parent_id: number | null;
  service_id: number | null;
}

interface LocationValues {
  name: string;
  sort_name: string;
  kind: LocationRecord["kind"];
  parent_id: number | null;
  service_id: number | null;
}

interface ServiceOption {
  id: number;
  abbreviation: string;
  location_id: number | null;
}

const locationApi = api as typeof api & {
  listLocations: () => Promise<LocationRecord[]>;
  listLocationServices: () => Promise<ServiceOption[]>;
  createLocation: (values: LocationValues) => Promise<LocationRecord>;
  updateLocation: (id: number, values: LocationValues) => Promise<LocationRecord>;
  deleteLocation: (id: number) => Promise<void>;
  getLocationOverview: (id: number) => Promise<{
    location: LocationRecord;
    service: ServiceOption | null;
    vectors: Array<{
      id: number;
      vector_code: string;
      abbreviation: string;
      operational_status_code: string;
      status_description: string | null;
      status_color: string | null;
      vehicle: { alphacode: string; plate: string } | null;
      is_current: boolean;
    }>;
  }>;
};

const locations: LocationRecord[] = [
  { id: 1, name: "Post Noord", sort_name: "Hoofdpost", kind: "post", parent_id: null, service_id: 10 },
  { id: 2, name: "Gebouw A", sort_name: "", kind: "building", parent_id: 1, service_id: null },
  { id: 3, name: "Lokaal 1", sort_name: "", kind: "room", parent_id: 2, service_id: null },
  { id: 4, name: "Ongekoppelde post", sort_name: "", kind: "post", parent_id: null, service_id: null },
];

const services: ServiceOption[] = [
  { id: 10, abbreviation: "NOORD", location_id: 1 },
  { id: 11, abbreviation: "ZUID", location_id: null },
];

const currentVector = {
  id: 40,
  vector_code: "VEC-40",
  abbreviation: "Ambu 40",
  operational_status_code: "10",
  status_description: "Operationeel",
  status_color: "#008000",
  vehicle: { alphacode: "A1", plate: "1-ABC-123" },
  is_current: true,
};

describe("LocationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(locationApi.listLocations).mockResolvedValue(locations);
    vi.mocked(locationApi.listLocationServices).mockResolvedValue(services);
    vi.mocked(locationApi.createLocation).mockImplementation(async (values) => ({
      id: 5,
      ...values,
    }));
    vi.mocked(locationApi.updateLocation).mockImplementation(async (id, values) => ({
      id,
      ...values,
    }));
    vi.mocked(locationApi.deleteLocation).mockResolvedValue(undefined);
    vi.mocked(locationApi.getLocationOverview).mockImplementation(async (id) => ({
      location: locations.find((location) => location.id === id)!,
      service: id === 1 ? { id: 10, abbreviation: "NOORD", location_id: 1 } : null,
      vectors: id === 1 ? [currentVector] : [],
    }));
  });

  it("loads and navigates the location hierarchy", async () => {
    const user = userEvent.setup();
    render(<LocationsPage />);

    const tree = await screen.findByRole("tree", { name: "Locatiehiërarchie" });
    expect(within(tree).getByRole("button", { name: "Post Noord" })).toBeInTheDocument();
    expect(within(tree).getByRole("button", { name: "Lokaal 1" })).toBeInTheDocument();
    await user.click(within(tree).getByRole("button", { name: "Gebouw A" }));
    expect(screen.getByRole("heading", { name: "Gebouw A" })).toBeInTheDocument();
  });

  it("sorts siblings by sort name, then name, with blank sort names last", async () => {
    const orderedLocations: LocationRecord[] = [
      { id: 10, name: "Naam B", sort_name: "Groep 2", kind: "other", parent_id: null, service_id: null },
      { id: 11, name: "Naam A", sort_name: "Groep 2", kind: "other", parent_id: null, service_id: null },
      { id: 12, name: "Lege sortering", sort_name: "  ", kind: "other", parent_id: null, service_id: null },
      { id: 13, name: "Groep tien", sort_name: "Groep 10", kind: "other", parent_id: null, service_id: null },
      { id: 14, name: "Groep twee", sort_name: "Groep 2", kind: "other", parent_id: null, service_id: null },
      { id: 15, name: "A lege sortering", sort_name: "", kind: "other", parent_id: null, service_id: null },
    ];
    vi.mocked(locationApi.listLocations).mockResolvedValueOnce(orderedLocations);
    render(<LocationsPage />);

    const tree = await screen.findByRole("tree", { name: "Locatiehiërarchie" });
    expect(within(tree).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "Groep twee", "Naam A", "Naam B", "Groep tien", "A lege sortering", "Lege sortering",
    ]);
  });

  it("creates a child post and maps an available CityGIS service", async () => {
    const user = userEvent.setup();
    render(<LocationsPage />);

    await user.click(await screen.findByRole("button", { name: "Locatie toevoegen" }));
    expect(screen.getByText("Geavanceerde opties").closest("details")).not.toHaveAttribute("open");
    await user.type(screen.getByLabelText("Naam"), "Post Zuid");
    await user.click(screen.getByText("Geavanceerde opties"));
    await user.type(screen.getByLabelText("Sorteernaam"), "Post 2");
    await user.selectOptions(screen.getByLabelText("Type"), "post");
    await user.selectOptions(screen.getByLabelText("Bovenliggende locatie"), "1");
    await user.selectOptions(screen.getByLabelText("CityGIS-dienst"), "11");
    await user.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(locationApi.createLocation).toHaveBeenCalledWith({
      name: "Post Zuid",
      sort_name: "Post 2",
      kind: "post",
      parent_id: 1,
      service_id: 11,
    }));
  });

  it("edits a location and excludes itself and descendants as parents", async () => {
    const user = userEvent.setup();
    render(<LocationsPage />);

    const tree = await screen.findByRole("tree", { name: "Locatiehiërarchie" });
    await user.click(within(tree).getByRole("button", { name: "Post Noord" }));
    await user.click(await screen.findByRole("button", { name: "Locatie bewerken: Post Noord" }));
    expect(screen.getByText("Geavanceerde opties").closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByText("Geavanceerde opties"));
    expect(screen.getByLabelText("Sorteernaam")).toHaveValue("Hoofdpost");
    expect(screen.getByLabelText("Bovenliggende locatie")).toHaveValue("");
    expect(screen.queryByRole("option", { name: "Post Noord" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Gebouw A" })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Naam"));
    await user.type(screen.getByLabelText("Naam"), "Post Noord vernieuwd");
    await user.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(locationApi.updateLocation).toHaveBeenCalledWith(1, {
      name: "Post Noord vernieuwd",
      sort_name: "Hoofdpost",
      kind: "post",
      parent_id: null,
      service_id: 10,
    }));
  });

  it("offers deletion only for an unlinked leaf location", async () => {
    const user = userEvent.setup();
    render(<LocationsPage />);

    const tree = await screen.findByRole("tree", { name: "Locatiehiërarchie" });
    expect(screen.queryByRole("button", { name: "Locatie verwijderen: Post Noord" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Locatie verwijderen: Gebouw A" })).not.toBeInTheDocument();
    await user.click(within(tree).getByRole("button", { name: "Lokaal 1" }));
    await user.click(screen.getByRole("button", { name: "Locatie verwijderen: Lokaal 1" }));

    expect(locationApi.deleteLocation).toHaveBeenCalledWith(3);
  });

  it("shows loading, empty, and API failure states", async () => {
    vi.mocked(locationApi.listLocations).mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = render(<LocationsPage />);
    expect(screen.getByText("Locaties laden…")).toBeInTheDocument();
    unmount();

    vi.mocked(locationApi.listLocations).mockResolvedValueOnce([]);
    render(<LocationsPage />);
    expect(await screen.findByText("Nog geen locaties" )).toBeInTheDocument();
  });

  it("shows API errors and keeps service choices from blocking unmapped locations", async () => {
    vi.mocked(locationApi.listLocations).mockRejectedValueOnce(new Error("Server niet bereikbaar"));
    render(<LocationsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Server niet bereikbaar");
    expect(locationApi.listLocationServices).toHaveBeenCalled();
  });

  it("shows server validation errors accessibly when saving fails", async () => {
    const user = userEvent.setup();
    vi.mocked(locationApi.createLocation).mockRejectedValueOnce(new Error("Ongeldige bovenliggende locatie."));
    render(<LocationsPage />);

    await user.click(await screen.findByRole("button", { name: "Locatie toevoegen" }));
    await user.type(screen.getByLabelText("Naam"), "Testlocatie");
    await user.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ongeldige bovenliggende locatie.");
    expect(screen.getByLabelText("Naam")).toHaveAttribute("aria-describedby", "location-form-error");
  });

  it("shows the mapped post service, current vector status, and linked vehicle", async () => {
    const user = userEvent.setup();
    render(<LocationsPage />);

    const tree = await screen.findByRole("tree", { name: "Locatiehiërarchie" });
    await user.click(within(tree).getByRole("button", { name: "Post Noord" }));

    const overview = screen.getByRole("region", { name: "CityGIS-overzicht" });
    const vectorRow = await within(overview).findByRole("row", { name: /VEC-40/ });
    expect(within(vectorRow).getByText("10 · Operationeel")).toBeInTheDocument();
    expect(within(vectorRow).getByText("A1 · 1-ABC-123")).toBeInTheDocument();
    expect(within(overview).getByText("NOORD")).toBeInTheDocument();
    expect(within(vectorRow).getByRole("img", { name: "Statuskleur: Operationeel" })).toHaveStyle({
      backgroundColor: "#008000",
    });
    expect(screen.queryByRole("button", { name: /bewerk.*vector/i })).not.toBeInTheDocument();
  });

  it("shows useful empty states for posts without a service and non-post locations", async () => {
    const user = userEvent.setup();
    render(<LocationsPage />);

    const tree = await screen.findByRole("tree", { name: "Locatiehiërarchie" });
    await user.click(within(tree).getByRole("button", { name: "Ongekoppelde post" }));
    expect(await screen.findByText("Geen CityGIS-dienst gekoppeld")).toBeInTheDocument();
    expect(screen.getByText("Geen vectors voor deze post.")).toBeInTheDocument();

    await user.click(within(tree).getByRole("button", { name: "Gebouw A" }));
    expect(await screen.findByText("CityGIS-overzicht is alleen beschikbaar voor posten.")).toBeInTheDocument();
  });

  it("shows loading and API error states for the post overview", async () => {
    vi.mocked(locationApi.getLocationOverview).mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = render(<LocationsPage />);
    expect(await screen.findByText("Postgegevens laden…")).toBeInTheDocument();
    unmount();

    vi.mocked(locationApi.getLocationOverview).mockRejectedValueOnce(new Error("Postgegevens niet bereikbaar"));
    render(<LocationsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Postgegevens niet bereikbaar");
  });
});
