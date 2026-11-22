import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  History,
  Pencil,
  Plus,
  Radio,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PagerScanControl } from "@/components/PagerScanControl";
import { CloudRefreshIcon } from "@/components/CloudRefreshIcon";
import { ModalDialog } from "@/components/ModalDialog";
import { api, type Pager, type PagerType, type RicCode } from "@/lib/api";

interface PagerFormState {
  serial_number: string;
  type_id: string;
}
const emptyForm: PagerFormState = { serial_number: "", type_id: "" };

type SortDirection = "ascending" | "descending";
type PagerSortColumn = "serial_number" | "type";
type RicCodeSortColumn = "ric_code" | "adc_code" | "alias";

function compareTableText(left: string, right: string): number {
  return left.localeCompare(right, "nl-BE", { numeric: true, sensitivity: "base" });
}

export function PagersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pagers, setPagers] = useState<Pager[]>([]);
  const [types, setTypes] = useState<PagerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [editingPager, setEditingPager] = useState<Pager | null>(null);
  const [form, setForm] = useState<PagerFormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"devices" | "codes">("devices");
  const [pagerQuery, setPagerQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const [pagerSort, setPagerSort] = useState<{ column: PagerSortColumn; direction: SortDirection }>({
    column: "serial_number",
    direction: "ascending",
  });
  const [codeSort, setCodeSort] = useState<{ column: RicCodeSortColumn; direction: SortDirection }>({
    column: "ric_code",
    direction: "ascending",
  });
  const [ricCodes, setRicCodes] = useState<RicCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeFormOpen, setCodeFormOpen] = useState(false);
  const [codeSaving, setCodeSaving] = useState(false);
  const [editingCode, setEditingCode] = useState<number | null>(null);
  const [codeForm, setCodeForm] = useState({
    ric_code: "",
    adc_code: "",
    alias: "",
  });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [activeSyncId, setActiveSyncId] = useState(
    () => window.localStorage.getItem("activeFireplanSyncId") ?? "",
  );

  const sortedPagers = useMemo(() => {
    const direction = pagerSort.direction === "ascending" ? 1 : -1;
    const needle = pagerQuery.trim().toLocaleLowerCase("nl-BE");
    return pagers.filter((pager) => !needle || [pager.serial_number, pager.type.name]
      .some((value) => value.toLocaleLowerCase("nl-BE").includes(needle))).sort((left, right) => {
      const leftValue = pagerSort.column === "serial_number" ? left.serial_number : left.type.name;
      const rightValue = pagerSort.column === "serial_number" ? right.serial_number : right.type.name;
      return compareTableText(leftValue, rightValue) * direction || left.id - right.id;
    });
  }, [pagerQuery, pagers, pagerSort]);

  const sortedRicCodes = useMemo(() => {
    const direction = codeSort.direction === "ascending" ? 1 : -1;
    const needle = codeQuery.trim().toLocaleLowerCase("nl-BE");
    return ricCodes.filter((code) => !needle || [code.ric_code, code.adc_code, code.alias]
      .some((value) => value.toLocaleLowerCase("nl-BE").includes(needle))).sort((left, right) => {
      return compareTableText(left[codeSort.column], right[codeSort.column]) * direction || left.id - right.id;
    });
  }, [codeQuery, codeSort, ricCodes]);

  const togglePagerSort = (column: PagerSortColumn) => {
    setPagerSort((current) => ({
      column,
      direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
    }));
  };

  const toggleCodeSort = (column: RicCodeSortColumn) => {
    setCodeSort((current) => ({
      column,
      direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
    }));
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [pagerRows, pagerTypes] = await Promise.all([api.listPagers(), api.listPagerTypes()]);
      setPagers(pagerRows);
      setTypes(pagerTypes);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pagers laden is niet gelukt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const refreshCodes = useCallback(async () => {
    setCodesLoading(true);
    setCodeError("");
    try {
      setRicCodes(await api.listRicCodes());
    } catch (reason) {
      setCodeError(reason instanceof Error ? reason.message : "RiC-codes laden is niet gelukt.");
    } finally {
      setCodesLoading(false);
    }
  }, []);

  const openCreateForm = () => {
    setEditingPager(null);
    setForm({ ...emptyForm, type_id: types[0] ? String(types[0].id) : "" });
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (pager: Pager) => {
    setEditingPager(pager);
    setForm({ serial_number: pager.serial_number, type_id: String(pager.type.id) });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingPager(null);
    setFormError("");
  }, []);

  const savePager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const serial_number = form.serial_number.trim();
    const type_id = Number(form.type_id);
    if (!serial_number || !type_id) {
      setFormError("Vul een serienummer in en selecteer een type.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const values = { serial_number, type_id };
      if (editingPager) await api.updatePager(editingPager.id, values);
      else await api.createPager(values);
      toast.success(editingPager ? "Pager bijgewerkt." : "Pager toegevoegd.");
      closeForm();
      await refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Opslaan is niet gelukt.");
    } finally {
      setSaving(false);
    }
  };

  const removePager = async (pager: Pager) => {
    if (!window.confirm(`Pager ${pager.serial_number} verwijderen?`)) return;
    try {
      await api.deletePager(pager.id);
      toast.success("Pager verwijderd.");
      await refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Verwijderen is niet gelukt.");
    }
  };

  const startFireplanSync = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const task = await api.startFireplanSync();
      window.localStorage.setItem("activeFireplanSyncId", task.task_id);
      setActiveSyncId(task.task_id);
      window.dispatchEvent(new Event("fireplan-sync-task-change"));
      navigate(`/tasks/${encodeURIComponent(task.task_id)}`);
    } catch (reason) {
      setSyncError(reason instanceof Error ? reason.message : "Fireplan-sync starten is niet gelukt.");
    } finally {
      setSyncing(false);
    }
  };

  const closeCodeForm = useCallback(() => {
    setCodeFormOpen(false);
    setEditingCode(null);
    setCodeForm({ ric_code: "", adc_code: "", alias: "" });
    setCodeError("");
  }, []);

  const openNewCodeForm = () => {
    setEditingCode(null);
    setCodeForm({ ric_code: "", adc_code: "", alias: "" });
    setCodeError("");
    setCodeFormOpen(true);
  };

  const saveCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCodeSaving(true);
    setCodeError("");
    try {
      if (editingCode === null) {
        await api.createRicCode(codeForm);
      } else {
        await api.updateRicCode(editingCode, codeForm);
      }
      await refreshCodes();
      setCodeFormOpen(false);
      setEditingCode(null);
      setCodeForm({ ric_code: "", adc_code: "", alias: "" });
      toast.success(editingCode === null ? "RiC-code toegevoegd." : "RiC-code bijgewerkt.");
    } catch (reason) {
      setCodeError(reason instanceof Error ? reason.message : "Opslaan is niet gelukt.");
    } finally {
      setCodeSaving(false);
    }
  };

  const removeCode = async (code: RicCode) => {
    if (!window.confirm(`RiC-code ${code.alias} verwijderen?`)) return;
    try {
      await api.deleteRicCode(code.id);
      await refreshCodes();
      toast.success("RiC-code verwijderd.");
    } catch (reason) {
      setCodeError(reason instanceof Error ? reason.message : "Verwijderen is niet gelukt.");
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Assetbeheer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Pagers</h1>
          <p className="mt-2 text-sm text-muted-foreground">Beheer toestellen en RiC-codes.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {activeTab === "devices" && user?.is_staff && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void startFireplanSync()}
                disabled={syncing}
                aria-label="Synchroniseer met Fireplan"
                title="Synchroniseer met Fireplan"
                className="h-9 w-9"
              >
                <CloudRefreshIcon syncing={syncing} />
              </Button>
              {activeSyncId && (
                <Button variant="outline" size="sm" asChild>
                  <Link
                    to={`/tasks/${encodeURIComponent(activeSyncId)}`}
                    aria-label="Laatste synchronisatie"
                    title="Laatste synchronisatie"
                  >
                    <History className="h-4 w-4" />Rapport
                  </Link>
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void (activeTab === "devices" ? refresh() : refreshCodes())}
            disabled={activeTab === "devices" ? loading : codesLoading}
            aria-label="Lijst vernieuwen"
            title="Lijst vernieuwen"
            className="h-9 w-9 px-0"
          >
            <RotateCw
              className={`h-4 w-4 ${(activeTab === "devices" ? loading : codesLoading) ? "animate-spin" : ""}`}
            />
          </Button>
          {activeTab === "devices" ? (
            <Button size="icon" onClick={openCreateForm} aria-label="Pager toevoegen" title="Nieuw toestel" className="h-9 w-9">
              <Plus className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={openNewCodeForm} aria-label="RiC-code toevoegen" title="Nieuwe RiC-code" className="h-9 w-9">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex border-b" role="tablist" aria-label="Pagerbeheer">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "devices"}
          className={`border-b-2 px-4 py-3 text-sm ${activeTab === "devices" ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}
          onClick={() => setActiveTab("devices")}
        >
          Toestellen
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "codes"}
          className={`border-b-2 px-4 py-3 text-sm ${activeTab === "codes" ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}
          onClick={() => {
            setActiveTab("codes");
            void refreshCodes();
          }}
        >
          RiC-codes
        </button>
      </div>

      {syncError && (
        <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">
          {syncError}
        </div>
      )}

      {formOpen && activeTab === "devices" && (
        <ModalDialog
          title={editingPager ? "Toestel bewerken" : "Toestel toevoegen"}
          onClose={closeForm}
        >
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void savePager(event)}>
            <label className="space-y-2 text-sm font-medium" htmlFor="pager-serial">
              Serienummer
              <Input
                id="pager-serial"
                autoFocus
                autoComplete="off"
                required
                maxLength={100}
                value={form.serial_number}
                onChange={(event) => setForm({ ...form, serial_number: event.target.value })}
              />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="pager-type">
              Type
              <select
                id="pager-type"
                required
                value={form.type_id}
                onChange={(event) => setForm({ ...form, type_id: event.target.value })}
                className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm"
                disabled={types.length === 0}
              >
                <option value="" disabled>Kies een type</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </label>
            {formError && (
              <p role="alert" className="text-sm text-red-700 sm:col-span-2">{formError}</p>
            )}
            {types.length === 0 && (
              <p className="text-sm text-red-700 sm:col-span-2">
                Er zijn geen pagertypes beschikbaar.
              </p>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving || types.length === 0}>
                {saving ? "Opslaan…" : "Opslaan"}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
                Annuleren
              </Button>
            </div>
          </form>
        </ModalDialog>
      )}

      {activeTab === "devices" && (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <CardTitle>Toestellen</CardTitle>
              <CardDescription>
                {pagers.length} {pagers.length === 1 ? "pager" : "pagers"} geregistreerd
              </CardDescription>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <label className="relative min-w-48 flex-1 sm:w-72 sm:flex-none">
                <span className="sr-only">Pagers zoeken</span>
                <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={pagerQuery} onChange={(event) => setPagerQuery(event.target.value)} placeholder="Zoek pager of type" />
              </label>
              <PagerScanControl onScan={async (raw) => {
                try {
                  const result = await api.scanPager(raw);
                  setPagerQuery(result.pager.serial_number);
                } catch (reason) {
                  toast.error(reason instanceof Error ? reason.message : "Pager scannen is niet gelukt.");
                }
              }} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <div
                role="alert"
                className="m-4 flex items-center justify-between border-l-2 border-red-500 bg-red-50 p-4 text-sm"
              >
                {error}
                <Button variant="outline" size="sm" onClick={() => void refresh()}>
                  Opnieuw proberen
                </Button>
              </div>
            ) : loading ? (
              <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
                <RotateCw className="h-4 w-4 animate-spin" />Pagers laden…
              </div>
            ) : pagers.length === 0 ? (
              <div className="p-12 text-center">
                <Radio className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Nog geen pagers</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Voeg de eerste pager toe om de assetlijst op te bouwen.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[42%]" />
                    <col className="w-[38%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      {([
                        ["serial_number", "Serienummer"],
                        ["type", "Type"],
                      ] as const).map(([column, label]) => {
                        const active = pagerSort.column === column;
                        const Icon = !active ? ArrowDownUp : pagerSort.direction === "ascending" ? ArrowUp : ArrowDown;
                        return <th key={column} scope="col" aria-sort={active ? pagerSort.direction : undefined} className="px-4 py-3 align-middle font-normal">
                          <button type="button" className="inline-flex items-center gap-2 whitespace-nowrap font-medium" aria-label={`Sorteer op ${label.toLocaleLowerCase("nl-BE")}`} onClick={() => togglePagerSort(column)}>
                            {label}<Icon aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </th>;
                      })}
                      <th scope="col" className="px-4 py-3 text-right align-middle font-medium">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedPagers.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Geen pagers gevonden voor deze zoekopdracht.</td></tr>}
                    {sortedPagers.map((pager) => (
                      <tr key={pager.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{pager.serial_number}</td>
                        <td className="px-4 py-3">{pager.type.name}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Bewerk pager ${pager.serial_number}`}
                              onClick={() => openEditForm(pager)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Bewerken</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Verwijder pager ${pager.serial_number}`}
                              onClick={() => void removePager(pager)}
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
      )}

      {activeTab === "codes" && (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <CardTitle>RiC-codes</CardTitle>
              <CardDescription>
                {ricCodes.length} {ricCodes.length === 1 ? "combinatie" : "combinaties"} geregistreerd
              </CardDescription>
            </div>
            <label className="relative w-full sm:w-72">
              <span className="sr-only">RiC-codes zoeken</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={codeQuery} onChange={(event) => setCodeQuery(event.target.value)} placeholder="Zoek RiC, AdC of alias" />
            </label>
          </CardHeader>
          <CardContent className="p-0">
            {codeError && <p role="alert" className="m-4 text-sm text-red-700">{codeError}</p>}
            {codesLoading ? <p className="p-8 text-sm text-muted-foreground">RiC-codes laden…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[44%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      {([
                        ["ric_code", "RiC"],
                        ["adc_code", "AdC"],
                        ["alias", "Alias"],
                      ] as const).map(([column, label]) => {
                        const active = codeSort.column === column;
                        const Icon = !active ? ArrowDownUp : codeSort.direction === "ascending" ? ArrowUp : ArrowDown;
                        return <th key={column} scope="col" aria-sort={active ? codeSort.direction : undefined} className="px-4 py-3 align-middle font-normal">
                          <button type="button" className="inline-flex items-center gap-2 whitespace-nowrap font-medium" aria-label={`Sorteer op ${label.toLocaleLowerCase("nl-BE")}`} onClick={() => toggleCodeSort(column)}>
                            {label}<Icon aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </th>;
                      })}
                      <th scope="col" className="px-4 py-3 text-right align-middle font-medium">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedRicCodes.length === 0 && ricCodes.length > 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Geen RiC-codes gevonden voor deze zoekopdracht.</td></tr>}
                    {sortedRicCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{code.ric_code}</td>
                        <td className="px-4 py-3">{code.adc_code}</td>
                        <td className="px-4 py-3">{code.alias}</td>
                        <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Bewerk code ${code.alias}`}
                            title={`Bewerk code ${code.alias}`}
                            onClick={() => {
                              setEditingCode(code.id);
                              setCodeForm({
                                ric_code: code.ric_code,
                                adc_code: code.adc_code,
                                alias: code.alias,
                              });
                              setCodeFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Bewerken</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Verwijder code ${code.alias}`}
                            title={`Verwijder code ${code.alias}`}
                            onClick={() => void removeCode(code)}
                          >
                            <Trash2 className="h-4 w-4 text-red-700" />
                            <span className="sr-only">Verwijderen</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                {ricCodes.length === 0 && (
                  <p className="p-8 text-sm text-muted-foreground">Nog geen RiC-codes geregistreerd.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {codeFormOpen && activeTab === "codes" && (
        <ModalDialog
          title={editingCode === null ? "RiC-code toevoegen" : "RiC-code bewerken"}
          onClose={closeCodeForm}
        >
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void saveCode(event)}
          >
            <label className="space-y-2 text-sm font-medium" htmlFor="ric-code">
              RiC-code
              <Input
                id="ric-code"
                autoFocus
                required
                inputMode="numeric"
                pattern="[0-9]+"
                value={codeForm.ric_code}
                onChange={(event) => setCodeForm({ ...codeForm, ric_code: event.target.value })}
              />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="adc-code">
              AdC-code
              <Input
                id="adc-code"
                required
                inputMode="numeric"
                pattern="[0-9]+"
                value={codeForm.adc_code}
                onChange={(event) => setCodeForm({ ...codeForm, adc_code: event.target.value })}
              />
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="ric-code-alias">
              Alias
              <Input
                id="ric-code-alias"
                required
                maxLength={100}
                value={codeForm.alias}
                onChange={(event) => setCodeForm({ ...codeForm, alias: event.target.value })}
              />
            </label>
            {codeError && (
              <p role="alert" className="text-sm text-red-700 sm:col-span-2">{codeError}</p>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={codeSaving}>
                {codeSaving ? "Opslaan…" : editingCode === null ? "Code toevoegen" : "Code bewaren"}
              </Button>
              <Button type="button" variant="outline" disabled={codeSaving} onClick={closeCodeForm}>
                Annuleren
              </Button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
}
