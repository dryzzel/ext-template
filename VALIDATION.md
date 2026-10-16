# Espo Notes 1.0.0 validation

Executed locally on **2026-10-16**, using the actual `espocrm/espocrm:9.3.3` Docker image, PHP **8.4.18**, MySQL 8.0, and Playwright Chromium. The CRM version was confirmed using `php command.php version`. This is a disposable local instance; the user's production CRM was not accessed or changed.

## Package

- Artifact: `build/espo-notes-1.0.0.zip` (30,176 bytes).
- SHA-256: `02ea8c715932900c35ac86ed7db60a554b2bf273bdd1b123db0900fa7c317e18`.
- Built by EspoCRM's official extension-tools 0.4.5 from the initialized ext-template scaffold.
- Manifest restricts installation to `>=9.3.3 <9.4.0` and PHP `>=8.3 <8.6`.
- Archive inspection confirmed module files, compiled client assets, metadata/layouts/translations, and install/uninstall scripts. Development credentials, test helpers, node_modules, and runtime fixtures are excluded.

## Results

| Check | Result |
| --- | --- |
| Extension build and installation on 9.3.3 | Passed |
| API integration assertions | 32 passed |
| Chromium workflow checks | 12 passed |
| In-place installation, uninstall, reinstall | 3 passed |
| PHP syntax validation | 12 files passed |
| Git whitespace validation | Passed |

### API coverage

Created two agents in one team, a manager in that team, and an unrelated manager in another team, with separate Agent/Manager roles. Verified trimmed title generation, persistent retrieval, server-controlled ownership and teams, own-only list/count/detail access, team manager reads, manager write rejection, sharing-field protection, and blocked relationship-based sharing.

Verified empty-note/missing-time/past-time/past-reminder rejection; native Popup-only reminder creation despite an injected Email payload; agent recipient selection; reschedule replacement; administrator reschedules preserving agent reminder choices; optimistic concurrency conflict responses; completion/archive/unschedule/delete cleanup; reopening; overdue retention beyond 24 hours; overdue content edits; parent-record ACL checks; positive/negative text search; and explicit owner filters not bypassing ACL.

Timed a real callback and received it from EspoCRM's native popup polling endpoint. Reminder storage and cleanup were inspected through the test instance's ORM, not a mocked service.

### Browser coverage

Verified Ctrl+Enter saving, close/reopen draft preservation with confirmation, converting a note to a callback in place, Caracas timezone conversion across a UTC date boundary, narrow-screen layout without horizontal overflow, completion history, a deliberately injected HTTP 503 retaining the draft followed by a successful retry, linking the currently open Lead, double-click submission producing one entry, panel search, full-list navigation, native record-form creation, and manager detail access with the edit control hidden and status displayed. Checked that the top-bar label fits its navigation button.

Enabled the real EspoCRM WebSocket server with its ZeroMQ transport. A timed callback was submitted using the native `SubmitPopupReminders` job. The browser received the WebSocket frame and rendered the native callback popup. The simulated HTTP 503 intentionally emits one browser network-console error; no uncaught page errors were accepted.

Screenshots are generated in ignored `test-results/`: `notepad-desktop.png`, `notepad-mobile.png`, and `manager-read-only.png`.

### Lifecycle coverage

Installed the package over itself and verified saved content and a single existing reminder. Uninstalled and confirmed all extension reminders were removed. Reinstalled and confirmed content survived and the future reminder returned for the original agent with the correct 15-minute offset.

## Reproduce

```powershell
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run dev:setup
npm.cmd run test:lint
npm.cmd test
```

Tests are intentionally bound to `http://localhost:8093` and this project's Docker Compose configuration. `npm.cmd run dev:stop` stops the local services while retaining test volumes. The repository includes a CI workflow for the same runtime checks; a hosted CI run has not been executed in this session.

## Production pilot still required

Install the ZIP and configure roles on a staging copy of the user's CRM, then pilot with two agents and one manager. Confirm effective merged roles, actual teams and linked-record permissions, each user's timezone, the existing polling/WebSocket/job configuration, and real callback delivery. Local tests do not establish those production settings, deployment, or delivery. High-volume load testing and browsers other than Chromium were not performed.
