<header class="espo-notes-header">
    <div><strong>My callback notepad</strong><div class="text-muted espo-notes-subtitle">All your callbacks on one page</div></div>
    <div class="espo-notes-header-actions">
        <a href="#DovAgentNote" class="btn btn-default btn-sm" data-action="fullList">Team review</a>
        <button type="button" class="btn btn-default btn-sm" data-action="close" aria-label="Close notepad"><span class="fas fa-times" aria-hidden="true"></span></button>
    </div>
</header>
<div class="espo-notes-toolbar">
    {{#if canCreate}}<button type="button" class="btn btn-primary btn-sm" data-action="newCallback"><span class="fas fa-plus" aria-hidden="true"></span> Add callback</button>{{/if}}
    <label for="espo-notes-search" class="sr-only">Search your callbacks</label>
    <input id="espo-notes-search" class="form-control input-sm" type="search" placeholder="Search your callbacks">
    <label class="espo-notes-history"><input type="checkbox" name="showHistory" {{#if history}}checked{{/if}}> Show history</label>
    <button type="button" class="btn btn-default btn-sm" data-action="refresh">Refresh</button>
</div>
<div class="espo-notes-zone text-muted">Times shown in {{timeZone}}. Each row keeps its own reminder.</div>
<div class="alert alert-info espo-notes-notice hidden" role="status"></div>
<div class="espo-notes-column-headings" aria-hidden="true"><span>Done</span><span>Callback notes</span><span>Date &amp; time</span><span>Reminder</span><span>Actions</span></div>
<div class="espo-notes-body">
    <div class="espo-notes-rows" aria-label="Callback rows"></div>
    <p class="espo-notes-empty text-muted">Loading your callbacks...</p>
    <button type="button" class="btn btn-default btn-sm hidden" data-action="more">Load more</button>
</div>
<footer class="espo-notes-footer">
    <div><span class="espo-notes-summary" aria-live="polite"></span><div class="text-muted">Ctrl+Enter saves all changes. Unsaved rows stay here until you reload or sign out.</div></div>
    <button type="button" class="btn btn-primary" data-action="saveAll">Save changes</button>
</footer>
