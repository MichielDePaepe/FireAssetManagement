---
kind: extension
date: 2026-11-14
phases:
  - name: Fireplan pager sync backend
    goal: Store Fireplan pager identifiers and QR URLs, fetch matching inventory records, and synchronize them through the existing Celery task and result flow.
    exit-criteria: |
      - Fireplan ID and QR URL are optional pager fields; Fireplan IDs are unique when present.
      - The authenticated Fireplan inventory endpoint is read through the existing encrypted session and same-origin client.
      - Records are matched to configured pager types by exact Fireplan name and fetched in batches of up to 500, following the returned total when more records exist.
      - Initial local matching uses exact serial number; subsequent matching prefers the stored Fireplan ID.
      - Matching Fireplan data creates or updates pagers; local-only pagers are retained and records for unknown models are ignored.
      - A Celery task reports progress and returns added, updated, unchanged, and per-record error details through the existing task result backend.
  - name: Sync controls, progress, and report
    goal: Add staff-only sync controls, show the Fireplan task in the existing task UI, and surface its completion report through a global toast and modal.
    exit-criteria: |
      - Only staff can queue a pager sync.
      - A user can navigate away while the task runs, then reopen its persisted progress and result from the existing task views.
      - Completion produces a bottom-right toast with an action that opens a report modal; the completed task detail also provides access to the report.
      - The report shows added, updated, unchanged, and failed records; global toasts appear at the bottom right.
      - README, ARCHITECTURE.md, and SPEC.md describe the current integration and its limits.
---
## Notes

### Source and matching

Fireplan's authenticated `fr/api/inventory/qr-codes` route returns `records` containing `id`, `name`, `serialNumber`, `qrCode`, and other fields, plus `total`. The `qrCode` field is already the complete infoscan URL and must be stored verbatim for future QR label work. Fireplan's `type` value is a generic inventory category; map the pager model using `name` instead.

Only records whose `name` exactly matches a `PagerType` currently configured in the local database are pager candidates. This allows staff to add a supported model locally before it is included in synchronization. Query `filters.name` with the configured names, request `rows=500`, and retain `filterOptionsExcluded` for unused filter choices so Fireplan does not add its large option catalogue to the response. The checked endpoint returned all 55 current matching records in one response; continue from `first` if `total` exceeds the requested page size.

On first synchronization, associate a candidate with a local pager by exact serial number where one exists; otherwise create it. Save the Fireplan `id` and full `qrCode` URL. On later runs, match by Fireplan ID first, so a serial-number change updates the same local pager. Fireplan is authoritative for the pager type, serial number, and QR URL. Do not delete local pagers missing from Fireplan. Ignore Fireplan models without an exact configured `PagerType` match. Fireplan requires a serial number; if a malformed response omits it, report that row as an error and continue with valid rows.

### Execution and user experience

Queue the synchronization as a staff-only Celery task using the existing Celery task ID, `celery-progress`, `django-celery-results`, and SSE endpoints. Do not introduce another task result model or queue. Extend the existing task collection and task detail allow-list to include this task and present its real name and report in the existing task screens. Fetch the Fireplan pages before applying database changes so a network failure cannot produce an incomplete import; use bounded retry behavior for transient Fireplan errors. Per-record validation or uniqueness errors should be included in the result while other valid records are processed.

The pager page starts the task and retains its ID for a global completion watcher in the authenticated app shell. Users can navigate while the worker runs. On completion, show a bottom-right Sonner toast with a **View report** action. That action opens an accessible square-corner modal with counts for added, updated, unchanged, and errored records and concise details for each failed record. The completed task detail must also offer the report, so it remains available after the toast is dismissed or the user returns later. Use the existing stack; no new dependency is needed.

### Out of scope

Do not add scheduled synchronization, deletion of local-only pagers, QR image generation, QR label printing, Fireplan write operations, or synchronization for models absent from the local `PagerType` table. Those can be specified separately.
