import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
    expect(screen.getByText("Bezig")).toBeInTheDocument();
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

  it("shows Fireplan sync counts and offers its report", async () => {
    const user = userEvent.setup();
    const onOpenReport = vi.fn();
    render(<TaskProgress task={{
      ...task,
      task_name: "fireplan.sync_pagers",
      status: "SUCCESS",
      result: { message: "done", added: 2, updated: 1, unchanged: 4, errors: [] },
    }} onOpenReport={onOpenReport} />);

    expect(screen.getByText("Toegevoegd").parentElement).toHaveTextContent("2");
    expect(screen.getByText("Bijgewerkt").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Ongewijzigd").parentElement).toHaveTextContent("4");
    expect(screen.getByText("Mislukt").parentElement).toHaveTextContent("0");
    await user.click(screen.getByRole("button", { name: "Synchronisatierapport bekijken" }));
    expect(onOpenReport).toHaveBeenCalledOnce();
  });

  it("shows radio sync counts and report errors", async () => {
    const onOpenReport = vi.fn();
    const user = userEvent.setup();
    render(<TaskProgress task={{
      ...task,
      task_name: "fireplan.sync_radios",
      status: "SUCCESS",
      result: { message: "done", added: 1, updated: 2, unchanged: 3, skipped: 4, errors: [{ fireplan_id: 44, name: "Radio portable Astrid", message: "Ongeldige TEI" }] },
    }} onOpenReport={onOpenReport} />);
    expect(screen.getByText("Overgeslagen").parentElement).toHaveTextContent("4");
    expect(screen.getByRole("list", { name: "Radio's met synchronisatiefouten" })).toHaveTextContent("Radio portable Astrid · FirePlan-ID 44: Ongeldige TEI");
    await user.click(screen.getByRole("button", { name: "Synchronisatierapport bekijken" }));
    expect(onOpenReport).toHaveBeenCalledOnce();
  });
});

it("shows the Suivo reconciliation result counts", () => {
  render(<TaskProgress task={{
    ...task,
    task_name: "suivo.sync",
    status: "SUCCESS",
    progress: null,
    result: { message: "Suivo-gegevens vernieuwd.", units: 200, devices: 182, statuses: 200 },
  }} />);
  expect(screen.getByText("Assets").parentElement).toHaveTextContent("200");
  expect(screen.getByText("Trackers").parentElement).toHaveTextContent("182");
  expect(screen.getByText("Statusrecords").parentElement).toHaveTextContent("200");
});
