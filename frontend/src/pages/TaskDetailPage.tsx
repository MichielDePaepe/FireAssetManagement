import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskProgress } from "@/components/TaskProgress";
import { api, subscribeToTask, type TaskSnapshot } from "@/lib/api";

export function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const [task, setTask] = useState<TaskSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { setTask(await api.getTask(taskId)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load task"); }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!taskId) return;
    const unsubscribe = subscribeToTask(taskId, (snapshot) => {
      setTask(snapshot);
      if (["SUCCESS", "FAILURE", "REVOKED"].includes(snapshot.status)) unsubscribe();
    }, () => undefined);
    return unsubscribe;
  }, [taskId]);

  useEffect(() => {
    if (taskId) localStorage.setItem("activeTaskId", taskId);
  }, [taskId]);

  return <div className="mx-auto max-w-3xl space-y-7">
    <Button variant="ghost" asChild className="-ml-3"><Link to="/tasks"><ArrowLeft className="h-4 w-4" />Back to tasks</Link></Button>
    <div><p className="text-sm font-medium text-primary">Task details</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Example background task</h1><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{taskId}</p></div>
    {error ? <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">{error}<Button variant="outline" size="sm" className="ml-4" onClick={() => void refresh()}>Try again</Button></div> : <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Execution progress</CardTitle><CardDescription className="mt-1">Live updates are delivered over Server-Sent Events.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader><CardContent>{loading || !task ? <div className="py-6 text-sm text-muted-foreground">Loading task status…</div> : <TaskProgress task={task} />}</CardContent></Card>}
    <Card><CardHeader><CardTitle className="text-base">You can leave this page</CardTitle><CardDescription>The worker continues independently. Reopening this URL or refreshing the browser fetches the saved state and reconnects to SSE.</CardDescription></CardHeader></Card>
    <div className="text-xs text-muted-foreground">Connection: <span className="font-medium text-foreground">SSE with automatic browser reconnect</span>. PostgreSQL stores the latest task state and result.</div>
  </div>;
}
