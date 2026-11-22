import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, Pencil, Plus, RotateCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ModalDialog } from "@/components/ModalDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Manufacturer, type Organization, type RadioModel, type TeiRange } from "@/lib/api";

type Tab = "organizations" | "models";
type SortDirection = "ascending" | "descending";
type SortColumn = { organizations: "name"; models: "manufacturer" | "name" };
type RangeSortColumn = "start_tei" | "end_tei";
type SortState = { column: string; direction: SortDirection };
type OrganizationForm = { id: number; name: string };
type ModelForm = { id: number; manufacturer_id: string; name: string };
type RangeForm = { id: number; start_tei: string; end_tei: string };

const emptyOrganization: OrganizationForm = { id: 0, name: "" };
const emptyModel: ModelForm = { id: 0, manufacturer_id: "", name: "" };
const emptyRange: RangeForm = { id: 0, start_tei: "", end_tei: "" };
const emptyManufacturer = { id: 0, name: "" };
const tabLabels: Record<Tab, string> = { organizations: "Organisaties", models: "Radiomodellen" };

function compare(left: string, right: string) {
  return left.localeCompare(right, "nl-BE", { numeric: true, sensitivity: "base" });
}

function SortHeader({ label, column, state, onSort }: { label: string; column: string; state: SortState; onSort: (column: string) => void }) {
  const active = state.column === column;
  const Icon = !active ? ArrowDownUp : state.direction === "ascending" ? ArrowUp : ArrowDown;
  return <th scope="col" aria-sort={active ? state.direction : undefined} className="px-4 py-3 align-middle font-normal">
    <button type="button" className="inline-flex items-center gap-2 whitespace-nowrap font-medium" aria-label={`Sorteer op ${label.toLocaleLowerCase("nl-BE")}`} onClick={() => onSort(column)}>
      {label}<Icon aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  </th>;
}

function SearchField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
    <span className="sr-only">{label}</span>
    <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input type="search" role="searchbox" className="pl-9" value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} />
  </label>;
}

export function RadioAdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [models, setModels] = useState<RadioModel[]>([]);
  const [ranges, setRanges] = useState<TeiRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [manufacturerFormOpen, setManufacturerFormOpen] = useState(false);
  const [rangeFormOpen, setRangeFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("organizations");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Record<Tab, SortState>>({
    organizations: { column: "name", direction: "ascending" },
    models: { column: "manufacturer", direction: "ascending" },
  });
  const [rangeSort, setRangeSort] = useState<{ column: RangeSortColumn; direction: SortDirection }>({
    column: "start_tei", direction: "ascending",
  });
  const [organizationForm, setOrganizationForm] = useState(emptyOrganization);
  const [modelForm, setModelForm] = useState(emptyModel);
  const [rangeForm, setRangeForm] = useState(emptyRange);
  const [manufacturerForm, setManufacturerForm] = useState(emptyManufacturer);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [organizationRows, modelRows, rangeRows, manufacturerRows] = await Promise.all([
        api.listOrganizations(), api.listRadioModels(), api.listTeiRanges(), api.listManufacturers(),
      ]);
      setOrganizations(organizationRows);
      setModels(modelRows);
      setRanges(rangeRows);
      setManufacturers(manufacturerRows);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Radiobeheer laden is niet gelukt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function toggleSort(tab: Tab, column: string) {
    setSort((current) => ({
      ...current,
      [tab]: { column, direction: current[tab].column === column && current[tab].direction === "ascending" ? "descending" : "ascending" },
    }));
  }

  function toggleRangeSort(column: RangeSortColumn) {
    setRangeSort((current) => ({
      column,
      direction: current.column === column && current.direction === "ascending" ? "descending" : "ascending",
    }));
  }

  function changeTab(tab: Tab) {
    setActiveTab(tab);
    setQuery("");
    setFormError("");
    setFormOpen(false);
    setManufacturerFormOpen(false);
    setRangeFormOpen(false);
    setOrganizationForm(emptyOrganization);
    setModelForm(emptyModel);
    setRangeForm(emptyRange);
  }

  function openCreateForm() {
    setFormError("");
    if (activeTab === "organizations") setOrganizationForm(emptyOrganization);
    if (activeTab === "models") setModelForm(emptyModel);
    setFormOpen(true);
  }

  const closeForm = useCallback(() => {
    if (saving) return;
    setFormOpen(false);
    setFormError("");
    setOrganizationForm(emptyOrganization);
    setModelForm(emptyModel);
    setRangeForm(emptyRange);
    setRangeFormOpen(false);
  }, [saving]);

  const closeManufacturerForm = useCallback(() => {
    if (saving) return;
    setManufacturerFormOpen(false);
    setManufacturerForm(emptyManufacturer);
  }, [saving]);

  const closeRangeForm = useCallback(() => {
    if (saving) return;
    setRangeFormOpen(false);
    setRangeForm(emptyRange);
    setFormError("");
  }, [saving]);

  async function saveManufacturer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const values = { name: manufacturerForm.name.trim() };
      const saved = manufacturerForm.id
        ? await api.updateManufacturer(manufacturerForm.id, values)
        : await api.createManufacturer(values);
      setModelForm((current) => ({ ...current, manufacturer_id: String(saved.id) }));
      setManufacturerFormOpen(false);
      setManufacturerForm(emptyManufacturer);
      toast.success(manufacturerForm.id ? "Fabrikant bijgewerkt." : "Fabrikant toegevoegd.");
      await refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Fabrikant opslaan is niet gelukt.");
    } finally { setSaving(false); }
  }

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const values = { name: organizationForm.name.trim() };
      if (organizationForm.id) await api.updateOrganization(organizationForm.id, values);
      else await api.createOrganization(values);
      setFormOpen(false);
      setOrganizationForm(emptyOrganization);
      toast.success(organizationForm.id ? "Organisatie bijgewerkt." : "Organisatie toegevoegd.");
      await refresh();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Organisatie opslaan is niet gelukt."); }
    finally { setSaving(false); }
  }

  async function saveModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const values = { manufacturer_id: Number(modelForm.manufacturer_id), name: modelForm.name.trim() };
      const saved = modelForm.id
        ? await api.updateRadioModel(modelForm.id, values)
        : await api.createRadioModel(values);
      setModelForm({ id: saved.id, manufacturer_id: String(saved.manufacturer_id), name: saved.name });
      toast.success(modelForm.id ? "Radiomodel bijgewerkt." : "Radiomodel toegevoegd.");
      await refresh();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Radiomodel opslaan is niet gelukt."); }
    finally { setSaving(false); }
  }

  async function saveRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const values = { model_id: modelForm.id, start_tei: rangeForm.start_tei.trim(), end_tei: rangeForm.end_tei.trim() };
      if (rangeForm.id) await api.updateTeiRange(rangeForm.id, values);
      else await api.createTeiRange(values);
      setRangeFormOpen(false);
      setRangeForm(emptyRange);
      toast.success(rangeForm.id ? "TEI-bereik bijgewerkt." : "TEI-bereik toegevoegd.");
      await refresh();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "TEI-bereik opslaan is niet gelukt."); }
    finally { setSaving(false); }
  }

  async function remove(kind: "organization" | "model" | "range", id: number, description: string) {
    if (!window.confirm(`${description} verwijderen?`)) return;
    setFormError("");
    try {
      if (kind === "organization") await api.deleteOrganization(id);
      if (kind === "model") await api.deleteRadioModel(id);
      if (kind === "range") await api.deleteTeiRange(id);
      toast.success(`${description} verwijderd.`); await refresh();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : `${description} verwijderen is niet gelukt.`); }
  }

  function actions(label: string, onEdit: () => void, onDelete: () => void) {
    return <td className="px-4 py-3 text-right"><div className="inline-flex gap-1">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Bewerk ${label}`} title={`Bewerk ${label}`} onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Verwijder ${label}`} title={`Verwijder ${label}`} onClick={onDelete}><Trash2 className="h-4 w-4 text-red-700" /></Button>
    </div></td>;
  }

  const needle = query.trim().toLocaleLowerCase("nl-BE");
  const orderedOrganizations = useMemo(() => {
    const rows = organizations.filter((item) => !needle || item.name.toLocaleLowerCase("nl-BE").includes(needle));
    const direction = sort.organizations.direction === "ascending" ? 1 : -1;
    return rows.sort((a, b) => compare(a.name, b.name) * direction || a.id - b.id);
  }, [needle, organizations, sort.organizations]);
  const orderedModels = useMemo(() => {
    const rows = models.filter((item) => !needle || `${item.manufacturer} ${item.name}`.toLocaleLowerCase("nl-BE").includes(needle));
    const direction = sort.models.direction === "ascending" ? 1 : -1;
    return rows.sort((a, b) => compare(a[sort.models.column as SortColumn["models"]], b[sort.models.column as SortColumn["models"]]) * direction || a.id - b.id);
  }, [models, needle, sort.models]);
  const modelRanges = useMemo(() => ranges
    .filter((item) => item.model.id === modelForm.id)
    .sort((left, right) => {
      const direction = rangeSort.direction === "ascending" ? 1 : -1;
      return compare(left[rangeSort.column], right[rangeSort.column]) * direction || left.id - right.id;
    }), [modelForm.id, rangeSort, ranges]);

  const formTitle = activeTab === "organizations"
    ? organizationForm.id ? "Organisatie bewerken" : "Organisatie toevoegen"
    : modelForm.id ? "Radiomodel bewerken" : "Radiomodel toevoegen";

  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-primary">Beheer</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Radiobeheer</h1><p className="mt-2 text-sm text-muted-foreground">Beheer organisaties en radiomodellen.</p></div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => void refresh()} disabled={loading} aria-label="Radiobeheer vernieuwen" title="Lijst vernieuwen"><RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
        <Button type="button" size="icon" className="h-9 w-9" onClick={openCreateForm} aria-label={`${tabLabels[activeTab]} toevoegen`} title={`${tabLabels[activeTab]} toevoegen`}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
    <div role="tablist" aria-label="Radiobeheer" className="flex flex-wrap border-b">
      {(Object.keys(tabLabels) as Tab[]).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={`border-b-2 px-4 py-3 text-sm ${activeTab === tab ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`} onClick={() => changeTab(tab)}>{tabLabels[tab]}</button>)}
    </div>
    <Card>
      <CardHeader className="flex-col items-stretch gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div><CardTitle>{tabLabels[activeTab]}</CardTitle><CardDescription>{activeTab === "organizations" ? `${organizations.length} organisaties` : `${models.length} radiomodellen`}</CardDescription></div>
        <SearchField value={query} onChange={setQuery} label={`Zoek ${tabLabels[activeTab].toLocaleLowerCase("nl-BE")}`} />
      </CardHeader>
      <CardContent className="p-0">
        {formError && <p role="alert" className="m-4 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
        {loadError ? <div role="alert" className="m-4 border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">{loadError}<Button className="ml-3" variant="outline" size="sm" onClick={() => void refresh()}>Opnieuw proberen</Button></div> : loading ? <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><RotateCw className="h-4 w-4 animate-spin" />Radiobeheer laden…</div> : <div className="overflow-x-auto">
          {activeTab === "organizations" && <table className="w-full min-w-[560px] table-fixed border-collapse text-left text-sm"><colgroup><col className="w-[78%]" /><col className="w-[22%]" /></colgroup><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr><SortHeader label="Organisatienaam" column="name" state={sort.organizations} onSort={(column) => toggleSort("organizations", column)} /><th className="px-4 py-3 text-right font-medium" scope="col">Acties</th></tr></thead><tbody className="divide-y">{orderedOrganizations.map((item) => <tr key={item.id} className="hover:bg-muted/30"><td className="px-4 py-3 font-medium">{item.name}</td>{actions(`organisatie ${item.name}`, () => { setOrganizationForm({ id: item.id, name: item.name }); setFormOpen(true); }, () => void remove("organization", item.id, `Organisatie ${item.name}`))}</tr>)}{!orderedOrganizations.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">Geen organisaties gevonden.</td></tr>}</tbody></table>}
          {activeTab === "models" && <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm"><colgroup><col className="w-[36%]" /><col className="w-[42%]" /><col className="w-[22%]" /></colgroup><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr><SortHeader label="Fabrikant" column="manufacturer" state={sort.models} onSort={(column) => toggleSort("models", column)} /><SortHeader label="Modelnaam" column="name" state={sort.models} onSort={(column) => toggleSort("models", column)} /><th className="px-4 py-3 text-right font-medium" scope="col">Acties</th></tr></thead><tbody className="divide-y">{orderedModels.map((item) => <tr key={item.id} className="hover:bg-muted/30"><td className="px-4 py-3">{item.manufacturer}</td><td className="px-4 py-3 font-medium">{item.name}</td>{actions(`model ${item.name}`, () => { setModelForm({ id: item.id, manufacturer_id: String(item.manufacturer_id), name: item.name }); setFormOpen(true); }, () => void remove("model", item.id, `Radiomodel ${item.name}`))}</tr>)}{!orderedModels.length && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Geen radiomodellen gevonden.</td></tr>}</tbody></table>}
        </div>}
      </CardContent>
    </Card>
    {formOpen && !manufacturerFormOpen && !rangeFormOpen && <ModalDialog title={formTitle} onClose={closeForm}>
      {activeTab === "organizations" && <form onSubmit={(event) => void saveOrganization(event)} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="radio-admin-organization">Organisatienaam<Input id="radio-admin-organization" autoFocus required maxLength={160} value={organizationForm.name} onChange={(event) => setOrganizationForm({ ...organizationForm, name: event.target.value })} placeholder="Bijvoorbeeld Brandweer Brussel" /></label>
        {formError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{formError}</p>}
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button><Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Annuleren</Button></div>
      </form>}
      {activeTab === "models" && <form onSubmit={(event) => void saveModel(event)} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 text-sm font-medium sm:col-span-2">
          <label htmlFor="radio-admin-model-manufacturer">Fabrikant</label>
          <div className="flex gap-2">
            <select id="radio-admin-model-manufacturer" autoFocus required className="flex h-10 min-w-0 flex-1 border border-input bg-background px-3 text-sm" value={modelForm.manufacturer_id} onChange={(event) => setModelForm({ ...modelForm, manufacturer_id: event.target.value })}>
              <option value="">Kies een fabrikant</option>
              {manufacturers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <Button type="button" variant="outline" size="icon" aria-label="Fabrikant toevoegen" title="Fabrikant toevoegen" onClick={() => { setManufacturerForm(emptyManufacturer); setManufacturerFormOpen(true); }}><Plus className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="icon" aria-label="Geselecteerde fabrikant bewerken" title="Geselecteerde fabrikant bewerken" disabled={!manufacturers.some((item) => String(item.id) === modelForm.manufacturer_id)} onClick={() => {
              const selected = manufacturers.find((item) => String(item.id) === modelForm.manufacturer_id);
              if (selected) { setManufacturerForm(selected); setManufacturerFormOpen(true); }
            }}><Pencil className="h-4 w-4" /></Button>
          </div>
        </div>
        <label className="space-y-2 text-sm font-medium" htmlFor="radio-admin-model-name">Modelnaam<Input id="radio-admin-model-name" required maxLength={120} value={modelForm.name} onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })} placeholder="Modelnaam" /></label>
        {formError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{formError}</p>}
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button><Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Annuleren</Button></div>
      </form>}
      {activeTab === "models" && modelForm.id > 0 && <section className="mt-5 border-t pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">TEI-bereiken</h2><p className="text-sm text-muted-foreground">{modelRanges.length} bereiken</p></div>
          <Button type="button" size="icon" className="h-9 w-9" aria-label="TEI-bereik toevoegen" title="TEI-bereik toevoegen" onClick={() => { setFormError(""); setRangeForm(emptyRange); setRangeFormOpen(true); }}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] table-fixed border-collapse text-left text-sm">
            <colgroup><col className="w-[40%]" /><col className="w-[40%]" /><col className="w-[20%]" /></colgroup>
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
              <SortHeader label="Eerste TEI" column="start_tei" state={rangeSort} onSort={(column) => toggleRangeSort(column as RangeSortColumn)} />
              <SortHeader label="Laatste TEI" column="end_tei" state={rangeSort} onSort={(column) => toggleRangeSort(column as RangeSortColumn)} />
              <th className="px-4 py-3 text-right font-medium" scope="col">Acties</th>
            </tr></thead>
            <tbody className="divide-y">
              {modelRanges.map((item) => <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono">{item.start_tei}</td><td className="px-4 py-3 font-mono">{item.end_tei}</td>
                {actions(`TEI-bereik ${item.start_tei}`, () => { setRangeForm({ id: item.id, start_tei: item.start_tei, end_tei: item.end_tei }); setFormError(""); setRangeFormOpen(true); }, () => void remove("range", item.id, `TEI-bereik ${item.start_tei}`))}
              </tr>)}
              {!modelRanges.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Nog geen TEI-bereiken voor dit model.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
    </ModalDialog>}
    {manufacturerFormOpen && <ModalDialog title={manufacturerForm.id ? "Fabrikant bewerken" : "Fabrikant toevoegen"} onClose={closeManufacturerForm}>
      <form onSubmit={(event) => void saveManufacturer(event)} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="radio-admin-manufacturer-name">Naam<Input id="radio-admin-manufacturer-name" autoFocus required maxLength={100} value={manufacturerForm.name} onChange={(event) => setManufacturerForm({ ...manufacturerForm, name: event.target.value })} /></label>
        {formError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{formError}</p>}
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button><Button type="button" variant="outline" onClick={closeManufacturerForm} disabled={saving}>Annuleren</Button></div>
      </form>
    </ModalDialog>}
    {rangeFormOpen && <ModalDialog title={rangeForm.id ? "TEI-bereik bewerken" : "TEI-bereik toevoegen"} onClose={closeRangeForm}>
      <form onSubmit={(event) => void saveRange(event)} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium" htmlFor="radio-admin-range-start">Eerste TEI<Input id="radio-admin-range-start" autoFocus required maxLength={15} pattern="[0-9]{14,15}" value={rangeForm.start_tei} onChange={(event) => setRangeForm({ ...rangeForm, start_tei: event.target.value })} /></label>
        <label className="space-y-2 text-sm font-medium" htmlFor="radio-admin-range-end">Laatste TEI<Input id="radio-admin-range-end" required maxLength={15} pattern="[0-9]{14,15}" value={rangeForm.end_tei} onChange={(event) => setRangeForm({ ...rangeForm, end_tei: event.target.value })} /></label>
        <p className="text-xs text-muted-foreground sm:col-span-2">14 cijfers worden aangevuld met een 0 achteraan; 15 cijfers blijven ongewijzigd. Andere lengtes worden geweigerd.</p>
        {formError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{formError}</p>}
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button><Button type="button" variant="outline" onClick={closeRangeForm} disabled={saving}>Annuleren</Button></div>
      </form>
    </ModalDialog>}
  </div>;
}
