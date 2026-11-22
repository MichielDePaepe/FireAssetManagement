import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FireplanSyncReportDialog } from "@/components/FireplanSyncReportDialog";
import { TaskProgress } from "@/components/TaskProgress";
import { api, subscribeToTask, type FireplanRadioSyncResult, type FireplanSyncResult, type TaskSnapshot } from "@/lib/api";
import { taskLabel } from "@/lib/taskPresentation";

function fireplanResult(task: TaskSnapshot | null): FireplanSyncResult | FireplanRadioSyncResult | null {
  if (!task?.result || !("unchanged" in task.result)) return null;
  if (task.task_name === "fireplan.sync_pagers" || task.task_name === "fireplan.sync_radios") return task.result;
  return null;
}

export function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [task, setTask] = useState<TaskSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const report = fireplanResult(task);
  const [reportOpen, setReportOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTask(await api.getTask(taskId));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Taak laden is niet gelukt.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const openReport = useCallback(() => {
    setReportOpen(true);
    setSearchParams((current) => {
      current.set("report", "1");
      return current;
    }, { replace: true });
  }, [setSearchParams]);

  const closeReport = useCallback(() => {
    setReportOpen(false);
    setSearchParams((current) => {
      current.delete("report");
      return current;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!taskId) return;
    const unsubscribe = subscribeToTask(taskId, (snapshot) => {
      setTask(snapshot);
      if (["SUCCESS", "FAILURE", "REVOKED"].includes(snapshot.status)) {
        unsubscribe();
        if (snapshot.status === "SUCCESS" && !fireplanResult(snapshot)) {
          void api.getTask(taskId).then(setTask).catch(() => undefined);
        }
      }
    }, () => undefined);
    return unsubscribe;
  }, [taskId]);
  useEffect(() => {
    if (taskId) localStorage.setItem("activeTaskId", taskId);
  }, [taskId]);
  useEffect(() => {
    if (report && searchParams.get("report") === "1") setReportOpen(true);
  }, [report, searchParams]);

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <Button variant="ghost" asChild className="-ml-3">
        <Link to="/tasks"><ArrowLeft className="h-4 w-4" />Terug naar taken</Link>
      </Button>
      <div>
        <p className="text-sm font-medium text-primary">Taakdetails</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {taskLabel(task?.task_name ?? null)}
        </h1>
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{taskId}</p>
      </div>
      {error ? (
        <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">
          {error}
          <Button variant="outline" size="sm" className="ml-4" onClick={() => void refresh()}>
            Opnieuw proberen
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Uitvoering</CardTitle>
                <CardDescription className="mt-1">
                  De voortgang wordt live bijgewerkt. Je kunt intussen verder navigeren.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Vernieuwen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading || !task ? (
              <div className="py-6 text-sm text-muted-foreground">Taakstatus laden…</div>
            ) : (
              <TaskProgress task={task} onOpenReport={report ? openReport : undefined} />
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Je kunt deze pagina verlaten</CardTitle>
          <CardDescription>
            De taak blijft op de achtergrond draaien. Open deze taak later opnieuw om de opgeslagen
            voortgang en het rapport te bekijken.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="text-xs text-muted-foreground">
        Status, voortgang en resultaat worden bewaard via Celery en PostgreSQL.
      </div>
      {report && (
        <FireplanSyncReportDialog report={report} open={reportOpen} onClose={closeReport} />
      )}
    </div>
  );
}
