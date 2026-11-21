import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import type { FireplanInventorySyncResult, FireplanSyncResult, TaskSnapshot } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { taskStatusLabel } from "@/lib/taskPresentation";

const statusTone = (status: string): "muted" | "success" | "warning" | "danger" => {
  if (status === "SUCCESS") return "success";
  if (status === "FAILURE") return "danger";
  if (status === "RETRY") return "warning";
  return "muted";
};

function isFireplanResult(task: TaskSnapshot): task is TaskSnapshot & { result: FireplanSyncResult } {
  return task.task_name === "fireplan.sync_pagers" && Boolean(task.result && "added" in task.result);
}

function isFireplanInventoryResult(task: TaskSnapshot): task is TaskSnapshot & { result: FireplanInventorySyncResult } {
  return task.task_name === "fireplan.sync_inventories" && Boolean(task.result && "skipped" in task.result);
}

export function TaskProgress({
  task,
  onOpenReport,
}: {
  task: TaskSnapshot;
  onOpenReport?: () => void;
}) {
  const percent = task.progress?.percent ?? (task.status === "SUCCESS" ? 100 : 0);
  const running = ["PENDING", "STARTED", "PROGRESS", "RETRY"].includes(task.status);
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {task.status === "SUCCESS" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : task.status === "FAILURE" ? <CircleAlert className="h-4 w-4 text-red-600" /> : running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {task.progress?.description ?? (task.status === "SUCCESS" ? "Task completed" : task.status === "FAILURE" ? "Task failed" : "Waiting for a worker…")}
        </div>
        <Badge tone={statusTone(task.status)}>{taskStatusLabel(task.status)}</Badge>
      </div>
      <Progress value={percent} aria-label="Task progress" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{task.progress ? `${task.progress.current} / ${task.progress.total} steps` : "Progress will appear here"}</span>
        <span>{percent}%</span>
      </div>
      {task.error && <p className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{task.error}</p>}
      {task.result?.message && <div className="border bg-muted/40 p-4 text-sm"><p className="font-medium">Result</p><p className="mt-1 text-muted-foreground">{task.result.message}</p></div>}
      {isFireplanResult(task) && (
        <div className="space-y-4 border bg-muted/20 p-4">
          <h3 className="font-medium">Synchronisatierapport</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Toegevoegd</dt><dd className="mt-1 font-semibold">{task.result.added}</dd></div>
            <div><dt className="text-muted-foreground">Bijgewerkt</dt><dd className="mt-1 font-semibold">{task.result.updated}</dd></div>
            <div><dt className="text-muted-foreground">Ongewijzigd</dt><dd className="mt-1 font-semibold">{task.result.unchanged}</dd></div>
            <div><dt className="text-muted-foreground">Mislukt</dt><dd className="mt-1 font-semibold">{task.result.errors.length}</dd></div>
          </dl>
          {onOpenReport && (
            <Button variant="outline" onClick={onOpenReport}>
              Synchronisatierapport bekijken
            </Button>
          )}
        </div>
      )}
      {isFireplanInventoryResult(task) && (
        <div className="space-y-4 border bg-muted/20 p-4">
          <h3 className="font-medium">Inventarissynchronisatierapport</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Toegevoegd</dt><dd className="mt-1 font-semibold">{task.result.added}</dd></div>
            <div><dt className="text-muted-foreground">Bijgewerkt</dt><dd className="mt-1 font-semibold">{task.result.updated}</dd></div>
            <div><dt className="text-muted-foreground">Overgeslagen</dt><dd className="mt-1 font-semibold">{task.result.skipped}</dd></div>
            <div><dt className="text-muted-foreground">Mislukt</dt><dd className="mt-1 font-semibold">{task.result.failed}</dd></div>
          </dl>
          {task.result.errors.length > 0 && <ul className="space-y-2 text-sm" aria-label="Fouten per inventaris">
            {task.result.errors.map((item) => <li key={item.uuid} className="border-l-2 border-red-500 bg-red-50 p-3 text-red-800">
              <span className="font-medium">{item.uuid}</span>: {item.error}
            </li>)}
          </ul>}
        </div>
      )}
    </div>
  );
}
