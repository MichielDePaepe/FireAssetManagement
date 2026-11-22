import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, Filter, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { PagerScanControl } from "@/components/PagerScanControl";
import { CloudRefreshIcon } from "@/components/CloudRefreshIcon";
import { ModalDialog } from "@/components/ModalDialog";
import { TableFilterPopover } from "@/components/TableFilterPopover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type IssiAsset, type Organization, type RadioAsset, type RadioModel, type RadioSubscription, type RadioSubscriptionImportResult } from "@/lib/api";

type RadioTab = "radios" | "issis" | "subscriptions";
type SortDirection = "ascending" | "descending";
type RadioColumn = "tei" | "model" | "fireplan_id" | "issi";
type IssiColumn = "issi" | "alias" | "organization" | "radio";
type SubscriptionColumn = "radio" | "issi" | "type" | "dates";

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "nl-BE", { numeric: true, sensitivity: "base" });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function radioType(radio: RadioAsset): string {
  if (radio.model) return `${radio.model.manufacturer} ${radio.model.name}`;
  return radio.model_name || radio.manufacturer || "Model onbekend";
}

function addCalendarMonths(date: Date, months: number): Date {
  const absoluteMonth = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12;
  const day = Math.min(date.getDate(), new Date(year, month + 1, 0).getDate());
  return new Date(year, month, day, date.getHours(), date.getMinutes(), date.getSeconds());
}

function formatSubscriptionDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  if (end < start) return "0 dagen";

  let years = end.getFullYear() - start.getFullYear();
  let cursor = addCalendarMonths(start, years * 12);
  if (cursor > end) {
    years -= 1;
    cursor = addCalendarMonths(start, years * 12);
  }

  let months = (end.getFullYear() - cursor.getFullYear()) * 12 + end.getMonth() - cursor.getMonth();
  let monthCursor = addCalendarMonths(cursor, months);
  if (monthCursor > end) {
    months -= 1;
    monthCursor = addCalendarMonths(cursor, months);
  }
  const startDay = Date.UTC(monthCursor.getFullYear(), monthCursor.getMonth(), monthCursor.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const days = Math.floor((endDay - startDay) / 86_400_000);
  const parts = [
    years ? `${years} jaar` : "",
    months ? `${months} ${months === 1 ? "maand" : "maanden"}` : "",
    days ? `${days} ${days === 1 ? "dag" : "dagen"}` : "",
  ].filter(Boolean);
  return parts.join(", ") || "0 dagen";
}

export function RadioManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = Boolean(user?.is_staff);
  const [activeTab, setActiveTab] = useState<RadioTab>("radios");
  const [radios, setRadios] = useState<RadioAsset[]>([]);
  const [issis, setIssis] = useState<IssiAsset[]>([]);
  const [subscriptions, setSubscriptions] = useState<RadioSubscription[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [models, setModels] = useState<RadioModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [modelFilters, setModelFilters] = useState<string[]>([]);
  const [openModelFilterAnchor, setOpenModelFilterAnchor] = useState<HTMLElement | null>(null);
  const [subscriptionQuery, setSubscriptionQuery] = useState("");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<RadioSubscriptionImportResult | null>(null);
  const [radioPickerQuery, setRadioPickerQuery] = useState("");
  const [issiPickerQuery, setIssiPickerQuery] = useState("");
  const [radioSort, setRadioSort] = useState<{ column: RadioColumn; direction: SortDirection }>({
    column: "tei", direction: "ascending",
  });
  const [issiSort, setIssiSort] = useState<{ column: IssiColumn; direction: SortDirection }>({
    column: "issi", direction: "ascending",
  });
  const [subscriptionSort, setSubscriptionSort] = useState<{ column: SubscriptionColumn; direction: SortDirection }>({
    column: "radio", direction: "ascending",
  });
  const [selectedIssiId, setSelectedIssiId] = useState<number | null>(null);
  const [radioFormOpen, setRadioFormOpen] = useState(false);
  const [editingRadio, setEditingRadio] = useState<RadioAsset | null>(null);
  const [radioFormError, setRadioFormError] = useState("");
  const [radioForm, setRadioForm] = useState({
    tei: "", manufacturer: "", model_name: "", model_id: "",
  });
  const [issiFormOpen, setIssiFormOpen] = useState(false);
  const [editingIssi, setEditingIssi] = useState<IssiAsset | null>(null);
  const [issiFormError, setIssiFormError] = useState("");
  const [issiForm, setIssiForm] = useState({ issi: "", alias: "", organization_id: "" });
  const [assignmentForm, setAssignmentForm] = useState({ radio_id: "", issi_id: "" });
  const [assignmentError, setAssignmentError] = useState("");
  const [syncError, setSyncError] = useState("");

  const radioTypesById = useMemo(
    () => new Map<number, string>(radios.map((radio) => [radio.id, radioType(radio)] as const)),
    [radios],
  );
  const modelFilterOptions = useMemo(() => [...new Set(radioTypesById.values())]
    .sort((left, right) => compareText(left, right))
    .map((value) => ({ value, label: value })), [radioTypesById]);

  const visibleSubscriptions = useMemo(() => {
    const needle = subscriptionQuery.trim().toLocaleLowerCase("nl-BE");
    const direction = subscriptionSort.direction === "ascending" ? 1 : -1;
    const rows = subscriptions.filter((item) => !needle || [item.radio.tei, radioTypesById.get(item.radio.id) ?? "", item.issi.issi]
      .join(" ").toLocaleLowerCase("nl-BE").includes(needle));
    return rows.sort((left, right) => {
      let comparison = 0;
      switch (subscriptionSort.column) {
        case "radio": comparison = compareText(left.radio.tei, right.radio.tei); break;
        case "issi": comparison = compareText(left.issi.issi, right.issi.issi); break;
        case "type": comparison = compareText(radioTypesById.get(left.radio.id) ?? "Onbekend", radioTypesById.get(right.radio.id) ?? "Onbekend"); break;
        case "dates": comparison = Date.parse(left.started_at) - Date.parse(right.started_at); break;
      }
      return comparison * direction || left.id - right.id;
    });
  }, [radioTypesById, subscriptionQuery, subscriptionSort, subscriptions]);

  const activeSubscriptionCount = subscriptions.filter((item) => item.ended_at === null).length;

  const radioChoices = useMemo(() => {
    const needle = radioPickerQuery.trim().toLocaleLowerCase("nl-BE");
    return radios.filter((radio) => !needle || [radio.tei, radio.model?.name, radio.model_name, radio.manufacturer]
      .join(" ").toLocaleLowerCase("nl-BE").includes(needle));
  }, [radioPickerQuery, radios]);

  const issiChoices = useMemo(() => {
    const needle = issiPickerQuery.trim().toLocaleLowerCase("nl-BE");
    return issis.filter((item) => !needle || [item.issi, item.alias, item.organization?.name]
      .join(" ").toLocaleLowerCase("nl-BE").includes(needle));
  }, [issiPickerQuery, issis]);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError("");
    try {
      const [radioRows, issiRows, subscriptionRows, organizationRows, modelRows] = await Promise.all([
        api.listRadios(), api.listIssis(), api.listRadioSubscriptions(), api.listOrganizations(),
        api.listRadioModels(),
      ]);
      setRadios(radioRows);
      setIssis(issiRows);
      setSubscriptions(subscriptionRows);
      setOrganizations(organizationRows);
      setModels(modelRows);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Radio-inventaris laden is niet gelukt.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visibleRadios = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    const rows = radios.filter((radio) => {
      const active = radio.current_subscription;
      const searchable = [
        radio.tei, radio.manufacturer, radio.model_name, radio.model?.manufacturer, radio.model?.name,
        String(radio.fireplan_id ?? ""), radio.fireplan_qr_url, active?.issi.issi, active?.issi.alias,
      ].join(" ").toLocaleLowerCase("nl-BE");
      return (!needle || searchable.includes(needle))
        && (!modelFilters.length || modelFilters.includes(radioTypesById.get(radio.id) ?? "Onbekend"));
    });
    const direction = radioSort.direction === "ascending" ? 1 : -1;
    return rows.sort((left, right) => {
      const value = (radio: RadioAsset) => {
        switch (radioSort.column) {
          case "tei": return radio.tei;
          case "model": return radioType(radio);
          case "fireplan_id": return String(radio.fireplan_id ?? "");
          case "issi": return radio.current_subscription?.issi.issi ?? "";
        }
      };
      return compareText(value(left), value(right)) * direction || left.id - right.id;
    });
  }, [modelFilters, query, radioSort, radioTypesById, radios]);

  const visibleIssis = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    const rows = issis.filter((item) => {
      const active = item.current_subscription;
      const searchable = [item.issi, item.alias, item.organization?.name, active?.radio.tei]
        .join(" ").toLocaleLowerCase("nl-BE");
      return !needle || searchable.includes(needle);
    });
    const direction = issiSort.direction === "ascending" ? 1 : -1;
    return rows.sort((left, right) => {
      const value = (item: IssiAsset) => {
        switch (issiSort.column) {
          case "issi": return item.issi;
          case "alias": return item.alias;
          case "organization": return item.organization?.name ?? "";
          case "radio": return item.current_subscription?.radio.tei ?? "";
        }
      };
      return compareText(value(left), value(right)) * direction || left.id - right.id;
    });
  }, [issiSort, issis, query]);

  const selectedIssi = issis.find((item) => item.id === selectedIssiId) ?? null;

  function toggleRadioSort(column: RadioColumn) {
    setRadioSort((current) => ({
      column,
      direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
    }));
  }

  function toggleIssiSort(column: IssiColumn) {
    setIssiSort((current) => ({
      column,
      direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
    }));
  }

  function toggleModelFilter(anchor: HTMLElement) {
    setOpenModelFilterAnchor((current) => current ? null : anchor);
  }

  function toggleSubscriptionSort(column: SubscriptionColumn) {
    setSubscriptionSort((current) => ({
      column,
      direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
    }));
  }

  function openRadioForm(radio: RadioAsset | null = null) {
    setEditingRadio(radio);
    setRadioFormError("");
    setRadioForm(radio ? {
      tei: radio.tei,
      manufacturer: radio.manufacturer,
      model_name: radio.model_name,
      model_id: radio.model?.id ? String(radio.model.id) : "",
    } : { tei: "", manufacturer: "", model_name: "", model_id: "" });
    setRadioFormOpen(true);
  }

  async function saveRadio(event: FormEvent) {
    event.preventDefault();
    setRadioFormError("");
    const values = {
      tei: radioForm.tei,
      manufacturer: radioForm.manufacturer,
      model_name: radioForm.model_name,
      ...(radioForm.model_id ? { model_id: Number(radioForm.model_id) } : {}),
    };
    try {
      if (editingRadio) await api.updateRadio(editingRadio.id, values);
      else await api.createRadio(values);
      setRadioFormOpen(false);
      setEditingRadio(null);
      toast.success(editingRadio ? "Radio bijgewerkt." : "Radio toegevoegd.");
      await refresh();
    } catch (reason) {
      setRadioFormError(reason instanceof Error ? reason.message : "Radio opslaan is niet gelukt.");
    }
  }

  async function removeRadio(radio: RadioAsset) {
    if (!window.confirm(`Radio ${radio.tei} verwijderen?`)) return;
    try {
      await api.deleteRadio(radio.id);
      toast.success("Radio verwijderd.");
      await refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Radio verwijderen is niet gelukt.");
    }
  }

  async function startRadioSync() {
    setSyncError("");
    try {
      const task = await api.startFireplanRadioSync();
      window.localStorage.setItem("activeFireplanSyncId", task.task_id);
      window.dispatchEvent(new Event("fireplan-sync-task-change"));
      navigate(`/tasks/${encodeURIComponent(task.task_id)}`);
    } catch (reason) {
      setSyncError(reason instanceof Error ? reason.message : "Radiosynchronisatie starten is niet gelukt.");
    }
  }

  function openIssiForm(item: IssiAsset | null = null) {
    setEditingIssi(item);
    setIssiFormError("");
    setIssiForm(item ? {
      issi: item.issi, alias: item.alias, organization_id: item.organization?.id ? String(item.organization.id) : "",
    } : { issi: "", alias: "", organization_id: "" });
    setIssiFormOpen(true);
  }

  async function saveIssi(event: FormEvent) {
    event.preventDefault();
    setIssiFormError("");
    const values = {
      issi: issiForm.issi,
      alias: issiForm.alias,
      organization_id: issiForm.organization_id ? Number(issiForm.organization_id) : null,
    };
    try {
      if (editingIssi) await api.updateIssi(editingIssi.id, values);
      else await api.createIssi(values);
      setIssiFormOpen(false);
      setEditingIssi(null);
      toast.success(editingIssi ? "ISSI bijgewerkt." : "ISSI toegevoegd.");
      await refresh();
    } catch (reason) {
      setIssiFormError(reason instanceof Error ? reason.message : "ISSI opslaan is niet gelukt.");
    }
  }

  async function removeIssi(item: IssiAsset) {
    if (!window.confirm(`ISSI ${item.issi} verwijderen?`)) return;
    try {
      await api.deleteIssi(item.id);
      if (selectedIssiId === item.id) setSelectedIssiId(null);
      toast.success("ISSI verwijderd.");
      await refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "ISSI verwijderen is niet gelukt.");
    }
  }

  async function assignSubscription(event: FormEvent) {
    event.preventDefault();
    setAssignmentError("");
    try {
      await api.assignRadioSubscription(Number(assignmentForm.radio_id), Number(assignmentForm.issi_id));
      setAssignmentForm({ radio_id: "", issi_id: "" });
      setAssignmentOpen(false);
      setRadioPickerQuery("");
      setIssiPickerQuery("");
      toast.success("Abonnement bijgewerkt.");
      await refresh();
    } catch (reason) {
      setAssignmentError(reason instanceof Error ? reason.message : "Abonnement wijzigen is niet gelukt.");
    }
  }

  function openImport() {
    setImportFile(null);
    setImportError("");
    setImportResult(null);
    setImportOpen(true);
  }

  const closeImport = useCallback(() => setImportOpen(false), []);

  async function importSubscriptions(event: FormEvent) {
    event.preventDefault();
    if (!importFile) {
      setImportError("Selecteer eerst een CSV-bestand.");
      return;
    }
    setImportBusy(true);
    setImportError("");
    setImportResult(null);
    try {
      const result = await api.importRadioSubscriptions(importFile);
      setImportResult(result);
      await refresh(false);
      toast.success("ASTRID-abonnementen verwerkt.");
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : "Het bestand verwerken is niet gelukt.");
    } finally {
      setImportBusy(false);
    }
  }

  function openAssignmentForm() {
    setAssignmentError("");
    setAssignmentForm({ radio_id: "", issi_id: "" });
    setRadioPickerQuery("");
    setIssiPickerQuery("");
    setAssignmentOpen(true);
  }

  function sortedHeader(
    label: string,
    column: string,
    active: boolean,
    direction: SortDirection,
    onClick: () => void,
    filter?: { selectedCount: number; open: boolean; onToggle: (anchor: HTMLElement) => void },
  ) {
    const Icon = !active ? ArrowDownUp : direction === "ascending" ? ArrowUp : ArrowDown;
    return <th key={column} scope="col" aria-sort={active ? direction : undefined} className="px-4 py-3 align-middle font-normal">
      <div className="flex min-h-6 items-center gap-2 whitespace-nowrap">
        <button type="button" className="inline-flex min-w-0 items-center gap-2 font-medium" aria-label={`Sorteer op ${label.toLocaleLowerCase("nl-BE")}`} onClick={onClick}>
          {label}<Icon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        {filter && <button
          type="button"
          className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center border ${filter.selectedCount ? "text-primary" : "text-muted-foreground"}`}
          aria-label={`${filter.open ? "Sluit" : "Open"} filter voor ${label}${filter.selectedCount ? `, ${filter.selectedCount} geselecteerd` : ""}`}
          title={`Filter op ${label.toLocaleLowerCase("nl-BE")}`}
          aria-expanded={filter.open}
          onClick={(event) => filter.onToggle(event.currentTarget)}
        >
          <Filter aria-hidden="true" className="h-3.5 w-3.5" />
          {filter.selectedCount > 0 && <span aria-hidden="true" className="absolute -right-3 -top-2 grid h-4 min-w-4 place-items-center !rounded-full bg-primary px-1 text-[9px] leading-none text-primary-foreground">{filter.selectedCount}</span>}
        </button>}
      </div>
    </th>;
  }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Radio-inventaris laden…</p>;
  if (loadError) return <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{loadError}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Assetbeheer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Radio's</h1>
          <p className="mt-2 text-sm text-muted-foreground">Radio's, ISSI's, abonnementen en configureerbare TEI-modelbereiken.</p>
        </div>
        {isStaff && <div className="flex flex-wrap items-center gap-2">
          {activeTab === "radios" && <>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => void startRadioSync()} aria-label="Synchroniseer met FirePlan" title="Synchroniseer met FirePlan"><CloudRefreshIcon /></Button>
            <Button type="button" size="icon" className="h-9 w-9" onClick={() => openRadioForm()} aria-label="Radio toevoegen" title="Nieuwe radio"><Plus className="h-4 w-4" /></Button>
          </>}
          {activeTab === "issis" && <Button type="button" size="icon" className="h-9 w-9" onClick={() => openIssiForm()} aria-label="ISSI toevoegen" title="Nieuwe ISSI"><Plus className="h-4 w-4" /></Button>}
          {activeTab === "subscriptions" && <>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={openImport} aria-label="Abonnementen importeren" title="Abonnementen importeren"><Upload className="h-4 w-4" /></Button>
            <Button type="button" size="icon" className="h-9 w-9" onClick={openAssignmentForm} aria-label="Abonnement toevoegen" title="Nieuw abonnement"><Plus className="h-4 w-4" /></Button>
          </>}
        </div>}
      </div>

      <div role="tablist" aria-label="Radiobeheer" className="flex flex-wrap gap-2 border-b">
        {([["radios", "Toestellen"], ["issis", "ISSI's"], ["subscriptions", "Abonnementen"]] as const).map(([tab, label]) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={`border-b-2 px-4 py-2.5 text-sm ${activeTab === tab ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`} onClick={() => { setActiveTab(tab); setQuery(""); setOpenModelFilterAnchor(null); }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "radios" && <Card>
        <CardHeader className="flex-col items-stretch gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div><CardTitle>Radio's</CardTitle><CardDescription>{radios.length} geregistreerd</CardDescription></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Radio's zoeken</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="radio-module-search" type="search" role="searchbox" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek TEI, model of ISSI" />
            </label>
            <PagerScanControl subject="Radio" onScan={async (raw) => {
              try { const result = await api.lookupRadioScan(raw); navigate(`/radios/${result.radio.id}`); }
              catch (reason) { toast.error(reason instanceof Error ? reason.message : "Radio scannen is niet gelukt."); }
            }} />
            {syncError && <p role="alert" className="w-full text-sm text-red-700">{syncError}</p>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {radios.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className={isStaff ? "w-[22%]" : "w-[25%]"} />
              <col className={isStaff ? "w-[29%]" : "w-[34%]"} />
              <col className={isStaff ? "w-[16%]" : "w-[18%]"} />
              <col className={isStaff ? "w-[19%]" : "w-[23%]"} />
              {isStaff && <col className="w-[14%]" />}
            </colgroup>
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
              {sortedHeader("TEI", "tei", radioSort.column === "tei", radioSort.direction, () => toggleRadioSort("tei"))}
              {sortedHeader("Model", "model", radioSort.column === "model", radioSort.direction, () => toggleRadioSort("model"), {
                selectedCount: modelFilters.length,
                open: openModelFilterAnchor !== null,
                onToggle: toggleModelFilter,
              })}
              {sortedHeader("FirePlan-ID", "fireplan_id", radioSort.column === "fireplan_id", radioSort.direction, () => toggleRadioSort("fireplan_id"))}
              {sortedHeader("ISSI", "issi", radioSort.column === "issi", radioSort.direction, () => toggleRadioSort("issi"))}
              {isStaff && <th scope="col" className="px-4 py-3 text-right align-middle font-medium">Acties</th>}
            </tr></thead>
            <tbody className="divide-y">
              {visibleRadios.map((radio) => <tr key={radio.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono"><Link className="hover:underline" aria-label={`Details radio ${radio.tei}`} to={`/radios/${radio.id}`}>{radio.tei}</Link></td>
                <td className="px-4 py-3">{radioType(radio)}</td>
                <td className="px-4 py-3">{radio.fireplan_id ?? "—"}</td>
                <td className="px-4 py-3">{radio.current_subscription?.issi.issi ?? "Geen ISSI"}</td>
                {isStaff && <td className="px-4 py-3 text-right"><div className="inline-flex gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Bewerk radio ${radio.tei}`} title={`Bewerk radio ${radio.tei}`} onClick={() => openRadioForm(radio)}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Verwijder radio ${radio.tei}`} title={`Verwijder radio ${radio.tei}`} onClick={() => void removeRadio(radio)}><Trash2 className="h-4 w-4 text-red-700" /></Button>
                </div></td>}
              </tr>)}
              {!visibleRadios.length && <tr><td colSpan={isStaff ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">Geen radio's gevonden.</td></tr>}
            </tbody>
          </table></div>}
          {radios.length === 0 && <p className="p-8 text-sm text-muted-foreground">Nog geen radio's geregistreerd.</p>}
        </CardContent>
      </Card>}

      {radioFormOpen && activeTab === "radios" && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setRadioFormOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="radio-form-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border bg-background p-5 shadow-xl" onKeyDown={(event) => { if (event.key === "Escape") setRadioFormOpen(false); }}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 id="radio-form-title" className="text-lg font-semibold">{editingRadio ? `Radio ${editingRadio.tei} bewerken` : "Radio toevoegen"}</h2><p className="text-sm text-muted-foreground">Pas de toestelgegevens aan.</p></div>
            <Button type="button" variant="ghost" size="icon" aria-label="Sluiten" title="Sluiten" onClick={() => setRadioFormOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          <form onSubmit={(event) => void saveRadio(event)} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium" htmlFor="radio-tei">TEI<Input id="radio-tei" autoFocus required maxLength={15} pattern="[0-9]{14,15}" value={radioForm.tei} onChange={(event) => setRadioForm({ ...radioForm, tei: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="radio-manufacturer">Fabrikant<Input id="radio-manufacturer" value={radioForm.manufacturer} onChange={(event) => setRadioForm({ ...radioForm, manufacturer: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="radio-model-name">Modelnaam<Input id="radio-model-name" value={radioForm.model_name} onChange={(event) => setRadioForm({ ...radioForm, model_name: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2" htmlFor="radio-model-reference">TEI-modelreferentie<select id="radio-model-reference" className="flex h-10 w-full border bg-white px-3 text-sm" value={radioForm.model_id} onChange={(event) => setRadioForm({ ...radioForm, model_id: event.target.value })}><option value="">Automatisch op TEI-bereik</option>{models.map((model) => <option key={model.id} value={model.id}>{model.manufacturer} {model.name}</option>)}</select></label>
            {editingRadio && <dl className="grid gap-3 border bg-muted/20 p-3 text-sm sm:col-span-2 sm:grid-cols-2">
              <div><dt className="text-muted-foreground">FirePlan-ID</dt><dd className="font-medium">{editingRadio.fireplan_id ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Gekoppelde ISSI</dt><dd className="font-medium">{editingRadio.current_subscription ? `${editingRadio.current_subscription.issi.issi} · ${editingRadio.current_subscription.issi.alias}` : "Geen ISSI"}</dd></div>
              <div><dt className="text-muted-foreground">FirePlan-QR</dt><dd className="font-medium">{editingRadio.fireplan_qr_url ? <a className="underline" href={editingRadio.fireplan_qr_url} target="_blank" rel="noreferrer">QR openen</a> : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Geregistreerd / bijgewerkt</dt><dd className="font-medium">{formatDate(editingRadio.created_at)} · {formatDate(editingRadio.updated_at)}</dd></div>
            </dl>}
            {radioFormError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{radioFormError}</p>}
            <div className="flex justify-end gap-2 border-t pt-4 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setRadioFormOpen(false)}>Annuleren</Button><Button type="submit">Radio opslaan</Button></div>
          </form>
        </section>
      </div>}

      {activeTab === "issis" && <Card>
        <CardHeader className="flex-col items-stretch gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div><CardTitle>ISSI's</CardTitle><CardDescription>{issis.length} geregistreerd</CardDescription></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">ISSI's zoeken</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" role="searchbox" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek ISSI-nummer of alias" />
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] table-fixed border-collapse text-left text-sm">
            <colgroup><col className="w-[22%]" /><col className="w-[27%]" /><col className="w-[28%]" /><col className="w-[23%]" /></colgroup>
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
              {sortedHeader("ISSI", "issi", issiSort.column === "issi", issiSort.direction, () => toggleIssiSort("issi"))}
              {sortedHeader("Alias", "alias", issiSort.column === "alias", issiSort.direction, () => toggleIssiSort("alias"))}
              {sortedHeader("Organisatie", "organization", issiSort.column === "organization", issiSort.direction, () => toggleIssiSort("organization"))}
              <th scope="col" className="px-3 py-2.5 align-middle font-normal">Radio · Acties</th>
            </tr></thead>
            <tbody className="divide-y">
              {visibleIssis.map((item) => <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-mono"><button type="button" className="text-left hover:underline" aria-label={`Details ISSI ${item.issi}`} onClick={() => setSelectedIssiId(selectedIssiId === item.id ? null : item.id)}>{item.issi}</button></td>
                <td className="px-3 py-2.5">{item.alias}</td><td className="px-3 py-2.5">{item.organization?.name ?? "—"}</td>
                <td className="px-3 py-2.5"><div className="flex items-center justify-between gap-2"><span>{item.current_subscription?.radio.tei ?? "Geen radio"}</span><span className="inline-flex shrink-0 gap-1">{isStaff && <>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Bewerk ISSI ${item.issi}`} title={`Bewerk ISSI ${item.issi}`} onClick={() => openIssiForm(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Verwijder ISSI ${item.issi}`} title={`Verwijder ISSI ${item.issi}`} onClick={() => void removeIssi(item)}><Trash2 className="h-4 w-4 text-red-700" /></Button>
                </>}</span></div></td>
              </tr>)}
              {!visibleIssis.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Geen ISSI's gevonden.</td></tr>}
            </tbody>
          </table></div>
          {selectedIssi && <HistoryPanel title={`ISSI ${selectedIssi.issi}`} history={selectedIssi.subscription_history ?? []} onClose={() => setSelectedIssiId(null)} />}
          {issiFormOpen && <form onSubmit={(event) => void saveIssi(event)} className="grid gap-3 border-t p-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold sm:col-span-2">{editingIssi ? "ISSI bewerken" : "ISSI toevoegen"}</h2>
            <label className="space-y-1 text-sm font-medium" htmlFor="issi-number">ISSI<Input id="issi-number" required maxLength={20} value={issiForm.issi} onChange={(event) => setIssiForm({ ...issiForm, issi: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="issi-alias">Alias<Input id="issi-alias" required maxLength={120} value={issiForm.alias} onChange={(event) => setIssiForm({ ...issiForm, alias: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2" htmlFor="issi-organization">Organisatie<select id="issi-organization" className="flex h-10 w-full border bg-white px-3 text-sm" value={issiForm.organization_id} onChange={(event) => setIssiForm({ ...issiForm, organization_id: event.target.value })}><option value="">Geen organisatie</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            {issiFormError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{issiFormError}</p>}
            <div className="flex gap-2 sm:col-span-2"><Button type="submit">ISSI opslaan</Button><Button type="button" variant="outline" onClick={() => setIssiFormOpen(false)}>Annuleren</Button></div>
          </form>}
        </CardContent>
      </Card>}

      {activeTab === "subscriptions" && <Card>
        <CardHeader className="flex-col items-stretch gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div><CardTitle>Abonnementen</CardTitle><CardDescription>{activeSubscriptionCount} actief{activeSubscriptionCount === 1 ? " abonnement" : "e abonnementen"}</CardDescription></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Abonnementen zoeken</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" role="searchbox" className="pl-9" value={subscriptionQuery} onChange={(event) => setSubscriptionQuery(event.target.value)} placeholder="Zoek radio, ISSI of type" />
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
          <colgroup><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[25%]" /><col className="w-[35%]" /></colgroup>
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
            {sortedHeader("Radio", "radio", subscriptionSort.column === "radio", subscriptionSort.direction, () => toggleSubscriptionSort("radio"))}
            {sortedHeader("ISSI", "issi", subscriptionSort.column === "issi", subscriptionSort.direction, () => toggleSubscriptionSort("issi"))}
            {sortedHeader("Radiotype", "type", subscriptionSort.column === "type", subscriptionSort.direction, () => toggleSubscriptionSort("type"))}
            {sortedHeader("Start / einde", "dates", subscriptionSort.column === "dates", subscriptionSort.direction, () => toggleSubscriptionSort("dates"))}
          </tr></thead>
          <tbody className="divide-y">{visibleSubscriptions.map((item) => <tr key={item.id}>
            <td className="px-3 py-2.5 font-mono">{item.radio.tei}</td>
            <td className="px-3 py-2.5 font-mono">{item.issi.issi}</td>
            <td className="px-3 py-2.5">{radioTypesById.get(item.radio.id) ?? "Onbekend"}</td>
            <td className="px-3 py-2.5">
              <span className="block">{new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium" }).format(new Date(item.started_at))} – {item.ended_at ? new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium" }).format(new Date(item.ended_at)) : "Actief"}</span>
              <span className="block text-xs text-muted-foreground">Looptijd: {formatSubscriptionDuration(item.started_at, item.ended_at)}</span>
            </td>
          </tr>)}
            {!visibleSubscriptions.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Geen abonnementen gevonden.</td></tr>}</tbody>
        </table></div></CardContent>
      </Card>}

      {importOpen && isStaff && <ModalDialog title="ASTRID-abonnementen importeren" onClose={closeImport}>
        <CardContent>
          <form onSubmit={(event) => void importSubscriptions(event)} className="space-y-4">
            <p className="text-sm text-muted-foreground">Het ISSI-nummer komt uit de kolom IDENTIFIER; SERIAL_NUMBER en de ASTRID-datum worden niet gebruikt. TEI’s van 14 cijfers krijgen een nul achteraan; TEI’s van 15 cijfers blijven ongewijzigd. Andere lengtes worden geweigerd. Spare subscriptions worden overgeslagen. Bestaande actieve koppelingen in het bestand behouden hun startdatum; nieuwe starten bij upload. Actieve koppelingen die niet meer in het bestand staan, eindigen bij upload.</p>
            <label
              htmlFor="subscription-csv-file"
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed bg-muted/20 p-5 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dropped = event.dataTransfer.files[0];
                if (dropped) { setImportFile(dropped); setImportError(""); setImportResult(null); }
              }}
            >
              <Upload aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
              <span className="font-medium">Sleep het CSV-bestand hierheen</span>
              <span className="text-sm text-muted-foreground">of blader naar een bestand</span>
              <input
                id="subscription-csv-file"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                  setImportError("");
                  setImportResult(null);
                }}
              />
            </label>
            {importFile && <p className="text-sm" role="status">Geselecteerd bestand: <span className="font-medium">{importFile.name}</span></p>}
            {importError && <p role="alert" className="text-sm text-red-700">{importError}</p>}
            {importResult && <div role="status" className="space-y-1 border bg-muted/20 p-3 text-sm">
              <p>{importResult.subscriptions} abonnementregels verwerkt uit {importResult.rows} CSV-regels.</p>
              <p>{importResult.created_radios} radio’s en {importResult.created_issis} ISSI’s nieuw aangemaakt.</p>
              <p>{importResult.ended_subscriptions} bestaande koppelingen beëindigd.</p>
              <p>{importResult.skipped} regels overgeslagen.</p>
              {importResult.issues.length > 0 && <ul className="max-h-32 list-inside list-disc overflow-y-auto text-muted-foreground">{importResult.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
            </div>}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={closeImport}>Sluiten</Button>
              <Button type="submit" disabled={!importFile || importBusy}>{importBusy ? "Bezig met verwerken…" : "Verwerken"}</Button>
            </div>
          </form>
        </CardContent>
      </ModalDialog>}

      {activeTab === "radios" && openModelFilterAnchor && <TableFilterPopover
        anchor={openModelFilterAnchor}
        label="Model"
        options={modelFilterOptions}
        selected={modelFilters}
        onChange={setModelFilters}
        onClose={() => setOpenModelFilterAnchor(null)}
      />}

      {assignmentOpen && isStaff && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignmentOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="subscription-dialog-title" className="w-full max-w-xl border bg-background p-5 shadow-xl" onKeyDown={(event) => { if (event.key === "Escape") setAssignmentOpen(false); }}>
          <div className="mb-4 flex items-center justify-between"><h2 id="subscription-dialog-title" className="text-lg font-semibold">Abonnement toevoegen</h2><Button type="button" variant="ghost" size="icon" aria-label="Sluiten" title="Sluiten" onClick={() => setAssignmentOpen(false)}><X className="h-4 w-4" /></Button></div>
          <form onSubmit={(event) => void assignSubscription(event)} className="space-y-4">
            <div className="space-y-2">
              <label className="space-y-1 text-sm font-medium" htmlFor="subscription-radio-search">Radio zoeken
                <Input id="subscription-radio-search" type="search" role="searchbox" value={radioPickerQuery} onChange={(event) => { setRadioPickerQuery(event.target.value); setAssignmentForm((current) => ({ ...current, radio_id: "" })); }} placeholder="Zoek op TEI of model" />
              </label>
              <PagerScanControl subject="Radio" onScan={async (raw) => {
                try {
                  const result = await api.lookupRadioScan(raw);
                  setAssignmentForm((current) => ({ ...current, radio_id: String(result.radio.id) }));
                  setRadioPickerQuery(result.radio.tei);
                } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Radio scannen is niet gelukt."); }
              }} />
              <label className="sr-only" htmlFor="subscription-radio">Selecteer radio</label>
              <select id="subscription-radio" required className="flex h-10 w-full border bg-white px-3 text-sm" value={assignmentForm.radio_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, radio_id: event.target.value })}>
                <option value="">Kies een radio</option>{radioChoices.map((radio) => <option key={radio.id} value={radio.id}>{radio.tei} · {radio.model?.name ?? radio.model_name ?? "Model onbekend"}</option>)}
              </select>
              {!radioChoices.length && <p className="text-xs text-muted-foreground">Geen radio's gevonden.</p>}
            </div>
            <div className="space-y-2">
              <label className="space-y-1 text-sm font-medium" htmlFor="subscription-issi-search">ISSI zoeken
                <Input id="subscription-issi-search" type="search" role="searchbox" value={issiPickerQuery} onChange={(event) => { setIssiPickerQuery(event.target.value); setAssignmentForm((current) => ({ ...current, issi_id: "" })); }} placeholder="Zoek op ISSI-nummer of alias" />
              </label>
              <label className="sr-only" htmlFor="subscription-issi">Selecteer ISSI</label>
              <select id="subscription-issi" required className="flex h-10 w-full border bg-white px-3 text-sm" value={assignmentForm.issi_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, issi_id: event.target.value })}>
                <option value="">Kies een ISSI</option>{issiChoices.map((item) => <option key={item.id} value={item.id}>{item.issi} · {item.alias}</option>)}
              </select>
              {!issiChoices.length && <p className="text-xs text-muted-foreground">Geen ISSI's gevonden.</p>}
            </div>
            {assignmentError && <p role="alert" className="text-sm text-red-700">{assignmentError}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setAssignmentOpen(false)}>Annuleren</Button><Button type="submit">Koppelen</Button></div>
          </form>
        </section>
      </div>}

    </div>
  );
}

function HistoryPanel({ title, history, onClose }: { title: string; history: RadioSubscription[]; onClose: () => void }) {
  return <section className="border-t bg-muted/20 p-4" aria-label={`${title} details`}>
    <div className="flex items-center justify-between"><div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Abonnementshistoriek</p></div><Button type="button" variant="ghost" size="icon" aria-label="Details sluiten" title="Details sluiten" onClick={onClose}><X className="h-4 w-4" /></Button></div>
    {!history.length ? <p className="mt-3 text-sm text-muted-foreground">Geen abonnementshistoriek.</p> : <ol className="mt-3 space-y-2">{history.map((item) => <li key={item.id} className="border bg-white p-3 text-sm"><span className="font-medium">{item.issi.issi} · {item.issi.alias}</span><span className="ml-2 text-muted-foreground">{item.ended_at ? "Beëindigd" : "Actief"}</span><span className="mt-1 block text-xs text-muted-foreground">{formatDate(item.started_at)} – {formatDate(item.ended_at)}</span></li>)}</ol>}
  </section>;
}
