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
  result: { message?: string; duration_seconds?: number } | null;
  error: string | null;
  updated_at: string | null;
}

export interface StartedTask {
  task_id: string;
  status: "PENDING";
}

export interface UserSession {
  username: string;
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
  startTask: (duration_seconds: number) =>
    request<StartedTask>("/tasks/", { method: "POST", body: JSON.stringify({ duration_seconds }) }),
  getTask: (id: string) => request<TaskSnapshot>(`/tasks/${encodeURIComponent(id)}/`),
  taskEventsUrl: (id: string) => `${API_BASE}/tasks/${encodeURIComponent(id)}/events/`,
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
