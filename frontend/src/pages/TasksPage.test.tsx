import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TasksPage } from "@/pages/TasksPage";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { listTasks: vi.fn() },
}));

describe("TasksPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("labels Fireplan synchronization tasks in task history", async () => {
    vi.mocked(api.listTasks).mockResolvedValue([{
      task_id: "sync-42",
      task_name: "fireplan.sync_pagers",
      status: "SUCCESS",
      progress: null,
      result: { added: 2, updated: 0, unchanged: 1, errors: [] },
      error: null,
      updated_at: "2026-11-14T10:00:00Z",
    }]);
    render(<MemoryRouter><TasksPage /></MemoryRouter>);

    expect(await screen.findByText("Fireplan-pagersynchronisatie")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fireplan-pagersynchronisatie/ })).toHaveAttribute(
      "href",
      "/tasks/sync-42",
    );
  });
});
