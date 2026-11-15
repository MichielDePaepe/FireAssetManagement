import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDetailPage } from "@/pages/TaskDetailPage";
import { api, subscribeToTask } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { getTask: vi.fn() },
  subscribeToTask: vi.fn(() => vi.fn()),
}));

const finishedSync = {
  task_id: "sync-42",
  task_name: "fireplan.sync_pagers",
  status: "SUCCESS" as const,
  progress: { current: 5, total: 5, percent: 100 },
  result: {
    message: "Fireplan-pagersynchronisatie voltooid.",
    added: 2,
    updated: 1,
    unchanged: 3,
    errors: [{
      fireplan_id: 42,
      serial_number: "SN-42",
      name: "Swissphone s.QUAD X35",
      message: "Serienummer is al gekoppeld.",
    }],
  },
  error: null,
  updated_at: "2026-11-14T10:00:00Z",
};

function renderDetail(path = "/tasks/sync-42") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/tasks/:taskId" element={<TaskDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("TaskDetailPage Fireplan report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getTask).mockResolvedValue(finishedSync);
    vi.mocked(subscribeToTask).mockReturnValue(vi.fn());
  });

  it("reopens the saved report from the report URL", async () => {
    renderDetail("/tasks/sync-42?report=1");

    expect(await screen.findByRole("dialog", { name: "Fireplan-synchronisatierapport" })).toBeInTheDocument();
    expect(screen.getByText("Serienummer is al gekoppeld.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fireplan-pagersynchronisatie" })).toBeInTheDocument();
  });

  it("opens and closes the report from task detail", async () => {
    const user = userEvent.setup();
    renderDetail();

    const openButton = await screen.findByRole("button", { name: "Synchronisatierapport bekijken" });
    await user.click(openButton);
    expect(screen.getByRole("dialog", { name: "Fireplan-synchronisatierapport" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rapport sluiten" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
  });
});
