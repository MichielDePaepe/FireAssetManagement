import type { TaskStatus } from "@/lib/api";

const taskLabels: Record<string, string> = {
  "tasks.example_task": "Celery-voortgangstest",
  "fireplan.sync_pagers": "Fireplan-pagersynchronisatie",
  "fireplan.sync_radios": "FirePlan-radiosynchronisatie",
  "fireplan.sync_inventories": "FirePlan-inventarissynchronisatie",
  "citygis.refresh": "CityGIS-synchronisatie",
  "suivo.sync": "Suivo-synchronisatie",
};

const statusLabels: Record<TaskStatus, string> = {
  PENDING: "In wachtrij",
  STARTED: "Bezig",
  PROGRESS: "Bezig",
  RETRY: "Opnieuw proberen",
  SUCCESS: "Voltooid",
  FAILURE: "Mislukt",
  REVOKED: "Geannuleerd",
};

export function taskLabel(taskName: string | null): string {
  return taskName ? taskLabels[taskName] ?? "Achtergrondtaak" : "Achtergrondtaak";
}

export function taskStatusLabel(status: TaskStatus): string {
  return statusLabels[status] ?? status;
}
