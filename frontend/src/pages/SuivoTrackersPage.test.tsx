import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type SuivoAsset } from "@/lib/api";
import { SuivoTrackersPage } from "@/pages/SuivoTrackersPage";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  api: { getSuivoAssets: vi.fn(), getSuivoDevices: vi.fn(), startSuivoSync: vi.fn() },
}));

const asset: SuivoAsset = {
  external_id: "unit-1", name: "Engine 1", match_status: "matched",
  vehicle: { id: 1, name: "Engine 1" }, matches: [{ id: 1, name: "Engine 1" }],
  devices: [{ external_id: "device-1", imei: "imei-1", type: "INSTALL" }],
  last_seen_at: "2026-11-25T10:00:00Z", position_at: "2026-11-25T09:59:00Z",
  position: { address: { city: "Brussels" } }, battery_level: null, battery_voltage: null,
};
const emptyMeta = { last_succeeded_at: "2026-11-25T10:00:00Z", last_error: "", push_connected: true, push_last_message_at: "2026-11-25T10:00:00Z", push_last_error: "", stale: false };

beforeEach(() => {
  vi.mocked(api.getSuivoAssets).mockResolvedValue({ results: [asset], ...emptyMeta });
  vi.mocked(api.getSuivoDevices).mockResolvedValue({
    results: [{ external_id: "device-1", imei: "imei-1", device_type: "INSTALL", unit: { external_id: "unit-1", name: "Engine 1" }, last_seen_at: asset.last_seen_at, position_at: asset.position_at, position: asset.position, battery_level: null, battery_voltage: null }],
    ...emptyMeta,
  });
});

describe("SuivoTrackersPage", () => {
  it("shows assets with distinct last-seen and position timestamps", async () => {
    render(<MemoryRouter><SuivoTrackersPage /></MemoryRouter>);
    expect((await screen.findAllByText("Engine 1")).length).toBeGreaterThan(0);
    expect(screen.getByText("Brussels")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /asset/i })).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: "Sorteer op Laatst gehoord" }));
    expect(screen.getByRole("columnheader", { name: /laatst gehoord/i })).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: "Sorteer op Laatst gehoord" }));
    expect(screen.getByRole("columnheader", { name: /laatst gehoord/i })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getAllByText("Niet beschikbaar").length).toBeGreaterThan(0);
  });

  it("shows all devices, including unlinked devices, on the tracker tab", async () => {
    render(<MemoryRouter><SuivoTrackersPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Trackers" }));
    await waitFor(() => expect(screen.getByText("INSTALL")).toBeInTheDocument());
    expect(screen.getByText("imei-1")).toBeInTheDocument();
  });

  it("shows a stale-data notice and supports search", async () => {
    vi.mocked(api.getSuivoAssets).mockResolvedValue({ results: [asset], ...emptyMeta, stale: true, last_error: "", push_connected: false, push_last_error: "ConnectionError; reconnecting" });
    render(<MemoryRouter><SuivoTrackersPage /></MemoryRouter>);
    expect(await screen.findByRole("status")).toHaveTextContent(/verouderd/i);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing" } });
    await waitFor(() => expect(screen.getByText(/geen resultaten/i)).toBeInTheDocument());
  });
});

it("shows empty and API error states", async () => {
  vi.mocked(api.getSuivoAssets).mockResolvedValue({ results: [], ...emptyMeta });
  vi.mocked(api.getSuivoDevices).mockResolvedValue({ results: [], ...emptyMeta });
  const { unmount } = render(<MemoryRouter><SuivoTrackersPage /></MemoryRouter>);
  expect(await screen.findByText("Geen gegevens beschikbaar.")).toBeInTheDocument();
  unmount();

  vi.mocked(api.getSuivoAssets).mockRejectedValue(new Error("API unavailable"));
  vi.mocked(api.getSuivoDevices).mockRejectedValue(new Error("API unavailable"));
  render(<MemoryRouter><SuivoTrackersPage /></MemoryRouter>);
  expect(await screen.findByRole("alert")).toHaveTextContent("API unavailable");
});

it("announces the loading state", () => {
  vi.mocked(api.getSuivoAssets).mockReturnValue(new Promise(() => undefined));
  vi.mocked(api.getSuivoDevices).mockReturnValue(new Promise(() => undefined));
  render(<MemoryRouter><SuivoTrackersPage /></MemoryRouter>);
  expect(screen.getByText("Suivo-gegevens laden…")).toBeInTheDocument();
});


it("starts the full refresh and opens the existing task progress route", async () => {
  vi.mocked(api.startSuivoSync).mockResolvedValue({ task_id: "suivo-task-1", status: "PENDING" });
  function TaskRoute() { const { taskId } = useParams(); return <p>Task view {taskId}</p>; }
  render(<MemoryRouter initialEntries={["/trackers"]}><Routes>
    <Route path="/trackers" element={<SuivoTrackersPage />} />
    <Route path="/tasks/:taskId" element={<TaskRoute />} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /alles vernieuwen/i }));
  expect(await screen.findByText("Task view suivo-task-1")).toBeInTheDocument();
  expect(api.startSuivoSync).toHaveBeenCalledOnce();
});
