import { Activity, ArrowRight, CheckCircle2, Clock3, ListTodo, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StartTaskForm } from "@/components/StartTaskForm";
import { TaskProgress } from "@/components/TaskProgress";
import { api, type TaskSnapshot } from "@/lib/api";
import { taskLabel, taskStatusLabel } from "@/lib/taskPresentation";

export function DashboardPage() {
  const [tasks, setTasks] = useState<TaskSnapshot[]>([]);
  const [activeTask, setActiveTask] = useState<TaskSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      setError("");
      const [recent, savedTaskId] = await Promise.all([api.listTasks(), Promise.resolve(localStorage.getItem("activeTaskId"))]);
      setTasks(recent);
      if (savedTaskId) {
        try { setActiveTask(await api.getTask(savedTaskId)); }
        catch { localStorage.removeItem("activeTaskId"); setActiveTask(null); }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
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

  const start = async (duration: number) => {
    setStarting(true);
    try {
      const started = await api.startTask(duration);
      localStorage.setItem("activeTaskId", started.task_id);
      toast.success("Background task started");
      navigate(`/tasks/${started.task_id}`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not start task");
    } finally {
      setStarting(false);
    }
  };

  const running = tasks.filter((task) => ["PENDING", "STARTED", "PROGRESS", "RETRY"].includes(task.status)).length;
  const completed = tasks.filter((task) => task.status === "SUCCESS").length;

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-primary">Workspace overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard</h1><p className="mt-2 text-sm text-muted-foreground">Your application foundation is ready to extend.</p></div>
      <Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
    </div>

    {error && <div role="alert" className="flex items-center justify-between border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">{error}<Button variant="outline" size="sm" onClick={() => void refresh()}>Try again</Button></div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Recent tasks", value: tasks.length, icon: ListTodo },
        { label: "Currently active", value: running, icon: Activity },
        { label: "Completed", value: completed, icon: CheckCircle2 },
        { label: "Task runtime", value: "30 sec", icon: Clock3 },
      ].map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div><span className="grid h-10 w-10 place-items-center bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></span></CardContent></Card>)}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader><CardTitle>Start a background task</CardTitle><CardDescription>See the full REST → Celery → PostgreSQL → SSE flow in action.</CardDescription></CardHeader>
        <CardContent><StartTaskForm onStart={start} busy={starting} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Task execution</CardTitle><CardDescription>Tasks continue even when you navigate away.</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3"><span className="mt-0.5 grid h-6 w-6 place-items-center bg-muted text-xs font-semibold text-foreground">1</span><p>Start the example task. Django returns its Celery task ID immediately.</p></div>
          <div className="flex items-start gap-3"><span className="mt-0.5 grid h-6 w-6 place-items-center bg-muted text-xs font-semibold text-foreground">2</span><p>A worker reports progress, saved with the task result in PostgreSQL.</p></div>
          <div className="flex items-start gap-3"><span className="mt-0.5 grid h-6 w-6 place-items-center bg-muted text-xs font-semibold text-foreground">3</span><p>The task page reconnects over SSE and restores the latest state after refresh.</p></div>
        </CardContent>
      </Card>
    </div>

    {activeTask && <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Saved task</CardTitle><CardDescription className="mt-1 font-mono text-xs">{activeTask.task_id}</CardDescription></div><Button variant="outline" asChild><Link to={`/tasks/${activeTask.task_id}`}>Open task <ArrowRight className="h-4 w-4" /></Link></Button></div></CardHeader><CardContent><TaskProgress task={activeTask} /></CardContent></Card>}

      <Card>
        <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Recent background tasks</CardTitle><CardDescription className="mt-1">Latest task executions. Status updates automatically.</CardDescription></div><Button variant="outline" asChild><Link to="/tasks">View all <ArrowRight className="h-4 w-4" /></Link></Button></div></CardHeader>
      <CardContent>
        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Loading tasks…</div> : tasks.length === 0 ? <div className="py-8 text-center"><Play className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No tasks yet</p><p className="mt-1 text-sm text-muted-foreground">Start the example above to see it here.</p></div> : <div className="divide-y">{tasks.slice(0, 5).map((task) => <Link key={task.task_id} to={`/tasks/${task.task_id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-muted/40"><div className="min-w-0"><p className="truncate text-sm font-medium">{taskLabel(task.task_name)}</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{task.task_id}</p></div><span className="text-xs text-muted-foreground">{taskStatusLabel(task.status)}</span></Link>)}</div>}
      </CardContent>
    </Card>
  </div>;
}
