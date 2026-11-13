import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskProgress } from "@/components/TaskProgress";

const task = {
  task_id: "demo-task",
  task_name: "tasks.example_task",
  status: "PROGRESS" as const,
  progress: { current: 4, total: 10, percent: 40, description: "Working: 4/10 seconds" },
  result: null,
  error: null,
  updated_at: null,
};

describe("TaskProgress", () => {
  it("shows progress, status and description", () => {
    render(<TaskProgress task={task} />);
    expect(screen.getByText("PROGRESS")).toBeInTheDocument();
    expect(screen.getByText("Working: 4/10 seconds")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("shows the final result", () => {
    render(<TaskProgress task={{ ...task, status: "SUCCESS", progress: null, result: { message: "All done" } }} />);
    expect(screen.getByText("Task completed")).toBeInTheDocument();
    expect(screen.getByText("All done")).toBeInTheDocument();
  });

  it("shows a recoverable task error", () => {
    render(<TaskProgress task={{ ...task, status: "FAILURE", error: "Something failed" }} />);
    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });
});
