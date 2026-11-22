import { afterEach, describe, expect, it, vi } from "vitest";
import { api, subscribeToTask, type TaskSnapshot } from "@/lib/api";

class MockEventSource extends EventTarget {
  static latest: MockEventSource;
  readyState = 0;
  closed = false;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  withCredentials: boolean;
  constructor(public url: string, init?: EventSourceInit) {
    super();
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.latest = this;
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
}

describe("task SSE client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens an authenticated stream and parses task snapshots", () => {
    vi.stubGlobal("EventSource", MockEventSource);
    const onUpdate = vi.fn();
    const stop = subscribeToTask("task/123", onUpdate);
    expect(MockEventSource.latest.url).toBe("/api/tasks/task%2F123/events/");
    expect(MockEventSource.latest.withCredentials).toBe(true);

    const snapshot: TaskSnapshot = { task_id: "task-123", task_name: "tasks.example_task", status: "PROGRESS", progress: null, result: null, error: null, updated_at: null };
    MockEventSource.latest.dispatchEvent(new MessageEvent("task", { data: JSON.stringify(snapshot) }));
    expect(onUpdate).toHaveBeenCalledWith(snapshot);
    stop();
    expect(MockEventSource.latest.closed).toBe(true);
  });

  it("leaves recoverable disconnects to EventSource automatic reconnection", () => {
    vi.stubGlobal("EventSource", MockEventSource);
    const onError = vi.fn();
    const stop = subscribeToTask("task-123", vi.fn(), onError);
    MockEventSource.latest.readyState = 0;
    MockEventSource.latest.onerror?.call(MockEventSource.latest as unknown as EventSource, new Event("error"));
    expect(onError).toHaveBeenCalledOnce();
    expect(MockEventSource.latest.closed).toBe(false);
    stop();
  });
});

describe("Fireplan sync API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("queues a sync through the staff endpoint with session credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ task_id: "fireplan-task-42", status: "PENDING" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.startFireplanSync()).resolves.toEqual({
      task_id: "fireplan-task-42",
      status: "PENDING",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/fireplan/sync-pagers/", expect.objectContaining({
      method: "POST",
      credentials: "include",
    }));
  });

  it("queues a radio sync through the staff endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ task_id: "fireplan-radio-task-42", status: "PENDING" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.startFireplanRadioSync()).resolves.toEqual({
      task_id: "fireplan-radio-task-42",
      status: "PENDING",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/fireplan/sync-radios/", expect.objectContaining({
      method: "POST",
      credentials: "include",
    }));
  });

  it("looks up a radio QR scan through the authenticated endpoint", async () => {
    const result = {
      raw_scan: "https://infoscan.firebru.brussels?data=1,1,4321,1010",
      radio: {
        id: 7,
        tei: "00000000000001",
        manufacturer: "",
        model_name: "",
        model: null,
        fireplan_id: 4321,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => result });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.lookupRadioScan(result.raw_scan)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("/api/radios/scanlookup/", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ scanned_line: result.raw_scan }),
      credentials: "include",
    }));
  });
});

describe("radio management API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists radios with a search query and creates a radio with a typed body", async () => {
    const radio = {
      id: 7,
      tei: "00000000000001",
      manufacturer: "",
      model_name: "",
      model: null,
      fireplan_id: 4321,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [radio] })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => radio });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.listRadios("4321")).resolves.toEqual([radio]);
    await expect(api.createRadio({
      tei: "00000000000001",
      manufacturer: "",
      model_name: "",
    })).resolves.toEqual(radio);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/radios/?search=4321");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/radios/");
  });

  it("loads ISSI and subscription views through the existing authenticated API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.listIssis("radio")).resolves.toEqual([]);
    await expect(api.listRadioSubscriptions()).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/issis/?search=radio");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/radio-subscriptions/");
  });

  it("updates configurable organizations, radio models and TEI ranges", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 3 }) });
    vi.stubGlobal("fetch", fetchMock);

    await api.updateOrganization(3, { name: "Updated organization" });
    await api.updateRadioModel(4, { manufacturer_id: 7, name: "Updated" });
    await api.updateTeiRange(5, { model_id: 4, start_tei: "00000000000100", end_tei: "00000000000199" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/organizations/3/",
      "/api/radio-models/4/",
      "/api/tei-ranges/5/",
    ]);
  });

  it("reads and updates radio relationship history through the existing inventory API", async () => {
    const snapshot = { current: null, history: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => snapshot })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => snapshot });
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.getRadioRelationship(7)).resolves.toEqual(snapshot);
    await expect(api.updateRadioRelationship(7, {
      kind: "assigned_to", target_object_id: 60, location_id: null,
    })).resolves.toEqual(snapshot);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/inventory/radios/7/relationship/");
    expect(fetchMock.mock.calls[1]).toMatchObject([
      "/api/inventory/radios/7/relationship/",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ kind: "assigned_to", target_object_id: 60, location_id: null }) }),
    ]);
  });
});
