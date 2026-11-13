import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToTask, type TaskSnapshot } from "@/lib/api";

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
