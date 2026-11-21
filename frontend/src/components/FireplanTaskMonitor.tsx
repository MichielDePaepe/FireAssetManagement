import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, subscribeToTask, type FireplanRadioSyncResult, type FireplanSyncResult, type TaskSnapshot } from "@/lib/api";

function fireplanReport(task: TaskSnapshot): FireplanSyncResult | FireplanRadioSyncResult | null {
  if (!task.result || !("unchanged" in task.result)) return null;
  if (task.task_name === "fireplan.sync_pagers" || task.task_name === "fireplan.sync_radios") return task.result;
  return null;
}

export function FireplanTaskMonitor() {
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const watchActiveTask = () => {
      unsubscribe?.();
      const taskId = window.localStorage.getItem("activeFireplanSyncId");
      if (!taskId) return;
      let finalReportRead = false;

      const handleSnapshot = (task: TaskSnapshot) => {
        if (!["SUCCESS", "FAILURE", "REVOKED"].includes(task.status)) return;
        unsubscribe?.();
        const report = fireplanReport(task);
        if (task.status === "SUCCESS" && !report) {
          if (finalReportRead) return;
          finalReportRead = true;
          void api.getTask(taskId).then(handleSnapshot).catch(() => undefined);
          return;
        }
        const toastKey = `fireplanSyncToastShown:${taskId}`;
        if (window.localStorage.getItem(toastKey)) return;
        window.localStorage.setItem(toastKey, "true");

        const action = {
          label: task.status === "SUCCESS" ? "Rapport bekijken" : "Details bekijken",
          onClick: () => navigate(`/tasks/${encodeURIComponent(taskId)}?report=1`),
        };
        if (task.status === "SUCCESS" && report) {
          toast.success("Fireplan-synchronisatie voltooid", {
            description: `${report.added} toegevoegd · ${report.updated} bijgewerkt · ${report.unchanged} ongewijzigd · ${report.errors.length} fouten${"skipped" in report ? ` · ${report.skipped} overgeslagen` : ""}`,
            action,
          });
        } else {
          toast.error("Fireplan-synchronisatie mislukt", {
            description: task.error ?? "De synchronisatietaak is gestopt.",
            action,
          });
        }
      };

      void api.getTask(taskId).then(handleSnapshot).catch(() => undefined);
      unsubscribe = subscribeToTask(taskId, handleSnapshot, () => undefined);
    };

    watchActiveTask();
    window.addEventListener("fireplan-sync-task-change", watchActiveTask);
    window.addEventListener("storage", watchActiveTask);
    return () => {
      unsubscribe?.();
      window.removeEventListener("fireplan-sync-task-change", watchActiveTask);
      window.removeEventListener("storage", watchActiveTask);
    };
  }, [navigate]);

  return null;
}
