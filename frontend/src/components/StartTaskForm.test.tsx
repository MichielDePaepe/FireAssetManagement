import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StartTaskForm } from "@/components/StartTaskForm";

describe("StartTaskForm", () => {
  it("submits the configured task duration", async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    render(<StartTaskForm onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /start example task/i }));
    await waitFor(() => expect(onStart).toHaveBeenCalledWith(30));
  });

  it("rejects a duration outside the allowed range", async () => {
    const onStart = vi.fn();
    render(<StartTaskForm onStart={onStart} />);
    fireEvent.change(screen.getByLabelText(/duration in seconds/i), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /start example task/i }));
    expect(await screen.findByText("Choose a whole number from 5 to 60.")).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
  });
});
