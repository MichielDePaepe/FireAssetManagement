---
kind: extension
date: 2026-11-16
phases:
  - name: Pager scanlookup
    goal: Add an authenticated backend lookup that normalizes keyboard-scanner layout variants and matches the complete scanned Fireplan QR URL to a stored pager URL.
    exit-criteria: |
      - The lookup preserves the raw scan and tries the documented AZERTY/QWERTY variants as alternatives.
      - A pager is resolved only by matching its complete stored Fireplan QR URL; the Fireplan ID is not extracted for this lookup.
      - Unknown or invalid scans return a clear error response.
  - name: Reusable scan controls
    goal: Build a reusable frontend control for one-shot keyboard-wedge scanning on computers and camera QR scanning on phones and tablets.
    exit-criteria: |
      - On computers, the button toggles scan mode; Enter submits one scan and automatically exits scan mode.
      - On phones and tablets, a user action starts the camera scanner and one decoded code stops it.
      - Camera streams and scanner resources are stopped on success, cancellation, and view unmount.
      - No HTTPS hosting or certificate changes are included; camera access depends on a secure browser context.
  - name: Pager scan flows
    goal: Integrate scanning into the inventory pager list and the free-pager section of a vector's relationship dialog.
    exit-criteria: |
      - Scanning a registered pager from the inventory pager list opens its existing relationship-management dialog.
      - Scanning a pager that is currently free in a vector dialog links it to that vector and refreshes the lists.
      - Invalid, unknown, or non-free pager scans show an error toast and do not alter another vector's relationship.
  - name: Verification and documentation
    goal: Verify scan lookup and both pager flows, and document the camera-scanner dependency and usage constraints.
    exit-criteria: |
      - Tests cover correct URL matching, keyboard-layout variants, unknown scans, and non-free pagers.
      - Frontend tests cover opening the pager relationship dialog and linking a free pager after scanning.
      - Frontend lint, type checks, backend tests, and applicable lint checks pass or have documented environment limitations.
      - Dependency purpose and camera secure-context requirements are documented.
---
## Notes

### Goal and scope

Add reusable QR scanning to Pager Asset Management, starting with pagers. Support a hand scanner that behaves as a keyboard on computers and camera scanning on phones and tablets. The first release uses scanning in two places: the general inventory pager list and the free-pager list inside a vector's relationship dialog.

For the general inventory list, a successful scan opens the same pager relationship-management dialog as selecting that pager in the table. In a vector dialog, a successful scan of a free pager immediately links it to the open vector. A pager that is unknown, invalid, or not in the free-pager list produces an error toast; scanning must never silently move a pager from another vector.

Pager records already store the complete Fireplan QR URL. Resolve a scan against that complete URL, not by extracting the Fireplan ID. Keep the raw scanned text and use the AZERTY/QWERTY alternative-candidate approach documented in the supplied `qr-scanner.md`: recognize the input format before applying layout translations and preserve the original candidate. Camera input goes through the same lookup and does not normally require keyboard-layout correction.

The scanner UI is reusable for later asset types, but this extension implements lookup and scan actions for pagers only. It does not add other asset types, QR-label generation, inventory counting, reassignment from another vector, or HTTPS hosting/certificate configuration. Camera access on phones and tablets still depends on the browser's secure-context requirements; keyboard-wedge scanning is the primary usable path on the current HTTP LAN deployment.

### Approaches considered

1. **Shared scanner UI with server lookup — selected.** The frontend captures raw text from either the keyboard-wedge scanner or ZXing camera interface. The authenticated backend applies the documented scan-candidate normalization and resolves the pager by its stored full QR URL. This keeps layout correction and matching consistent across the two screens and supports future UI reuse.
2. **Resolve scans in the browser.** This avoids a dedicated lookup endpoint but duplicates scanner normalization in the frontend and depends on the pager data already loaded by each view.
3. **Use the browser-native camera barcode API.** This avoids a scanner dependency, but camera support varies across target browsers and is less dependable for phone/tablet use.

The selected approach uses ZXing for camera decoding because the application has no existing QR camera package and the native browser API is not consistently available across the target devices. Do not make HTTPS deployment work a prerequisite for the initial hand-scanner flow.
