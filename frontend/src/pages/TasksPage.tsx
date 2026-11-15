import { Activity, ArrowRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type TaskSnapshot } from "@/lib/api";
import { taskLabel, taskStatusLabel } from "@/lib/taskPresentation";

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);
  const refresh = useCallback(async (showLoading = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (showLoading) setLoading(true);
    try { setTasks(await api.listTasks()); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load tasks"); }
    finally { requestInFlight.current = false; setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh(true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 5000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);
  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">Operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Background tasks</h1><p className="mt-2 text-sm text-muted-foreground">Persistent task status and results from Celery. Status updates automatically.</p></div><Button variant="outline" onClick={() => void refresh(true)} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
    <Card><CardHeader><CardTitle>Task history</CardTitle><CardDescription>Up to 50 recent tasks, including Fireplan synchronizations. Flower provides worker-level monitoring.</CardDescription></CardHeader><CardContent>
      {error ? <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">{error}</div> : loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Loading tasks…</div> : tasks.length === 0 ? <div className="py-12 text-center"><Activity className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No completed or active tasks found</p><p className="mt-1 text-sm text-muted-foreground">Start a background task from the dashboard or pager list.</p></div> : <div className="divide-y">{tasks.map((task) => <Link key={task.task_id} to={`/tasks/${task.task_id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-muted/40"><div><p className="font-medium">{taskLabel(task.task_name)}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{task.task_id}</p></div><div className="flex items-center gap-3"><Badge tone={task.status === "SUCCESS" ? "success" : task.status === "FAILURE" ? "danger" : task.status === "RETRY" ? "warning" : "muted"}>{taskStatusLabel(task.status)}</Badge><span className="hidden text-xs text-muted-foreground sm:inline">{task.updated_at ? new Date(task.updated_at).toLocaleString() : "In wachtrij"}</span><ArrowRight className="h-4 w-4" /></div></Link>)}</div>}
    </CardContent></Card>
  </div>;
}
