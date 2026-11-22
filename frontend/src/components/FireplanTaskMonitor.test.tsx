import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FireplanTaskMonitor } from "@/components/FireplanTaskMonitor";
import { api, subscribeToTask, type TaskSnapshot } from "@/lib/api";
import { toast } from "sonner";

vi.mock("@/lib/api", () => ({
  api: { getTask: vi.fn() },
  subscribeToTask: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname}{location.search}</output>;
}

describe("FireplanTaskMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows one completion toast with an action that opens the report", async () => {
    localStorage.setItem("activeFireplanSyncId", "sync-42");
    vi.mocked(api.getTask).mockResolvedValue({
      task_id: "sync-42",
      task_name: "fireplan.sync_pagers",
      status: "PROGRESS",
      progress: { current: 1, total: 2, percent: 50 },
      result: null,
      error: null,
      updated_at: null,
    });
    let onUpdate: ((snapshot: Awaited<ReturnType<typeof api.getTask>>) => void) | undefined;
    vi.mocked(subscribeToTask).mockImplementation((_id, callback) => {
      onUpdate = callback;
      return vi.fn();
    });
    render(<MemoryRouter><FireplanTaskMonitor /><CurrentLocation /></MemoryRouter>);
    await waitFor(() => expect(subscribeToTask).toHaveBeenCalledOnce());

    act(() => {
      onUpdate?.({
        task_id: "sync-42",
        task_name: "fireplan.sync_pagers",
        status: "SUCCESS",
        progress: { current: 2, total: 2, percent: 100 },
        result: { message: "done", added: 2, updated: 1, unchanged: 3, errors: [] },
        error: null,
        updated_at: null,
      });
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
    expect(localStorage.getItem("fireplanSyncToastShown:sync-42")).toBe("true");
    const options = vi.mocked(toast.success).mock.calls[0][1];
    const action = options?.action;
    if (!action || typeof action !== "object" || !("label" in action) || !("onClick" in action)) {
      throw new Error("Expected a report action on the success toast.");
    }
    expect(action.label).toBe("Rapport bekijken");
    act(() => (action.onClick as () => void)());
    expect(await screen.findByLabelText("Current location")).toHaveTextContent(
      "/tasks/sync-42?report=1",
    );
  });

  it("shows a failure toast for failed tasks", async () => {
    localStorage.setItem("activeFireplanSyncId", "sync-failed");
    vi.mocked(api.getTask).mockResolvedValue({
      task_id: "sync-failed",
      task_name: "fireplan.sync_pagers",
      status: "FAILURE",
      progress: null,
      result: null,
      error: "Fireplan niet bereikbaar",
      updated_at: null,
    });
    vi.mocked(subscribeToTask).mockReturnValue(vi.fn());
    render(<MemoryRouter><FireplanTaskMonitor /><CurrentLocation /></MemoryRouter>);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Fireplan-synchronisatie mislukt",
      expect.objectContaining({ description: "Fireplan niet bereikbaar" }),
    ));
  });

  it("recognizes radio sync results and offers the task report", async () => {
    localStorage.setItem("activeFireplanSyncId", "radio-sync-42");
    vi.mocked(api.getTask).mockResolvedValue({
      task_id: "radio-sync-42", task_name: "fireplan.sync_radios", status: "PROGRESS",
      progress: null, result: null, error: null, updated_at: null,
    });
    let onUpdate: ((snapshot: TaskSnapshot) => void) | undefined;
    vi.mocked(subscribeToTask).mockImplementation((_id, callback) => { onUpdate = callback; return vi.fn(); });
    render(<MemoryRouter><FireplanTaskMonitor /><CurrentLocation /></MemoryRouter>);
    await waitFor(() => expect(subscribeToTask).toHaveBeenCalledOnce());
    act(() => onUpdate?.({
      task_id: "radio-sync-42", task_name: "fireplan.sync_radios", status: "SUCCESS",
      progress: { current: 1, total: 1, percent: 100 },
      result: { message: "done", added: 1, updated: 2, unchanged: 3, skipped: 4, errors: [] },
      error: null, updated_at: null,
    }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
    const action = vi.mocked(toast.success).mock.calls[0][1]?.action;
    if (!action || typeof action !== "object" || !("onClick" in action)) throw new Error("Expected report action.");
    act(() => (action.onClick as () => void)());
    expect(await screen.findByLabelText("Current location")).toHaveTextContent("/tasks/radio-sync-42?report=1");
  });

  it("reloads the persisted result when the terminal SSE snapshot arrives before the result", async () => {
    localStorage.setItem("activeFireplanSyncId", "sync-race");
    const running = {
      task_id: "sync-race",
      task_name: "fireplan.sync_pagers",
      status: "PROGRESS" as const,
      progress: { current: 1, total: 2, percent: 50 },
      result: null,
      error: null,
      updated_at: null,
    };
    const completed = {
      ...running,
      status: "SUCCESS" as const,
      progress: { current: 2, total: 2, percent: 100 },
      result: { message: "done", added: 1, updated: 0, unchanged: 1, errors: [] },
    };
    vi.mocked(api.getTask).mockResolvedValueOnce(running).mockResolvedValueOnce(completed);
    let onUpdate: ((snapshot: TaskSnapshot) => void) | undefined;
    vi.mocked(subscribeToTask).mockImplementation((_id, callback) => {
      onUpdate = callback;
      return vi.fn();
    });
    render(<MemoryRouter><FireplanTaskMonitor /></MemoryRouter>);
    await waitFor(() => expect(subscribeToTask).toHaveBeenCalledOnce());

    act(() => {
      onUpdate?.({ ...running, status: "SUCCESS", progress: null });
    });

    await waitFor(() => expect(api.getTask).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledOnce();
  });
});
