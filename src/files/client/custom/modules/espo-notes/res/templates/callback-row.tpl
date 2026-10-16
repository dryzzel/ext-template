<div class="espo-notes-row-done">
    <label for="done-{{key}}" class="sr-only">Complete callback: {{draft.name}}</label>
    <input id="done-{{key}}" type="checkbox" name="done" {{#if completed}}checked{{/if}}>
</div>
<div class="espo-notes-row-content">
    <label class="sr-only" for="text-{{key}}">Callback notes</label>
    <textarea id="text-{{key}}" name="description" class="form-control" rows="3" maxlength="30000" placeholder="Who to call and what to discuss" required>{{draft.description}}</textarea>
    {{#if hasDetails}}<div class="espo-notes-row-meta text-muted">{{draft.customerName}} {{draft.phoneNumber}}{{#if draft.parentId}} · {{draft.parentName}}{{/if}}</div>{{/if}}
    <details class="espo-notes-row-details">
        <summary>Customer &amp; CRM link</summary>
        <div class="espo-notes-grid">
            <div><label for="customer-{{key}}">Customer name</label><input id="customer-{{key}}" name="customerName" class="form-control input-sm" value="{{draft.customerName}}" maxlength="255"></div>
            <div><label for="phone-{{key}}">Phone</label><input id="phone-{{key}}" name="phoneNumber" type="tel" class="form-control input-sm" value="{{draft.phoneNumber}}" maxlength="100"></div>
        </div>
        <label for="parent-{{key}}">Related record</label>
        <div class="input-group">
            <select id="parent-{{key}}" name="parentType" class="form-control input-sm">{{options parentTypes draft.parentType category='scopeNames'}}</select>
            <span class="input-group-btn"><button type="button" class="btn btn-default btn-sm" data-action="rowSelectParent">Select</button></span>
        </div>
        <div class="espo-notes-row-parent">{{parentLabel}}</div>
        <button type="button" class="btn btn-default btn-sm" data-action="rowCurrentRecord">Use current record</button>
        <button type="button" class="btn btn-default btn-sm" data-action="rowClearParent">Clear link</button>
    </details>
    <div class="alert alert-danger espo-notes-row-error {{#unless error}}hidden{{/unless}}" role="alert">{{error}}</div>
</div>
<div class="espo-notes-row-schedule">
    <label for="date-{{key}}">Callback time</label>
    <input id="date-{{key}}" name="localDate" type="datetime-local" class="form-control input-sm" value="{{localDate}}">
    <span class="espo-notes-row-group {{#if overdue}}text-danger{{/if}}">{{group}}</span>
</div>
<div class="espo-notes-row-reminder">
    <label for="reminder-{{key}}">Reminder</label>
    <select id="reminder-{{key}}" name="reminderMinutes" class="form-control input-sm">
        {{options reminderOptions draft.reminderMinutes scope='DovAgentNote' field='reminderMinutes'}}
    </select>
</div>
<div class="espo-notes-row-actions">
    <button type="button" class="btn btn-default btn-sm" data-action="rowSave">Save row</button>
    {{#if existing}}
        {{#if error}}<button type="button" class="btn btn-default btn-sm" data-action="rowReload">Reload row</button>{{/if}}
        {{#if open}}<button type="button" class="btn btn-default btn-sm" data-action="rowArchive">Archive</button>{{/if}}
        {{#unless open}}{{#if draft.isCallback}}<button type="button" class="btn btn-default btn-sm" data-action="rowReschedule">Reschedule</button>{{/if}}{{/unless}}
    {{else}}
        <button type="button" class="btn btn-default btn-sm" data-action="rowRemove">Remove row</button>
    {{/if}}
    <span class="espo-notes-row-state" role="status"></span>
</div>
