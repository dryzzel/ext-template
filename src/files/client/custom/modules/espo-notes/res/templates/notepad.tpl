<header class="espo-notes-header">
    <strong>Notepad</strong>
    <div class="espo-notes-header-actions">
        <a href="#DovAgentNote" class="btn btn-default btn-sm" data-action="fullList">Full list</a>
        <button type="button" class="btn btn-default btn-sm" data-action="close" aria-label="Close notepad"><span class="fas fa-times" aria-hidden="true"></span></button>
    </div>
</header>
<div class="espo-notes-body">
    <div class="espo-notes-toolbar">
        <div class="btn-group" role="group" aria-label="Entry category">
            <button type="button" class="btn btn-default btn-sm" data-tab="notes">Notes</button>
            <button type="button" class="btn btn-default btn-sm" data-tab="callbacks">Callbacks</button>
            <button type="button" class="btn btn-default btn-sm" data-tab="history">History</button>
        </div>
        {{#if canCreate}}<button type="button" class="btn btn-primary btn-sm" data-action="new">New note</button>{{/if}}
    </div>
    <label for="espo-notes-search" class="sr-only">Search your entries</label>
    <input id="espo-notes-search" class="form-control input-sm" type="search" placeholder="Search your entries">
    <div class="espo-notes-list" aria-live="polite"></div>
    <button type="button" class="btn btn-default btn-sm hidden" data-action="more">Load more</button>
    <form class="espo-notes-form" novalidate>
        <div class="espo-notes-editor-heading"><strong class="espo-notes-editor-title">New note</strong><span class="espo-notes-save-state" role="status"></span></div>
        <div class="alert alert-danger espo-notes-error hidden" role="alert"></div>
        <label for="espo-notes-text">Note <span aria-hidden="true">*</span></label>
        <textarea id="espo-notes-text" name="description" class="form-control" rows="5" required maxlength="30000"></textarea>
        <div class="espo-notes-grid">
            <div><label for="espo-notes-customer">Customer name</label><input id="espo-notes-customer" name="customerName" class="form-control" maxlength="255"></div>
            <div><label for="espo-notes-phone">Phone</label><input id="espo-notes-phone" name="phoneNumber" class="form-control" type="tel" maxlength="100"></div>
        </div>
        <label class="espo-notes-checkbox"><input type="checkbox" name="isCallback"> Schedule a callback</label>
        <div class="espo-notes-schedule hidden">
            <label for="espo-notes-date">Callback time <span class="espo-notes-zone"></span></label>
            <input id="espo-notes-date" name="localDate" type="datetime-local" class="form-control">
            <label for="espo-notes-reminder">Remind me</label>
            <select id="espo-notes-reminder" name="reminderMinutes" class="form-control">
                <option value="0">At callback time</option><option value="5">5 minutes before</option>
                <option value="15">15 minutes before</option><option value="60">60 minutes before</option><option value="-1">No reminder</option>
            </select>
        </div>
        <div class="espo-notes-related">
            <label for="espo-notes-type">Related record (optional)</label>
            <div class="input-group">
                <select id="espo-notes-type" name="parentType" class="form-control" aria-label="Related record type">
                    {{#each parentTypes}}<option value="{{this}}">{{translate this category='scopeNames'}}</option>{{/each}}
                </select>
                <span class="input-group-btn"><button type="button" class="btn btn-default" data-action="selectParent">Select</button></span>
            </div>
            <div class="espo-notes-parent-name"></div>
            <button type="button" class="btn btn-default btn-sm" data-action="currentRecord">Use current record</button>
            <button type="button" class="btn btn-default btn-sm" data-action="clearParent">Clear link</button>
        </div>
        <div class="espo-notes-editor-actions">
            <button type="submit" class="btn btn-primary" data-action="save">Save</button>
            <button type="button" class="btn btn-default" data-action="complete">Complete</button>
            <button type="button" class="btn btn-default" data-action="archive">Archive</button>
            <button type="button" class="btn btn-default" data-action="reschedule">Reschedule</button>
        </div>
        <small class="text-muted">Ctrl+Enter to save. Drafts stay here until you reload or sign out.</small>
    </form>
</div>
