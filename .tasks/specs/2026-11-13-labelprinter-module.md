---
kind: bootstrap
title: Pager Asset Management
repo: private
date: 2026-11-13
goal: |
  Add a staff-managed label-printer module to the pager asset application. Initially support the Brother PT-P900W over the network, including connection checks and a configurable-width text test label, while keeping printer records suitable for adding other printer brands later.
phases:
  - name: Printer management
    goal: Add staff-only printer configuration with validated network settings and a management page, initially offering the Brother PT-P900W.
  - name: Connection checks and test labels
    goal: Add a time-limited network connection check and print a simple text test label at the configured tape width through the Brother driver.
---
## Design

### Scope and access

Add a separate printer module and a **Beheer → Labelprinters** page. Only staff users may list, create, edit, delete, test, or print from configured printers. The first supported model is Brother PT-P900W. Printer records store a management name, manufacturer, model, IP address, TCP port, and default tape width (12 mm initially). Keep manufacturer and model as data fields so future driver integrations can add other brands without reshaping the records; do not build a generic plugin framework now.

The page provides two independent actions: a direct TCP reachability check with a bounded timeout, and a text test label containing the printer name and current time. The test label uses the configured tape width. For the initial Brother PT-P900W driver, offer continuous label widths 6, 12, 18, 24, and 36 mm. A successful network check only confirms the configured port is reachable. A successful driver call does not prove the printer physically completed the label; verify the printer and tape with a manual proof print.

### Implementation approach

Printer configuration and the brief connection check belong in Django and the existing authenticated REST API. The check is synchronous because it is a short, bounded socket operation. The existing Celery/SSE task flow is not needed for it. A printer-specific driver adapter sends the test label through `brother-label`; do not implement the Brother raster protocol in parallel. The repository's Brother printing note identifies `brother-label==2.0a8`, `qrcode`, and Pillow for future QR-label work. Only `brother-label` is needed for this text test label; add the pinned version to the backend requirements and document its purpose and GPLv3+ pre-release status. The package lists PT-P900W as supported but does not mark it user-verified, so physical compatibility remains to be checked.

The PT-P900W supports additional physical tape widths, but the initial test-label UI follows the widths listed for continuous PT media by the selected driver. Keep QR payload definition, pager detail-page integration, batch printing, print history, other printer brands, and printer discovery out of this phase. Those can be specified later; in particular, the current pager records do not contain the Fireplan ID used by the existing QR-label example.

### Acceptance and documentation

- Staff can add, edit, list, and delete printer records; non-staff API requests are denied and the frontend keeps the page under the staff-only management area.
- Validation rejects missing or malformed addresses, invalid ports, unsupported initial models, and widths outside the initial driver's supported continuous PT media choices.
- The connection action reports reachable, timeout, or connection failure from the application server without claiming to know the printer's tape or physical state.
- The test-label action sends the configured text label using the stored printer model, address, port, and tape width. Driver errors are returned as failures rather than success notifications.
- Backend tests mock socket and printer-driver I/O; frontend tests cover form validation, loading, errors, and both actions. A real printer check is a separate manual proof print.
- Update `README.md`, `ARCHITECTURE.md`, `SPEC.md`, and backend dependency documentation to reflect the module and driver. No environment variable or deployment topology change is required.

The main alternative is to run the connection check as a Celery task and expose progress through SSE. That reuses existing infrastructure but adds unnecessary task lifecycle and UI complexity to a short network check. A direct Django check is recommended. The label itself still uses the Brother-specific driver package because the current Django and frontend packages do not implement that printer protocol.
