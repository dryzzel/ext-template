# Espo Notes 1.1.0 validation

Executed locally on **2026-10-16** with the actual EspoCRM **9.3.3** Docker image, PHP **8.4.18**, MySQL 8.0, and Playwright Chromium. The user's production CRM was not accessed or changed.

## Change

The top-bar notepad now opens one page containing editable callback rows. Agents can add several callbacks, save all changed rows together, mark a row Done, reschedule it, and review history without opening separate note forms. Customer/CRM-link details expand within each row. Each row retains its own scheduled date and native popup reminder.

The data model, permissions, and standard CRUD API remain compatible with 1.0.0. Existing dated callbacks and undated notes appear automatically; no record conversion, role changes, or database migration is required.

## Final package

- Artifact: `build/espo-notes-1.1.0.zip` (33,079 bytes).
- SHA-256: `a63ffbeef18a32ce4068cd7185d1eddd6ee20e1f444594b92b7b6f9957f0bc4f`.
- Built using EspoCRM's official extension-tools 0.4.5.
- Compatible version range: `>=9.3.3 <9.4.0`; PHP `>=8.3 <8.6`.
- Contains the compiled client bundle/templates, module metadata and PHP classes, and lifecycle scripts. Development credentials, test helpers, and test fixtures are excluded.

## Results

| Check | Result |
| --- | --- |
| Build and installation on EspoCRM 9.3.3 | Passed |
| API integration | 32 assertions passed |
| Chromium browser workflows | 14 checks passed |
| 1.0.0 upgrade and installation lifecycle | 4 checks passed |
| PHP syntax | 12 files passed |
| Git whitespace check | Passed |

### Browser workflows

1. Existing callbacks appear on the shared page with their original reminder.
2. Two inline callbacks save together with independent dates/reminder offsets; Caracas-to-UTC conversion crosses the date boundary correctly.
3. Multiple unsaved drafts survive closing and reopening the notepad.
4. A deliberately injected HTTP 503 on one row produces an accurate partial-save summary; the other row saves and retry sends only the failed row.
5. Conflicting edits return an error; reloading that row preserves another row's unsaved draft.
6. Completing one row clears only its reminder; history and rescheduling restore the correct reminder.
7. Each row can independently link the currently open CRM record.
8. Invalid blank rows stop bulk saving before any request and can be removed without altering saved callbacks.
9. The same page remains usable at a 390-pixel viewport without horizontal page overflow.
10. Saved rows survive a browser reload without duplicate records.
11. Search filters rows directly on the page.
12. Load more retrieves the remaining callbacks across multiple pages for an agent with more than 50 rows.
13. The real native WebSocket popup job delivers a frame and renders a callback reminder in the browser.
14. Managers can review agent callbacks with editing disabled.

Screenshots: `test-results/notepad-desktop.png`, `test-results/notepad-mobile.png`, and `test-results/manager-read-only.png`. The injected save failure produces an expected network-console error; uncaught page errors fail the suite.

### API and lifecycle

The 32 API assertions cover persistent storage, owner/team assignment, own-only visibility for agents, team read-only manager review, unrelated manager isolation, list/count/search ACLs, protected sharing fields and relationship endpoints, parent-record ACL checks, scheduling validation, popup-only reminders, exact agent recipients, rescheduling and administrator edits, optimistic concurrency, completion/archive/unschedule/delete cleanup, reopening, overdue retention beyond 24 hours, overdue text edits, and real popup polling.

The lifecycle checks install the original 1.0.0 ZIP on the disposable instance, create a callback, and upgrade it to 1.1.0, verifying content and its original reminder offset survive. In-place 1.1.0 installation preserves data without duplicate reminders. Uninstall clears outstanding extension reminders, and reinstall restores saved entries and future reminders for the correct agent.

## Reproduce

```powershell
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run dev:setup
npm.cmd run test:lint
npm.cmd test
```

The test suite uses only `http://localhost:8093` and this project's Docker Compose services. It creates fresh test users and teams. The old-to-new upgrade check runs when the original `build/espo-notes-1.0.0.zip` is available; the three standard lifecycle checks always run. The CI workflow is present but was not executed on hosted GitHub Actions in this session.

## Install on the user's CRM

Upload `espo-notes-1.1.0.zip` over the installed extension in **Administration > Extensions**, then refresh browser tabs. Do not uninstall first. Existing callbacks, reminders, and role settings remain in place.

Local tests do not establish production deployment, effective merged roles, production scheduler/WebSocket configuration, or live delivery. Those must be checked on the user's CRM after installation. Other browsers and high-volume load were not tested.
