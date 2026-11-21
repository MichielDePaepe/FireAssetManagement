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
        application: "portable",
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
