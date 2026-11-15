import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Printer, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type LabelPrinter, type LabelPrinterValues } from "@/lib/api";

interface PrinterFormState {
  name: string;
  ip_address: string;
  port: string;
  tape_width_mm: string;
}

const emptyForm: PrinterFormState = {
  name: "",
  ip_address: "",
  port: "9100",
  tape_width_mm: "12",
};

const tapeWidths = [6, 12, 18, 24, 36];

export function LabelPrintersPage() {
  const [printers, setPrinters] = useState<LabelPrinter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingPrinterId, setCheckingPrinterId] = useState<number | null>(null);
  const [printingPrinterId, setPrintingPrinterId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [editingPrinter, setEditingPrinter] = useState<LabelPrinter | null>(null);
  const [form, setForm] = useState<PrinterFormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPrinters(await api.listPrinters());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Printers laden is niet gelukt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const openCreateForm = () => {
    setEditingPrinter(null);
    setForm({ ...emptyForm });
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (printer: LabelPrinter) => {
    setEditingPrinter(printer);
    setForm({
      name: printer.name,
      ip_address: printer.ip_address,
      port: String(printer.port),
      tape_width_mm: String(printer.tape_width_mm),
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingPrinter(null);
    setFormError("");
  };

  const savePrinter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const ip_address = form.ip_address.trim();
    const port = Number(form.port);
    const tape_width_mm = Number(form.tape_width_mm);
    if (!name) {
      setFormError("Vul een printernaam in.");
      return;
    }
    if (!ip_address) {
      setFormError("Vul een IP-adres in.");
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setFormError("Vul een TCP-poort tussen 1 en 65535 in.");
      return;
    }
    if (!tapeWidths.includes(tape_width_mm)) {
      setFormError("Kies een ondersteunde tapebreedte.");
      return;
    }

    const values: LabelPrinterValues = {
      name,
      manufacturer: "Brother",
      model: "PT-P900W",
      ip_address,
      port,
      tape_width_mm,
    };
    setSaving(true);
    setFormError("");
    try {
      if (editingPrinter) {
        await api.updatePrinter(editingPrinter.id, values);
        toast.success("Printer bijgewerkt.");
      } else {
        await api.createPrinter(values);
        toast.success("Printer toegevoegd.");
      }
      closeForm();
      await refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Opslaan is niet gelukt.");
    } finally {
      setSaving(false);
    }
  };

  const removePrinter = async (printer: LabelPrinter) => {
    if (!window.confirm(`Printer ${printer.name} verwijderen?`)) return;
    try {
      await api.deletePrinter(printer.id);
      toast.success("Printer verwijderd.");
      await refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Verwijderen is niet gelukt.");
    }
  };

  const checkConnection = async (printer: LabelPrinter) => {
    if (checkingPrinterId !== null) return;
    setCheckingPrinterId(printer.id);
    try {
      const result = await api.checkPrinterConnection(printer.id);
      if (result.status === "reachable") toast.success(result.detail);
      else toast.error(result.detail);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Verbindingstest is mislukt.");
    } finally {
      setCheckingPrinterId(null);
    }
  };

  const printTestLabel = async (printer: LabelPrinter) => {
    if (printingPrinterId !== null) return;
    setPrintingPrinterId(printer.id);
    try {
      const result = await api.printTestLabel(printer.id);
      if (result.status === "sent") toast.success(result.detail);
      else toast.error(result.detail);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Testlabel afdrukken is mislukt.");
    } finally {
      setPrintingPrinterId(null);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Beheer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Labelprinters</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Beheer Brother PT-P900W-printers en hun netwerk- en tape-instellingen.
          </p>
          <p role="note" className="mt-2 max-w-3xl text-sm text-muted-foreground">
            De verbindingstest controleert alleen de TCP-poort. Een verzonden testlabel bevestigt niet dat er fysiek een label is afgedrukt.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Printers vernieuwen"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
          <Button onClick={openCreateForm}><Plus className="h-4 w-4" />Printer toevoegen</Button>
        </div>
      </div>

      {formOpen && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{editingPrinter ? "Printer bewerken" : "Printer toevoegen"}</CardTitle>
                <CardDescription>Stel het printeradres en de standaard tapebreedte in.</CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Formulier sluiten"
                onClick={closeForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={(event) => void savePrinter(event)}>
              <label className="space-y-2 text-sm font-medium" htmlFor="printer-name">
                Naam
                <Input
                  id="printer-name"
                  autoComplete="off"
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <div className="space-y-2 text-sm font-medium">
                <span className="block">Merk en model</span>
                <div className="flex h-10 items-center border bg-muted/30 px-3 text-sm font-normal">
                  Brother PT-P900W
                </div>
              </div>
              <label className="space-y-2 text-sm font-medium" htmlFor="printer-ip-address">
                IP-adres
                <Input
                  id="printer-ip-address"
                  autoComplete="off"
                  inputMode="decimal"
                  required
                  maxLength={45}
                  value={form.ip_address}
                  onChange={(event) => setForm({ ...form, ip_address: event.target.value })}
                />
              </label>
              <label className="space-y-2 text-sm font-medium" htmlFor="printer-port">
                TCP-poort
                <Input
                  id="printer-port"
                  type="number"
                  min={1}
                  max={65535}
                  required
                  value={form.port}
                  onChange={(event) => setForm({ ...form, port: event.target.value })}
                />
              </label>
              <label className="space-y-2 text-sm font-medium" htmlFor="printer-tape-width">
                Tapebreedte
                <select
                  id="printer-tape-width"
                  value={form.tape_width_mm}
                  onChange={(event) => setForm({ ...form, tape_width_mm: event.target.value })}
                  className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm"
                >
                  {tapeWidths.map((width) => (
                    <option key={width} value={width}>{width} mm</option>
                  ))}
                </select>
              </label>
              {formError && (
                <p role="alert" className="text-sm text-red-700 sm:col-span-2">{formError}</p>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Opslaan…" : "Opslaan"}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
                  Annuleren
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Geregistreerde printers</CardTitle>
          <CardDescription>
            {printers.length} {printers.length === 1 ? "printer" : "printers"} geregistreerd
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div
              role="alert"
              className="flex items-center justify-between border-l-2 border-red-500 bg-red-50 p-4 text-sm"
            >
              {error}
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                Opnieuw proberen
              </Button>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />Printers laden…
            </div>
          ) : printers.length === 0 ? (
            <div className="py-12 text-center">
              <Printer className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nog geen printers</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Voeg een Brother PT-P900W toe om de printerlijst op te bouwen.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-3 pr-4 font-medium">Naam</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Model</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Netwerkadres</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Tapebreedte</th>
                    <th scope="col" className="py-3 text-right font-medium">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {printers.map((printer) => (
                    <tr key={printer.id} className="hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{printer.name}</td>
                      <td className="py-3 pr-4">{printer.manufacturer} {printer.model}</td>
                      <td className="py-3 pr-4">{printer.ip_address}:{printer.port}</td>
                      <td className="py-3 pr-4">{printer.tape_width_mm} mm</td>
                      <td className="py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={checkingPrinterId === printer.id ? "Verbinding controleren…" : `Verbinding testen voor ${printer.name}`}
                            disabled={checkingPrinterId !== null}
                            onClick={() => void checkConnection(printer)}
                          >
                            <RefreshCw className={`h-4 w-4 ${checkingPrinterId === printer.id ? "animate-spin" : ""}`} />
                            {checkingPrinterId === printer.id ? "Controleren…" : "Verbinding testen"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={printingPrinterId === printer.id ? "Testlabel verzenden…" : `Testlabel printen voor ${printer.name}`}
                            disabled={printingPrinterId !== null}
                            onClick={() => void printTestLabel(printer)}
                          >
                            <Printer className={`h-4 w-4 ${printingPrinterId === printer.id ? "animate-pulse" : ""}`} />
                            {printingPrinterId === printer.id ? "Verzenden…" : "Testlabel printen"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Bewerk printer ${printer.name}`}
                            onClick={() => openEditForm(printer)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Bewerken</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Verwijder printer ${printer.name}`}
                            onClick={() => void removePrinter(printer)}
                          >
                            <Trash2 className="h-4 w-4 text-red-700" />
                            <span className="sr-only">Verwijderen</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
