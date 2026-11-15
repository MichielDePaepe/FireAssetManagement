import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CloudDownload,
  History,
  Pencil,
  Plus,
  Radio,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Pager, type PagerType, type RicCode } from "@/lib/api";

interface PagerFormState {
  serial_number: string;
  type_id: string;
}

const emptyForm: PagerFormState = { serial_number: "", type_id: "" };

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
                size="sm"
                onClick={() => void startFireplanSync()}
                disabled={syncing}
                aria-label="Synchroniseer met Fireplan"
                title="Synchroniseer met Fireplan"
              >
                <CloudDownload className={`h-4 w-4 ${syncing ? "animate-bounce" : ""}`} />
                {syncing ? "Synchroniseren…" : "Fireplan sync"}
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
            <Button size="sm" onClick={openCreateForm} aria-label="Pager toevoegen">
              <Plus className="h-4 w-4" />Nieuw toestel
            </Button>
          ) : (
            <Button size="sm" onClick={openNewCodeForm} aria-label="RiC-code toevoegen">
              <Plus className="h-4 w-4" />Nieuwe RiC-code
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
          <CardHeader>
            <CardTitle>Toestellen</CardTitle>
            <CardDescription>
              {pagers.length} {pagers.length === 1 ? "pager" : "pagers"} geregistreerd
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
                <RotateCw className="h-4 w-4 animate-spin" />Pagers laden…
              </div>
            ) : pagers.length === 0 ? (
              <div className="py-12 text-center">
                <Radio className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Nog geen pagers</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Voeg de eerste pager toe om de assetlijst op te bouwen.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-3 pr-4 font-medium">Serienummer</th>
                      <th scope="col" className="py-3 pr-4 font-medium">Type</th>
                      <th scope="col" className="py-3 text-right font-medium">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagers.map((pager) => (
                      <tr key={pager.id} className="hover:bg-muted/30">
                        <td className="py-3 pr-4 font-medium">{pager.serial_number}</td>
                        <td className="py-3 pr-4">{pager.type.name}</td>
                        <td className="py-3 text-right">
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
          <CardHeader>
            <CardTitle>RiC-codes</CardTitle>
            <CardDescription>
              {ricCodes.length} {ricCodes.length === 1 ? "combinatie" : "combinaties"} geregistreerd
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {codeError && <p role="alert" className="text-sm text-red-700">{codeError}</p>}
            {codesLoading ? <p className="text-sm text-muted-foreground">RiC-codes laden…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-3 pr-4 font-medium">RiC</th>
                      <th scope="col" className="py-3 pr-4 font-medium">AdC</th>
                      <th scope="col" className="py-3 pr-4 font-medium">Alias</th>
                      <th scope="col" className="py-3 text-right font-medium">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">{ricCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{code.ric_code}</td>
                      <td className="py-3 pr-4">{code.adc_code}</td>
                      <td className="py-3 pr-4">{code.alias}</td>
                      <td className="py-3 text-right">
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
                  <p className="py-4 text-sm text-muted-foreground">Nog geen RiC-codes geregistreerd.</p>
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

interface ModalDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function ModalDialog({ title, onClose, children }: ModalDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[autofocus]")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-edit-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto"
      >
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle id="asset-edit-dialog-title">{title}</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Sluiten"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </section>
    </div>,
    document.body,
  );
}
