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
  result: ExampleTaskResult | FireplanSyncResult | FireplanInventorySyncResult | null;
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
}

export interface FireplanInventoryPage {
  count: number;
  page: number;
  page_size: number;
  results: FireplanInventorySummary[];
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
  vectors: CityGISVector[];
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
  created_at: string;
  updated_at: string;
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
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
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
  getCityGISVectorStatusHistory: (vectorId: number) =>
    request<CityGISVectorStatusHistoryItem[]>(`/citygis/vectors/${vectorId}/status-history/`),
  startCityGISRefresh: () => request<StartedTask>("/citygis/refresh/", { method: "POST" }),
  cityGISEventsUrl: () => `${API_BASE}/citygis/events/`,
  startTask: (duration_seconds: number) =>
    request<StartedTask>("/tasks/", { method: "POST", body: JSON.stringify({ duration_seconds }) }),
  startFireplanSync: () =>
    request<StartedTask>("/fireplan/sync-pagers/", { method: "POST" }),
  getFireplanInventories: (page = 1, pageSize = 25) =>
    request<FireplanInventoryPage>(
      `/fireplan/inventories/?page=${page}&page_size=${pageSize}`,
    ),
  startFireplanInventorySync: (startDate: string, endDate: string) =>
    request<StartedTask>("/fireplan/sync-inventories/", {
      method: "POST",
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
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
