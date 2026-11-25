export type TaskStatus = "PENDING" | "STARTED" | "PROGRESS" | "RETRY" | "SUCCESS" | "FAILURE" | "REVOKED";

export interface TaskProgress {
  current: number;
  total: number;
  percent: number;
  description?: string;
}

export interface TaskSnapshot {
  task_id: string;
  task_name: string | null;
  status: TaskStatus;
  progress: TaskProgress | null;
  result: ExampleTaskResult | FireplanSyncResult | FireplanRadioSyncResult | FireplanInventorySyncResult | null;
  error: string | null;
  updated_at: string | null;
}

export interface ExampleTaskResult {
  message?: string;
  duration_seconds?: number;
}

export interface FireplanSyncError {
  fireplan_id: number | null;
  serial_number: string | null;
  name: string | null;
  message: string;
}

export interface FireplanRadioSyncError {
  fireplan_id: number | null;
  name: string | null;
  message: string;
}

export interface FireplanRadioSyncResult {
  message?: string;
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: FireplanRadioSyncError[];
}

export interface FireplanSyncResult {
  message?: string;
  added: number;
  updated: number;
  unchanged: number;
  errors: FireplanSyncError[];
}

export interface FireplanInventorySyncError {
  uuid: string;
  error: string;
}

export interface FireplanInventorySyncResult {
  message?: string;
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: FireplanInventorySyncError[];
}

export interface FireplanInventorySummary {
  uuid: string;
  vehicle_alpha_code: string;
  inventory_type_name: string;
  done_in_name: string;
  done_by_full_name: string;
  overseen_by_full_name: string;
  created_at: string | null;
  closed_at: string;
  updated_at: string | null;
  has_incident_reports: boolean | null;
  is_complete_after_completion: boolean | null;
  is_complete_before_completion: boolean | null;
  is_quantity_count_excluded: boolean | null;
  is_test_standard: boolean | null;
  remaining_missing_followed_count: number | null;
  sync_status: "not_synced" | "pending" | "running" | "synced" | "failed";
  last_successful_sync_at: string | null;
  last_error: string;
  vector_code: string | null;
  vector_name: string;
}

export interface FireplanInventoryDetail {
  uuid: string;
  vehicle_alpha_code: string;
  inventory_type_name: string;
  done_in_name: string;
  done_by_full_name: string;
  overseen_by_full_name: string;
  source_created_at: string | null;
  source_closed_at: string | null;
  source_updated_at: string | null;
  has_incident_reports: boolean | null;
  is_complete_after_completion: boolean | null;
  is_complete_before_completion: boolean | null;
  is_quantity_count_excluded: boolean | null;
  is_test_standard: boolean | null;
  remaining_missing_followed_count: number | null;
  vehicle: { alphacode: string; fireplan_id: number } | null;
  vector: { vector_code: string; name: string; abbreviation: string } | null;
  sync_status: "pending" | "running" | "synced" | "failed";
  last_attempted_at: string | null;
  last_successful_sync_at: string;
  last_error: string;
  radio_items: Array<Record<string, unknown>>;
  radio_observations: Array<{
    fireplan_item_id: string;
    item_type_id: number;
    serial_number: string;
    radio: { id: number; tei: string; issi_alias: string | null; is_active: boolean } | null;
  }>;
}

export interface FireplanInventoryPage {
  count: number;
  page: number;
  page_size: number;
  results: FireplanInventorySummary[];
}

export interface FireplanRadioInventory {
  uuid: string;
  source_closed_at: string | null;
  vehicle: { alphacode: string; fireplan_id: number } | null;
  vector: { vector_code: string; name: string; abbreviation: string } | null;
}

export interface FireplanRadioInventoryPage {
  count: number;
  page: number;
  page_size: number;
  results: FireplanRadioInventory[];
}

export interface SuivoDeviceSummary {
  external_id: string;
  imei: string;
  type: string;
}

export interface SuivoAsset {
  external_id: string;
  name: string;
  match_status: "matched" | "none" | "multiple";
  vehicle: { id: number; name: string } | null;
  matches: Array<{ id: number; name: string }>;
  devices: SuivoDeviceSummary[];
  last_seen_at: string | null;
  position_at: string | null;
  position: Record<string, unknown> | null;
  battery_level: string | number | null;
  battery_voltage: string | number | null;
}

export interface SuivoDevice {
  external_id: string;
  imei: string;
  device_type: string;
  unit: { external_id: string; name: string } | null;
  last_seen_at: string | null;
  position_at: string | null;
  position: Record<string, unknown> | null;
  battery_level: string | number | null;
  battery_voltage: string | number | null;
}

export interface SuivoList<T> {
  results: T[];
  last_succeeded_at: string | null;
  last_error: string;
  stale: boolean;
}

export interface StartedTask {
  task_id: string;
  status: "PENDING";
}

export interface ManagedObjectIdentity {
  id: number;
  kind: "pager" | "vehicle" | "vector";
}

export interface CityGISService {
  id: number;
  abbreviation: string;
}

export interface CityGISLocation {
  id: number;
  name: string;
  sort_name: string;
  kind: "post" | "building" | "room" | "other";
  parent_id: number | null;
  service_id: number | null;
}

export type LocationKind = CityGISLocation["kind"];

export interface LocationServiceOption extends CityGISService {
  location_id: number | null;
}

export interface LocationValues {
  name: string;
  sort_name: string;
  kind: LocationKind;
  parent_id: number | null;
  service_id: number | null;
}

export interface LocationOverview {
  location: CityGISLocation;
  service: CityGISService | null;
  status_window: { starts_at: string; ends_at: string };
  vectors: CityGISPostVector[];
}

export interface CityGISPostVector extends CityGISVector {
  pagers: Pager[];
  radios: RadioAsset[];
  status_periods: CityGISStatusPeriod[];
}

export interface CityGISVehicle {
  id: number;
  managed_object: ManagedObjectIdentity;
  fireplan_id: number;
  alphacode: string;
  plate: string;
  utilisation: string;
  chassis: string;
  fleet_status: string;
  is_current: boolean;
  last_seen_at: string | null;
}

export interface CityGISVectorStatus {
  code: string;
  description: string;
  abbreviation: string;
  color: string;
}

export interface CityGISVector {
  id: number;
  managed_object: ManagedObjectIdentity;
  vector_code: string;
  name: string;
  abbreviation: string;
  service_abbreviation: string;
  service: CityGISService | null;
  post: CityGISLocation | null;
  resource_type_code: string;
  resource_code: string;
  operational_status_code: string;
  status_description: string | null;
  status_abbreviation: string | null;
  status_updated_at: string | null;
  status_color: string | null;
  vehicle: CityGISVehicle | null;
  source_vehicle_name: string;
  is_current: boolean;
  last_seen_at: string | null;
}

export interface CityGISStatusPeriod {
  status_code: string | null;
  status_description: string | null;
  status_abbreviation: string | null;
  status_color: string | null;
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  is_unknown: boolean;
}

export interface CityGISSyncState {
  last_attempted_at: string | null;
  last_succeeded_at: string | null;
  last_error: string | null;
}

export interface CityGISSnapshot {
  vehicles: CityGISVehicle[];
  vectors: CityGISVector[];
  statuses: CityGISVectorStatus[];
  last_refreshed_at: string | null;
  sync_state: CityGISSyncState;
}

export interface CityGISVectorStatusHistoryItem {
  id: number;
  status_code: string;
  status_description: string | null;
  status_abbreviation: string | null;
  status_color: string | null;
  status_since: string | null;
  observed_at: string;
  ended_at: string | null;
  duration_seconds: number;
  is_current: boolean;
}

export interface UserSession {
  username: string;
  is_staff: boolean;
}

export interface FireplanCredentials {
  login: string;
  password_configured: boolean;
  session_configured: boolean;
  session_checked_at: string | null;
  updated_at: string | null;
}

export interface PagerType {
  id: number;
  name: string;
}

export interface Pager {
  id: number;
  managed_object: ManagedObjectIdentity;
  serial_number: string;
  type: PagerType;
  fireplan_id?: number | null;
  fireplan_qr_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RadioAsset {
  id: number;
  managed_object?: ManagedObjectIdentity;
  tei: string;
  manufacturer: string;
  model_name: string;
  model: { id: number; manufacturer: string; name: string } | null;
  model_id?: number | null;
  fireplan_id: number | null;
  fireplan_qr_url?: string | null;
  created_at: string;
  updated_at: string;
  current_subscription?: RadioSubscription | null;
  subscription_history?: RadioSubscription[];
}

export interface Organization {
  id: number;
  name: string;
}

export interface Manufacturer {
  id: number;
  name: string;
}

export interface IssiAsset {
  id: number;
  issi: string;
  alias: string;
  organization: Organization | null;
  organization_id?: number | null;
  current_subscription?: RadioSubscription | null;
  subscription_history?: RadioSubscription[];
}

export interface RadioModel {
  id: number;
  manufacturer: string;
  manufacturer_id: number;
  name: string;
}

export interface TeiRange {
  id: number;
  model: RadioModel;
  start_tei: string;
  end_tei: string;
}

export interface RadioSubscription {
  id: number;
  radio: { id: number; tei: string };
  issi: { id: number; issi: string; alias: string };
  started_at: string;
  ended_at: string | null;
}

export interface RadioSubscriptionImportResult {
  rows: number;
  subscriptions: number;
  created_radios: number;
  created_issis: number;
  ended_subscriptions: number;
  skipped: number;
  issues: string[];
}

export interface RadioRelationshipEntry {
  id: number;
  kind: "assigned_to" | "mounted_in" | "installed_in";
  target: ManagedObjectIdentity | null;
  location: Pick<CityGISLocation, "id" | "name" | "kind"> | null;
  started_at: string;
  ended_at: string | null;
}

export interface RadioRelationshipSnapshot {
  current: RadioRelationshipEntry | null;
  history: RadioRelationshipEntry[];
}

export interface RicCode {
  id: number;
  ric_code: string;
  adc_code: string;
  alias: string;
}

export interface InventoryPager extends Pager {
  assigned_vector_id: number | null;
}

export interface InventoryRicCode extends RicCode {
  vector_id: number | null;
}

export interface InventorySnapshot {
  locations: CityGISLocation[];
  vectors: CityGISVector[];
  pagers: InventoryPager[];
  ric_codes: InventoryRicCode[];
}

export interface PagerScanLookup {
  raw_scan: string;
  pager: Pager;
}

export interface LabelPrinter {
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

export interface LabelPrinterValues {
  name: string;
  manufacturer: string;
  model: string;
  ip_address: string;
  port: number;
  tape_width_mm: number;
}

export interface PrinterActionResult {
  status: "reachable" | "timeout" | "unreachable" | "sent";
  detail: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE = "/api";

function csrfCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((value) => value.startsWith("csrftoken="))
    ?.split("=")[1];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = csrfCookie();
  if (token && !["GET", "HEAD", "OPTIONS"].includes(options.method ?? "GET")) {
    headers.set("X-CSRFToken", decodeURIComponent(token));
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const body = (await response.json()) as { detail?: string; [key: string]: unknown };
      message = body.detail ?? Object.values(body).flat().join(" ") ?? message;
    } catch {
      // Keep the HTTP status text when a response isn't JSON.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  async csrf(): Promise<void> {
    await request<{ csrfToken: string }>("/auth/csrf/");
  },
  me: () => request<UserSession>("/auth/me/"),
  async login(username: string, password: string): Promise<UserSession> {
    await api.csrf();
    return request<UserSession>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  logout: () => request<{ ok: boolean }>("/auth/logout/", { method: "POST" }),
  listTasks: () => request<TaskSnapshot[]>("/tasks/"),
  getCityGIS: () => request<CityGISSnapshot>("/citygis/"),
  getSuivoAssets: () => request<SuivoList<SuivoAsset>>("/suivo/assets/"),
  getSuivoDevices: () => request<SuivoList<SuivoDevice>>("/suivo/devices/"),
  getCityGISVectorStatusHistory: (vectorId: number) =>
    request<CityGISVectorStatusHistoryItem[]>(`/citygis/vectors/${vectorId}/status-history/`),
  startCityGISRefresh: () => request<StartedTask>("/citygis/refresh/", { method: "POST" }),
  cityGISEventsUrl: () => `${API_BASE}/citygis/events/`,
  startTask: (duration_seconds: number) =>
    request<StartedTask>("/tasks/", { method: "POST", body: JSON.stringify({ duration_seconds }) }),
  startFireplanSync: () =>
    request<StartedTask>("/fireplan/sync-pagers/", { method: "POST" }),
  startFireplanRadioSync: () =>
    request<StartedTask>("/fireplan/sync-radios/", { method: "POST" }),
  lookupRadioScan: (scanned_line: string) =>
    request<{ raw_scan: string; radio: RadioAsset }>("/radios/scanlookup/", {
      method: "POST",
      body: JSON.stringify({ scanned_line }),
    }),
  listRadios: (search = "") =>
    request<RadioAsset[]>(`/radios/${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getRadio: (id: number) => request<RadioAsset>(`/radios/${id}/`),
  getRadioFireplanInventories: (id: number, page = 1, pageSize = 10) =>
    request<FireplanRadioInventoryPage>(
      `/radios/${id}/fireplan-inventories/?page=${page}&page_size=${pageSize}`,
    ),
  getRadioRelationship: (id: number) =>
    request<RadioRelationshipSnapshot>(`/inventory/radios/${id}/relationship/`),
  updateRadioRelationship: (id: number, values: {
    kind: RadioRelationshipEntry["kind"];
    target_object_id: number | null;
    location_id: number | null;
  }) => request<RadioRelationshipSnapshot>(`/inventory/radios/${id}/relationship/`, {
    method: "PUT", body: JSON.stringify(values),
  }),
  createRadio: (values: {
    tei: string;
    manufacturer: string;
    model_name: string;
    model_id?: number | null;
  }) => request<RadioAsset>("/radios/", { method: "POST", body: JSON.stringify(values) }),
  updateRadio: (id: number, values: Partial<RadioAsset>) =>
    request<RadioAsset>(`/radios/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteRadio: (id: number) => request<void>(`/radios/${id}/`, { method: "DELETE" }),
  listIssis: (search = "") =>
    request<IssiAsset[]>(`/issis/${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createIssi: (values: { issi: string; alias: string; organization_id?: number | null }) =>
    request<IssiAsset>("/issis/", { method: "POST", body: JSON.stringify(values) }),
  updateIssi: (id: number, values: Partial<IssiAsset>) =>
    request<IssiAsset>(`/issis/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteIssi: (id: number) => request<void>(`/issis/${id}/`, { method: "DELETE" }),
  listOrganizations: () => request<Organization[]>("/organizations/"),
  createOrganization: (values: { name: string }) =>
    request<Organization>("/organizations/", { method: "POST", body: JSON.stringify(values) }),
  updateOrganization: (id: number, values: { name: string }) =>
    request<Organization>(`/organizations/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteOrganization: (id: number) => request<void>(`/organizations/${id}/`, { method: "DELETE" }),
  listManufacturers: () => request<Manufacturer[]>("/manufacturers/"),
  createManufacturer: (values: { name: string }) =>
    request<Manufacturer>("/manufacturers/", { method: "POST", body: JSON.stringify(values) }),
  updateManufacturer: (id: number, values: { name: string }) =>
    request<Manufacturer>(`/manufacturers/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  listRadioModels: () => request<RadioModel[]>("/radio-models/"),
  createRadioModel: (values: { manufacturer_id: number; name: string }) =>
    request<RadioModel>("/radio-models/", { method: "POST", body: JSON.stringify(values) }),
  updateRadioModel: (id: number, values: { manufacturer_id: number; name: string }) =>
    request<RadioModel>(`/radio-models/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteRadioModel: (id: number) => request<void>(`/radio-models/${id}/`, { method: "DELETE" }),
  listTeiRanges: () => request<TeiRange[]>("/tei-ranges/"),
  createTeiRange: (values: { model_id: number; start_tei: string; end_tei: string }) =>
    request<TeiRange>("/tei-ranges/", { method: "POST", body: JSON.stringify(values) }),
  updateTeiRange: (id: number, values: { model_id: number; start_tei: string; end_tei: string }) =>
    request<TeiRange>(`/tei-ranges/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteTeiRange: (id: number) => request<void>(`/tei-ranges/${id}/`, { method: "DELETE" }),
  listRadioSubscriptions: () => request<RadioSubscription[]>("/radio-subscriptions/"),
  assignRadioSubscription: (radio_id: number, issi_id: number) =>
    request<RadioSubscription>("/radio-subscriptions/", {
      method: "POST",
      body: JSON.stringify({ radio_id, issi_id }),
    }),
  importRadioSubscriptions: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<RadioSubscriptionImportResult>("/radio-subscriptions/import/", {
      method: "POST",
      body,
    });
  },
  getFireplanInventories: (page = 1, pageSize = 25) =>
    request<FireplanInventoryPage>(
      `/fireplan/inventories/?page=${page}&page_size=${pageSize}`,
    ),
  getFireplanInventoryDetail: (uuid: string) =>
    request<FireplanInventoryDetail>(`/fireplan/inventories/${encodeURIComponent(uuid)}/`),
  startFireplanInventorySync: (startDate: string, endDate: string) =>
    request<StartedTask>("/fireplan/sync-inventories/", {
      method: "POST",
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
    }),
  startFireplanInventoryResync: (uuid: string) =>
    request<StartedTask>(`/fireplan/inventories/${encodeURIComponent(uuid)}/sync/`, {
      method: "POST",
    }),
  getTask: (id: string) => request<TaskSnapshot>(`/tasks/${encodeURIComponent(id)}/`),
  taskEventsUrl: (id: string) => `${API_BASE}/tasks/${encodeURIComponent(id)}/events/`,
  listPagers: () => request<Pager[]>("/pagers/"),
  listPagerTypes: () => request<PagerType[]>("/pager-types/"),
  createPager: (values: { serial_number: string; type_id: number }) =>
    request<Pager>("/pagers/", { method: "POST", body: JSON.stringify(values) }),
  updatePager: (id: number, values: { serial_number: string; type_id: number }) =>
    request<Pager>(`/pagers/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deletePager: (id: number) => request<void>(`/pagers/${id}/`, { method: "DELETE" }),
  listRicCodes: () => request<RicCode[]>("/ric-codes/"),
  getInventory: () => request<InventorySnapshot>("/inventory/"),
  scanPager: (scannedLine: string) =>
    request<PagerScanLookup>("/pagers/scanlookup/", {
      method: "POST",
      body: JSON.stringify({ scanned_line: scannedLine }),
    }),
  listLocations: () => request<CityGISLocation[]>("/locations/"),
  listLocationServices: () => request<LocationServiceOption[]>("/locations/services/"),
  createLocation: (values: LocationValues) =>
    request<CityGISLocation>("/locations/", { method: "POST", body: JSON.stringify(values) }),
  updateLocation: (id: number, values: LocationValues) =>
    request<CityGISLocation>(`/locations/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteLocation: (id: number) => request<void>(`/locations/${id}/`, { method: "DELETE" }),
  getLocationOverview: (id: number) =>
    request<LocationOverview>(`/locations/${id}/overview/`),
  updatePagerVector: (pagerId: number, vectorId: number | null) =>
    request<{ vector_id: number | null }>(`/inventory/pagers/${pagerId}/vector/`, {
      method: "PUT",
      body: JSON.stringify({ vector_id: vectorId }),
    }),
  updateRicCodeVector: (codeId: number, vectorId: number | null) =>
    request<{ vector_id: number | null }>(`/inventory/ric-codes/${codeId}/vector/`, {
      method: "PUT",
      body: JSON.stringify({ vector_id: vectorId }),
    }),
  createRicCode: (values: Omit<RicCode, "id">) =>
    request<RicCode>("/ric-codes/", { method: "POST", body: JSON.stringify(values) }),
  updateRicCode: (id: number, values: Omit<RicCode, "id">) =>
    request<RicCode>(`/ric-codes/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteRicCode: (id: number) => request<void>(`/ric-codes/${id}/`, { method: "DELETE" }),
  listPrinters: () => request<LabelPrinter[]>("/printers/"),
  createPrinter: (values: LabelPrinterValues) =>
    request<LabelPrinter>("/printers/", { method: "POST", body: JSON.stringify(values) }),
  updatePrinter: (id: number, values: LabelPrinterValues) =>
    request<LabelPrinter>(`/printers/${id}/`, { method: "PATCH", body: JSON.stringify(values) }),
  deletePrinter: (id: number) => request<void>(`/printers/${id}/`, { method: "DELETE" }),
  checkPrinterConnection: (id: number) =>
    request<PrinterActionResult>(`/printers/${id}/check-connection/`, { method: "POST" }),
  printTestLabel: (id: number) =>
    request<PrinterActionResult>(`/printers/${id}/print-test-label/`, { method: "POST" }),
  getFireplanCredentials: () => request<FireplanCredentials>("/fireplan/credentials/"),
  saveFireplanCredentials: (values: { login: string; password?: string }) =>
    request<FireplanCredentials>("/fireplan/credentials/", {
      method: "PUT",
      body: JSON.stringify(values),
    }),
  testFireplanLogin: () =>
    request<{
      ok: boolean;
      detail: string;
      session_reused: boolean;
      session_configured: boolean;
      session_checked_at: string;
    }>("/fireplan/test-login/", { method: "POST" }),
};

export function subscribeToTask(
  id: string,
  onUpdate: (snapshot: TaskSnapshot) => void,
  onError?: () => void,
): () => void {
  const source = new EventSource(api.taskEventsUrl(id), { withCredentials: true });
  source.addEventListener("task", (event) => {
    try {
      onUpdate(JSON.parse((event as MessageEvent<string>).data) as TaskSnapshot);
    } catch {
      onError?.();
    }
  });
  source.onerror = () => onError?.();
  return () => source.close();
}

export function subscribeToCityGIS(
  onUpdate: (snapshot: CityGISSnapshot) => void,
  onError?: () => void,
): () => void {
  const source = new EventSource(api.cityGISEventsUrl(), { withCredentials: true });
  source.addEventListener("citygis", (event) => {
    try {
      onUpdate(JSON.parse((event as MessageEvent<string>).data) as CityGISSnapshot);
    } catch {
      onError?.();
    }
  });
  source.onerror = () => onError?.();
  return () => source.close();
}
