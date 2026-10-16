# Espo Notes

Installable agent notepad and callback reminders for **EspoCRM 9.3.3**. Version **1.0.0**.

Agents open **Notepad** in the top bar, save a note, optionally schedule a callback, and complete or archive it when finished. Authorized managers review team entries through **Full list**. Records are stored in EspoCRM and use its normal login, permissions, timezone preferences, and popup reminder system.

## Install

1. Back up your CRM database and files using your usual procedure.
2. Sign in as an administrator. Open **Administration > Extensions**.
3. Upload `build/espo-notes-1.0.0.zip` and click **Install**.
4. Configure the roles below. Refresh the agents' browser tabs after installation and role changes.
5. Confirm each agent's **Preferences > Time Zone** before scheduling callbacks.

The package supports `>=9.3.3 <9.4.0` and PHP `>=8.3 <8.6`, matching the target CRM runtime. Compatibility with other EspoCRM release families has not been tested.

The installer adds **Agent Notes** to the navigation tab list. Existing users with a customized tab list may need to add it in Preferences. **Notepad > Full list** also opens it directly.

## Role configuration

Create an Agent role and a Manager role, or add these scope settings to your existing roles. The scope appears as **Agent Notes**.

| Action | Agent | Manager |
| --- | --- | --- |
| Create | Yes | Yes |
| Read | Own | Team |
| Edit | Own | Own |
| Delete | Own, or No if archiving is sufficient | No |
| Stream | No | No |

Give agents their Agent role. Give managers their Manager role and membership in the teams they oversee. Each new entry receives its author's user ID and current CRM teams. Teams are captured at creation; moving an agent to a different team does not move historical notes automatically. Reassignment and manual sharing are disabled.

Managers can create and edit their own notes. They cannot edit, reschedule, archive, or delete another agent's entries. Administrators retain administrative access.

**Check effective access:** EspoCRM merges the user's direct, team, and baseline roles using the most permissive rule. Open each pilot user's **Access** dialog and verify Agent Notes Read/Edit levels. A separate role granting Read All or Team would also grant that visibility. Portal access is disabled. Grant normal read access to Leads, Contacts, Accounts, Opportunities, or Cases only where agents should be able to link those records.

No roles or team memberships are created or changed automatically by this extension.

## Daily use

- Open **Notepad** from any CRM screen. The badge counts your overdue callbacks.
- **Notes**, **Callbacks**, and **History** show your own entries. Use **Full list** for manager review, native search, and filters for agent, teams, status, linked record, or callback dates.
- Enter note text; customer name and phone are optional. The first line becomes the list title.
- Check **Schedule a callback**, choose the time shown in your CRM timezone, and select a popup at the scheduled time or 5, 15, or 60 minutes before. **No reminder** still keeps the callback in the queue.
- **Use current record** links the open Lead, Contact, Account, Opportunity, or Case. **Select** lets you choose a readable CRM record. **Clear link** makes the note standalone.
- Click **Save** or press **Ctrl+Enter**. **Complete** and **Archive** move an entry to History and cancel its pending reminder. **Reschedule** lets you choose a new time, including reopening a completed callback.
- Closing the panel keeps the current draft in memory. Switching entries asks before discarding changes. Reloading or signing out loses unsaved drafts; the browser warns before leaving with unsaved changes. Drafts are not stored offline.
- A failed save keeps the draft. A conflict message means another tab changed that entry: copy any text you need, reopen the entry, then apply your changes to the current version.

## Reminders

Popups appear while EspoCRM is open. The native polling path works without WebSockets; when your CRM has WebSockets configured, its existing popup job delivers through that channel. No extra callback scheduler or external service is installed.

The normal EspoCRM daemon/cron setup remains required for scheduled background jobs, including WebSocket popup submission. Do not change production job configuration merely to install this extension.

New schedules must be in the future. A reminder cannot fall in the past. You can edit the text of an overdue callback, complete it, or reschedule it. The overdue queue has no 24-hour expiry: an open callback remains until you complete/archive it, even if a native popup was missed or dismissed.

Native EspoCRM popups have a configurable lookback window, defaulting to 24 hours. Dismissing a popup does not complete a callback. Completing, archiving, deleting, unscheduling, or changing its time cleans up the corresponding reminder records.

## Upgrade, uninstall, and recovery

Install a newer ZIP over the current installation. Do not uninstall first. The extension's data is stored in the `DovAgentNote` entity/table and remains in the same CRM database backups as other business data.

Uninstall removes the UI/module and outstanding extension reminders, while keeping note records. Reinstalling restores access to those entries and rearms future reminders whose reminder time is still in the future. Past callbacks return in the overdue list. A normal in-place upgrade does not recreate dismissed popups or duplicate existing reminders.

Do not run a hard rebuild as a cleanup step after uninstalling if you intend to restore extension data. Keep your database/file backup for rollback. The extension does not upgrade EspoCRM itself.

## Build and run the disposable test instance

Node.js 22+ and Docker are recommended for the supplied development/test tools. No Node.js service or npm package is required on the production CRM server.

```powershell
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run dev:setup
npm.cmd test
```

`dev:setup` builds the extension, starts an isolated MySQL/EspoCRM 9.3.3 project, installs the ZIP, and enables a local WebSocket test service. It creates only this project's containers and named volumes. It does not use your live CRM.

- CRM: `http://localhost:8093`
- Local administrator: `admin` / `notes-dev-admin`
- WebSocket: `ws://localhost:8094`
- The credentials in `compose.dev.yaml` are disposable development credentials.

`npm.cmd test` creates fresh test users and teams on that instance, exercises the real API and Chromium UI, and tests installation/uninstall/reinstall. It leaves fixtures available for inspection. Screenshots and fixture IDs are written to ignored `test-results/`.

```powershell
npm.cmd run extension       # builds build/espo-notes-1.0.0.zip
npm.cmd run test:integration
npm.cmd run test:browser    # requires fixtures from test:integration and dev:setup
npm.cmd run test:lifecycle
npm.cmd run dev:stop        # stops this project's services, keeps its test volumes
```

Source follows EspoCRM's official `ext-template` layout. `config-default.json` pins the source-development tooling to tag `9.3.3`. Production files are under `src/files/custom/Espo/Modules/EspoNotes` and `src/files/client/custom/modules/espo-notes`; lifecycle scripts are under `src/scripts`. Only the `src` package content, compiled client bundle, and manifest enter the ZIP. Tests and development credentials are excluded.

## API

Standard authenticated EspoCRM CRUD is available at `/api/v1/DovAgentNote`. Writable fields are `description`, `customerName`, `phoneNumber`, `isCallback`, `dateStart`, `reminderMinutes`, `status`, `parentType`, and `parentId`. Callback datetimes use EspoCRM's UTC `YYYY-MM-DD HH:mm:ss` format. `reminderMinutes` accepts `-1`, `0`, `5`, `15`, or `60`; `-1` disables the popup. Status accepts `Open`, `Completed`, or `Archived`.

The server generates `name`, sets `assignedUserId`/`teamsIds`, and controls native reminder payloads. Direct writes to sharing fields are ignored or rejected. Relationship endpoints cannot change note sharing. Send the last returned `versionNumber` in the `X-Version-Number` header on PUT to detect conflicting edits; both the panel and native record screens do this.

Primary filters are `open`, `callbacks`, `overdue`, and `history`. Use EspoCRM's bracketed query parameters for advanced filters, e.g. `where[0][type]=equals&where[0][attribute]=status&where[0][value]=Open`. Permissions apply to lists, details, searches, counts, and parent selection.

## Validation and pilot

See [VALIDATION.md](VALIDATION.md) for the executed checks and remaining production validation. Pilot with two agents and one manager: create notes, link a real record, schedule a callback, confirm actual popup delivery, complete it, and verify the manager can review without editing.

This package does not create Tasks, Calls, Stream posts, attachments, email/SMS alerts, or dialer actions.

The target version is intentionally 9.3.3. Separately review your CRM patch level: the vendor documents an admin-only code-execution vulnerability affecting versions through 9.3.3, patched in 9.3.4: https://github.com/espocrm/espocrm/security/advisories/GHSA-7922-x7cf-j54x.

## Provenance

Scaffold/build tooling: https://github.com/espocrm/ext-template and https://github.com/espocrm/extension-tools. Runtime integration was checked against EspoCRM tag `9.3.3`, commit `2d1b28bb3becd64b2d0d4e016b146ec4e8302f85`.
