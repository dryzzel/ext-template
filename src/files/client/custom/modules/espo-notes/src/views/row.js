import View from 'view';

export default class extends View {
    template = 'espo-notes:callback-row';

    data() { return this.options.notepad.rowData(this.options.row); }

    setup() {
        const notebook = this.options.notepad;
        const row = this.options.row;
        for (const [name, handler] of Object.entries({
            rowSave: () => notebook.saveRow(row.key),
            rowArchive: () => notebook.archiveRow(row.key),
            rowReschedule: () => notebook.rescheduleRow(row.key),
            rowReload: () => notebook.reloadRow(row.key),
            rowRemove: () => notebook.removeDraft(row.key),
            rowSelectParent: () => notebook.selectParent(row.key),
            rowCurrentRecord: () => notebook.useCurrentRecord(row.key),
            rowClearParent: () => notebook.setParent(row.key, null, null, ''),
        })) this.addActionHandler(name, handler);
        this.events = {...this.events,
            'input input, textarea': () => notebook.captureRow(row.key),
            'change input:not([name="done"]), select': e => {
                if (e.target.name === 'parentType') notebook.setParent(row.key, e.target.value, null, '');
                notebook.captureRow(row.key);
            },
            'change [name="done"]': () => notebook.completeRow(row.key),
        };
    }

    afterRender() {
        this.$el.attr('aria-label', this.options.row.draft.name || 'New callback');
        this.updateControls();
    }

    updateControls() {
        const data = this.data();
        this.$el.find('input, textarea, select, button').prop('disabled', !data.canEdit || data.saving);
        this.$el.find('[name="done"]').prop('disabled', !data.canEdit || data.saving || !data.open);
        this.$el.find('.espo-notes-row-state').text(data.saving ? 'Saving…' : data.error ? 'Not saved' : data.dirty ? 'Unsaved' : data.saved ? 'Saved' : '');
        this.$el.find('.espo-notes-row-error').text(data.error || '').toggleClass('hidden', !data.error);
        this.$el.find('.espo-notes-row-parent').text(data.parentLabel);
        this.$el.find('.espo-notes-row-group').text(data.group).toggleClass('text-danger', data.overdue);
    }
}
