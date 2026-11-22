import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FireplanSyncReportDialog } from "@/components/FireplanSyncReportDialog";

const report = {
  added: 2,
  updated: 1,
  unchanged: 3,
  errors: [{
    fireplan_id: 42,
    serial_number: "SN-42",
    name: "Swissphone s.QUAD X35",
    message: "Serienummer is al gekoppeld.",
  }],
};

describe("FireplanSyncReportDialog", () => {
  it("shows the summary and row errors in an accessible dialog", () => {
    render(<FireplanSyncReportDialog report={report} open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Fireplan-synchronisatierapport" })).toBeInTheDocument();
    expect(screen.getByText("Serienummer is al gekoppeld.")).toBeInTheDocument();
    expect(screen.getByText(/Serienummer: SN-42/)).toBeInTheDocument();
  });

  it("closes on Escape and from the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FireplanSyncReportDialog report={report} open onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Rapport sluiten" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows a radio synchronization report with skipped source rows", () => {
    render(<FireplanSyncReportDialog report={{
      added: 1, updated: 2, unchanged: 3, skipped: 4,
      errors: [{ fireplan_id: 99, name: "Radio mobile Astrid", message: "TEI ontbreekt" }],
    }} open onClose={vi.fn()} />);
    expect(screen.getByText("Resultaat van de radiosynchronisatie.")).toBeInTheDocument();
    expect(screen.getByText("Overgeslagen").parentElement).toHaveTextContent("4");
    expect(screen.getByText("TEI ontbreekt")).toBeInTheDocument();
  });
});
