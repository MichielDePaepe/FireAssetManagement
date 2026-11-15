import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LabelPrintersPage } from "@/pages/LabelPrintersPage";
import { api } from "@/lib/api";
import { toast } from "sonner";

vi.mock("@/lib/api", () => ({
  api: {
    listPrinters: vi.fn(),
    createPrinter: vi.fn(),
    updatePrinter: vi.fn(),
    deletePrinter: vi.fn(),
    checkPrinterConnection: vi.fn(),
    printTestLabel: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

interface PrinterRecord {
  id: number;
  name: string;
  manufacturer: string;
  model: string;
  ip_address: string;
  port: number;
  tape_width_mm: number;
  created_at: string;
  updated_at: string;
}

const printerApi = api as typeof api & {
  listPrinters: () => Promise<PrinterRecord[]>;
  createPrinter: (values: Omit<PrinterRecord, "id" | "created_at" | "updated_at">) => Promise<PrinterRecord>;
  updatePrinter: (id: number, values: Omit<PrinterRecord, "id" | "created_at" | "updated_at">) => Promise<PrinterRecord>;
  deletePrinter: (id: number) => Promise<void>;
  checkPrinterConnection: (id: number) => Promise<{ status: string; detail: string }>;
  printTestLabel: (id: number) => Promise<{ status: string; detail: string }>;
};

const samplePrinter: PrinterRecord = {
  id: 1,
  name: "Magazijn",
  manufacturer: "Brother",
  model: "PT-P900W",
  ip_address: "192.0.2.25",
  port: 9100,
  tape_width_mm: 12,
  created_at: "2026-11-14T08:00:00Z",
  updated_at: "2026-11-14T08:00:00Z",
};

describe("LabelPrintersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(printerApi.listPrinters).mockResolvedValue([samplePrinter]);
  });

  it("shows saved printer details", async () => {
    render(<LabelPrintersPage />);

    expect(await screen.findByText("Magazijn")).toBeInTheDocument();
    expect(screen.getByText("Brother PT-P900W")).toBeInTheDocument();
    expect(screen.getByText("192.0.2.25:9100")).toBeInTheDocument();
    expect(screen.getByText("12 mm")).toBeInTheDocument();
  });

  it("creates a printer with its model and default settings", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.createPrinter).mockResolvedValue(samplePrinter);
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Printer toevoegen" }));
    await user.type(screen.getByLabelText("Naam"), "Magazijn");
    await user.type(screen.getByLabelText("IP-adres"), "192.0.2.25");
    await user.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(printerApi.createPrinter).toHaveBeenCalledWith({
      name: "Magazijn",
      manufacturer: "Brother",
      model: "PT-P900W",
      ip_address: "192.0.2.25",
      port: 9100,
      tape_width_mm: 12,
    }));
    expect(toast.success).toHaveBeenCalledWith("Printer toegevoegd.");
  });

  it("requires a printer name before saving", async () => {
    const user = userEvent.setup();
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Printer toevoegen" }));
    await user.type(screen.getByLabelText("IP-adres"), "192.0.2.25");
    await user.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Vul een printernaam in.");
    expect(printerApi.createPrinter).not.toHaveBeenCalled();
  });

  it("opens the edit form and saves changed printer values", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.updatePrinter).mockResolvedValue({ ...samplePrinter, name: "Kazerne" });
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Bewerk printer Magazijn" }));
    expect(screen.getByLabelText("Naam")).toHaveValue("Magazijn");
    await user.clear(screen.getByLabelText("Naam"));
    await user.type(screen.getByLabelText("Naam"), "Kazerne");
    await user.selectOptions(screen.getByLabelText("Tapebreedte"), "36");
    await user.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(printerApi.updatePrinter).toHaveBeenCalledWith(1, {
      name: "Kazerne",
      manufacturer: "Brother",
      model: "PT-P900W",
      ip_address: "192.0.2.25",
      port: 9100,
      tape_width_mm: 36,
    }));
    expect(toast.success).toHaveBeenCalledWith("Printer bijgewerkt.");
  });

  it("shows an error when the list cannot be loaded", async () => {
    vi.mocked(printerApi.listPrinters).mockRejectedValue(new Error("Server niet bereikbaar"));
    render(<LabelPrintersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Server niet bereikbaar");
  });

  it("shows an empty state when no printers are configured", async () => {
    vi.mocked(printerApi.listPrinters).mockResolvedValue([]);
    render(<LabelPrintersPage />);

    expect(await screen.findByText("Nog geen printers")).toBeInTheDocument();
  });

  it("shows API validation errors when saving fails", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.createPrinter).mockRejectedValue(new Error("IP-adres is ongeldig."));
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Printer toevoegen" }));
    await user.type(screen.getByLabelText("Naam"), "Magazijn");
    await user.type(screen.getByLabelText("IP-adres"), "bad-address");
    await user.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("IP-adres is ongeldig.");
  });

  it("shows a loading state while printers are being fetched", () => {
    vi.mocked(printerApi.listPrinters).mockReturnValue(new Promise(() => {}));
    render(<LabelPrintersPage />);

    expect(screen.getByText("Printers laden…")).toBeInTheDocument();
  });

  it("confirms before deleting a printer", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(printerApi.deletePrinter).mockResolvedValue(undefined);
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Verwijder printer Magazijn" }));

    expect(window.confirm).toHaveBeenCalledWith("Printer Magazijn verwijderen?");
    expect(printerApi.deletePrinter).toHaveBeenCalledWith(1);
  });

  it("checks the selected printer connection and reports reachability", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.checkPrinterConnection).mockResolvedValue({
      status: "reachable",
      detail: "TCP-poort bereikbaar.",
    });
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Verbinding testen voor Magazijn" }));

    await waitFor(() => expect(printerApi.checkPrinterConnection).toHaveBeenCalledWith(1));
    expect(toast.success).toHaveBeenCalledWith("TCP-poort bereikbaar.");
  });

  it("reports a connection timeout as an error", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.checkPrinterConnection).mockResolvedValue({
      status: "timeout",
      detail: "Geen antwoord binnen 2 seconden.",
    });
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Verbinding testen voor Magazijn" }));

    expect(toast.error).toHaveBeenCalledWith("Geen antwoord binnen 2 seconden.");
  });

  it("sends a test label and reports that the driver accepted it", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.printTestLabel).mockResolvedValue({
      status: "sent",
      detail: "Testlabel verzonden; fysieke afdruk niet bevestigd.",
    });
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Testlabel printen voor Magazijn" }));

    await waitFor(() => expect(printerApi.printTestLabel).toHaveBeenCalledWith(1));
    expect(toast.success).toHaveBeenCalledWith(
      "Testlabel verzonden; fysieke afdruk niet bevestigd.",
    );
  });

  it("reports a printer driver error without a success notification", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.printTestLabel).mockRejectedValue(new Error("Afdrukken mislukt."));
    render(<LabelPrintersPage />);

    await user.click(await screen.findByRole("button", { name: "Testlabel printen voor Magazijn" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Afdrukken mislukt."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("disables a connection action while the check is running", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.checkPrinterConnection).mockReturnValue(new Promise(() => {}));
    render(<LabelPrintersPage />);

    const button = await screen.findByRole("button", { name: "Verbinding testen voor Magazijn" });
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Verbinding controleren…" })).toBeDisabled();
    expect(printerApi.checkPrinterConnection).toHaveBeenCalledTimes(1);
  });

  it("disables label printing while the print request is running", async () => {
    const user = userEvent.setup();
    vi.mocked(printerApi.printTestLabel).mockReturnValue(new Promise(() => {}));
    render(<LabelPrintersPage />);

    const button = await screen.findByRole("button", { name: "Testlabel printen voor Magazijn" });
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Testlabel verzenden…" })).toBeDisabled();
    expect(printerApi.printTestLabel).toHaveBeenCalledTimes(1);
  });
});
