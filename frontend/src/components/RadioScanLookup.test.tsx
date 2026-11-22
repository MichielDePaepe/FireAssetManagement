import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { RadioScanLookup } from "./RadioScanLookup";

vi.mock("@/lib/api", () => ({
  api: { lookupRadioScan: vi.fn() },
}));

describe("RadioScanLookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("identifies a radio through the shared keyboard scanner", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupRadioScan).mockResolvedValue({
      raw_scan: "https://infoscan.firebru.brussels?data=1,1,4321,1010",
      radio: {
        id: 7,
        tei: "00000000000001",
        manufacturer: "",
        model_name: "",
        model: null,
        fireplan_id: 4321,
        created_at: "2026-11-20T10:00:00Z",
        updated_at: "2026-11-20T10:00:00Z",
      },
    });
    render(<RadioScanLookup />);

    await user.click(screen.getByRole("button", { name: "Scanmodus inschakelen" }));
    await user.type(
      screen.getByLabelText("Scaninvoer"),
      "https://infoscan.firebru.brussels?data=1,1,4321,1010{Enter}",
    );

    expect(await screen.findByText("Radio gevonden" )).toBeInTheDocument();
    expect(screen.getByText("00000000000001")).toBeInTheDocument();
    expect(api.lookupRadioScan).toHaveBeenCalledWith(
      "https://infoscan.firebru.brussels?data=1,1,4321,1010",
    );
  });

  it("shows lookup failures without changing radio data", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupRadioScan).mockRejectedValue(new Error("Geen radio gevonden."));
    render(<RadioScanLookup />);

    await user.click(screen.getByRole("button", { name: "Scanmodus inschakelen" }));
    await user.type(screen.getByLabelText("Scaninvoer"), "unknown-scan{Enter}");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Geen radio gevonden."),
    );
  });
});
