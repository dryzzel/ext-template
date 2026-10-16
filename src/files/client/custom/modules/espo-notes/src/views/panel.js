import View from 'view';
import moment from 'moment';
import getState from 'modules/espo-notes/state';
import {emptyDraft, errorText} from 'modules/espo-notes/utils';

const scope = 'DovAgentNote';
const parentTypes = ['Lead', 'Contact', 'Account', 'Opportunity', 'Case'];

export default class extends View {
    template = 'espo-notes:notepad';

    data() {
        return {canCreate: this.getAcl().check(scope, 'create'), history: this.state.history,
            timeZone: this.getDateTime().getTimeZone()};
    }

    setup() {
        this.state = getState(this.getUser().id);
        this.rowViews = new Map();
        this.requestId = 0;
        this.search = '';
        this.loaded = 0;
        for (const [name, handler] of Object.entries({
            close: () => this.closePanel(), newCallback: () => this.addRow(),
            saveAll: () => this.saveAll(), refresh: () => this.loadEntries(), more: () => this.loadEntries(true),
        })) this.addActionHandler(name, handler);
        this.events = {...this.events,
            'click [data-action="fullList"]': () => this.closePanel(true),
            'change [name="showHistory"]': e => { this.state.history = e.target.checked; this.loadEntries(); },
            'input #espo-notes-search': e => {
                this.search = e.target.value;
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => this.loadEntries(), 250);
            },
            keydown: e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.saveAll(); }
                if (e.key === 'Escape' && !document.querySelector('.modal.in')) { e.stopPropagation(); this.closePanel(); }
            },
        };
        this.unloadHandler = e => { if (this.state.dirty) { e.preventDefault(); e.returnValue = ''; } };
        this.focusHandler = e => {
            if (!this.isOpen || this.isSaving() || this.$el[0]?.contains(e.target)) return;
            if (e.target.closest('.modal, .espo-notes-navbar, #popup-notifications-container')) return;
            this.closePanel(true, false);
        };
        window.addEventListener('beforeunload', this.unloadHandler);
        document.addEventListener('focusin', this.focusHandler);
        this.clockTimer = setInterval(() => {
            if (this.isOpen) for (const view of this.rowViews.values()) view.updateControls();
        }, 60000);
        this.on('remove', () => {
            clearTimeout(this.searchTimer);
            clearInterval(this.clockTimer);
            window.removeEventListener('beforeunload', this.unloadHandler);
            document.removeEventListener('focusin', this.focusHandler);
        });
    }

    afterRender() { this.loadEntries(); }

    openPanel() {
        this.isOpen = true;
        this.$el.removeClass('hidden');
        this.options.navbar.$el.find('[data-action="toggleNotepad"]').attr('aria-expanded', 'true');
        this.$el.find('[data-action="newCallback"], #espo-notes-search').first().trigger('focus');
        this.loadEntries();
    }

    isSaving() { return this.batchSaving || Object.values(this.state.rows).some(row => row.saving); }

    async closePanel(skipGuard = false, restoreFocus = true) {
        if (this.isSaving()) return;
        if (this.state.dirty && !skipGuard) {
            try {
                await this.confirm({message: 'Close with unsaved callback rows? All drafts will stay here until you reload or sign out.',
                    confirmText: 'Keep drafts and close', cancelText: 'Keep editing'});
            } catch { return; }
        }
        this.isOpen = false;
        this.$el.addClass('hidden');
        const toggle = this.options.navbar.$el.find('[data-action="toggleNotepad"]').attr('aria-expanded', 'false');
        if (restoreFocus) toggle.trigger('focus');
    }

    canEdit(row) {
        return row.draft.id ? (this.getUser().isAdmin() || row.draft.assignedUserId === this.getUser().id) && this.getAcl().check(scope, 'edit') :
            this.getAcl().check(scope, 'create');
    }

    rowData(row) {
        const draft = row.draft;
        const types = parentTypes.filter(type => this.getAcl().check(type, 'read'));
        let group = draft.status !== 'Open' ? draft.status : draft.isCallback ? 'Choose a time' : 'Note';
        if (draft.status === 'Open' && draft.dateStart) {
            const localDay = this.getDateTime().toMoment(draft.dateStart).format('YYYY-MM-DD');
            group = draft.dateStart < this.getDateTime().getNow() ? 'Overdue' : localDay === this.getDateTime().getToday() ? 'Today' : 'Upcoming';
        }
        return {...row, draft: {...draft, parentType: draft.parentType || types[0]},
            existing: !!draft.id, open: draft.status === 'Open', completed: draft.status === 'Completed',
            group, overdue: group === 'Overdue', saving: row.saving || this.batchSaving, canEdit: this.canEdit(row),
            hasDetails: !!(draft.customerName || draft.phoneNumber || draft.parentId), parentTypes: types,
            parentLabel: draft.parentId ? draft.parentName : 'No record linked', reminderOptions: [-1, 0, 5, 15, 60],
            localDate: draft.localDate ?? (draft.dateStart ? this.getDateTime().toMoment(draft.dateStart).format('YYYY-MM-DDTHH:mm') : '')};
    }

    async addRow() {
        if (this.isSaving() || !this.getAcl().check(scope, 'create')) return;
        this.$el.find('.espo-notes-notice').addClass('hidden');
        const key = `new-${++this.state.nextKey}`;
        const row = {key, draft: {...emptyDraft(), isCallback: true}, original: null, dirty: true};
        this.state.rows[key] = row;
        await this.reconcileRows();
        this.updateSummary();
        this.rowViews.get(key)?.$el.find('[name="description"]').trigger('focus');
    }

    captureRow(key) {
        const row = this.state.rows[key];
        const view = this.rowViews.get(key);
        if (!row || !view || row.saving || this.batchSaving || !this.canEdit(row)) return;
        this.$el.find('.espo-notes-notice').addClass('hidden');
        for (const name of ['description', 'customerName', 'phoneNumber', 'parentType']) {
            row.draft[name] = view.$el.find(`[name="${name}"]`).val() || '';
        }
        const input = view.$el.find('[name="localDate"]').val();
        row.draft.localDate = input;
        row.draft.reminderMinutes = Number(view.$el.find('[name="reminderMinutes"]').val());
        const date = moment.tz(input, 'YYYY-MM-DDTHH:mm', true, this.getDateTime().getTimeZone());
        const valid = input && date.isValid() && date.format('YYYY-MM-DDTHH:mm') === input;
        const unchanged = row.draft.dateStart && this.getDateTime().toMoment(row.draft.dateStart).format('YYYY-MM-DDTHH:mm') === input;
        if (input) row.draft.isCallback = true;
        row.draft.dateStart = valid ? (unchanged ? row.draft.dateStart : date.utc().format('YYYY-MM-DD HH:mm:ss')) : null;
        row.dirty = true; row.saved = false; row.error = '';
        view.updateControls();
        this.updateSummary();
    }

    visibleKeys() {
        const keys = [...new Set([...Object.values(this.state.rows).filter(row => !row.draft.id).map(row => row.key),
            ...this.state.serverKeys, ...Object.values(this.state.rows).filter(row => row.dirty).map(row => row.key)])];
        return keys.filter(key => {
            const row = this.state.rows[key];
            return row && (row.dirty || !row.draft.id || this.state.history || row.draft.status === 'Open');
        });
    }

    reconcileRows(forceKey) {
        this.renderQueue = (this.renderQueue || Promise.resolve()).catch(() => {}).then(() => this.renderRows(forceKey));
        return this.renderQueue;
    }

    async renderRows(forceKey) {
        const keys = this.visibleKeys();
        for (const [key] of this.rowViews) {
            if (keys.includes(key)) continue;
            this.clearView(`row-${key}`);
            this.$el.find(`[data-row-key="${key}"]`).remove();
            this.rowViews.delete(key);
        }
        const container = this.$el.find('.espo-notes-rows')[0];
        for (const [index, key] of keys.entries()) {
            const row = this.state.rows[key];
            if (!this.rowViews.has(key)) {
                const element = document.createElement('section');
                element.className = 'espo-notes-row';
                element.dataset.rowKey = key;
                element.setAttribute('aria-label', row.draft.name || 'New callback');
                container.insertBefore(element, container.children[index] || null);
                const view = await this.createView(`row-${key}`, 'espo-notes:views/row', {
                    el: `#espo-notes-panel-root [data-row-key="${key}"]`, row, notepad: this,
                });
                this.rowViews.set(key, view);
                await view.render();
            } else if (forceKey === key || (row.needsRender && !row.dirty && !row.saving && !this.rowViews.get(key).$el[0].contains(document.activeElement))) {
                await this.rowViews.get(key).render();
            }
            row.needsRender = false;
        }
        this.$el.find('.espo-notes-empty').toggleClass('hidden', keys.length > 0).text('No callbacks yet. Add your first row above.');
        this.updateSummary();
    }

    async loadEntries(append = false) {
        if (this.isSaving()) return;
        const request = ++this.requestId;
        const where = [{type: 'equals', attribute: 'assignedUserId', value: this.getUser().id}];
        if (this.search.trim()) where.push({type: 'textFilter', value: this.search.trim()});
        try {
            const data = await Espo.Ajax.getRequest(scope, {where, primaryFilter: this.state.history ? 'all' : 'open',
                maxSize: 50, offset: append ? this.loaded : 0, orderBy: 'dateStart', order: 'asc'});
            if (request !== this.requestId) return;
            const keys = [];
            for (const record of data.list) {
                let row = Object.values(this.state.rows).find(item => item.draft.id === record.id);
                if (!row) {
                    row = {key: record.id, draft: {...record}, original: record, dirty: false};
                    this.state.rows[row.key] = row;
                } else if (!row.dirty && !row.saving && !this.rowViews.get(row.key)?.$el[0].contains(document.activeElement)) {
                    row.draft = {...record}; row.original = record; row.needsRender = true;
                }
                keys.push(row.key);
            }
            this.state.serverKeys = append ? [...new Set([...this.state.serverKeys, ...keys])] : keys;
            this.loaded = (append ? this.loaded : 0) + data.list.length;
            this.$el.find('[data-action="more"]').toggleClass('hidden', this.loaded >= data.total);
            await this.reconcileRows();
        } catch {
            if (request === this.requestId) this.notice('Could not load callbacks. Your drafts are still here. Use Refresh to retry.', true);
        }
    }

    updateSummary() {
        const dirty = Object.values(this.state.rows).filter(row => row.dirty).length;
        this.state.dirty = dirty > 0;
        this.$el.find('.espo-notes-summary').text(`${this.visibleKeys().length} rows · ${dirty} unsaved`);
        this.$el.find('[data-action="saveAll"]').prop('disabled', !dirty || this.isSaving());
        this.$el.find('[data-action="newCallback"], [data-action="refresh"], [data-action="more"], [name="showHistory"], #espo-notes-search').prop('disabled', this.isSaving());
    }

    notice(message, error = false) {
        this.$el.find('.espo-notes-notice').text(message).removeClass('hidden').toggleClass('alert-danger', error).toggleClass('alert-info', !error);
    }

    validate(row) {
        if (!row.draft.description.trim()) return 'Enter callback notes.';
        if (row.draft.isCallback && !row.draft.dateStart) return 'Choose a valid callback date and time.';
        return '';
    }

    async saveRow(key, batch = false) {
        const row = this.state.rows[key];
        if (!row || row.saving || (!batch && this.batchSaving) || !this.canEdit(row)) return false;
        if (!batch) this.captureRow(key);
        row.error = this.validate(row);
        if (row.error) { this.rowViews.get(key)?.updateControls(); return false; }
        const payload = {};
        for (const name of ['description', 'customerName', 'phoneNumber', 'isCallback', 'dateStart', 'reminderMinutes', 'parentType', 'parentId', 'status']) {
            payload[name] = row.draft[name] ?? null;
        }
        if (!payload.parentId) payload.parentType = null;
        row.saving = true;
        this.rowViews.get(key)?.updateControls();
        this.updateSummary();
        try {
            const saved = row.draft.id ? await Espo.Ajax.putRequest(`${scope}/${row.draft.id}`, payload,
                {headers: {'X-Version-Number': row.original.versionNumber}}) : await Espo.Ajax.postRequest(scope, payload);
            row.draft = {...saved}; row.original = saved; row.dirty = false; row.saved = true;
            if (!this.state.serverKeys.includes(key)) this.state.serverKeys.unshift(key);
            return true;
        } catch (error) {
            row.error = errorText(error); row.dirty = true;
            return false;
        } finally {
            row.saving = false;
            await this.reconcileRows(key);
            this.updateSummary();
            if (!batch) this.options.navbar.refreshCount();
        }
    }

    async saveAll() {
        if (this.isSaving()) return;
        const rows = Object.values(this.state.rows).filter(row => row.dirty);
        if (!rows.length) return;
        let invalid = false;
        for (const row of rows) {
            row.error = this.validate(row);
            if (row.error) invalid = true;
            this.rowViews.get(row.key)?.updateControls();
        }
        if (invalid) { this.notice('Fix the highlighted rows. Nothing was saved.', true); return; }
        this.batchSaving = true;
        for (const view of this.rowViews.values()) view.updateControls();
        this.updateSummary();
        let saved = 0;
        try {
            for (const row of rows) if (await this.saveRow(row.key, true)) saved++;
        } finally {
            this.batchSaving = false;
            for (const view of this.rowViews.values()) view.updateControls();
            this.updateSummary(); this.options.navbar.refreshCount();
            this.notice(saved === rows.length ? `Saved ${saved} callback rows.` : `Saved ${saved} of ${rows.length} rows. Unsaved rows keep your changes.`, saved !== rows.length);
        }
    }

    async completeRow(key) {
        const row = this.state.rows[key];
        if (!row || !this.canEdit(row) || this.isSaving()) return;
        this.captureRow(key);
        row.draft.status = 'Completed';
        if (row.draft.id) await this.saveRow(key);
        else { row.dirty = true; this.rowViews.get(key)?.updateControls(); this.updateSummary(); }
    }

    async archiveRow(key) {
        const row = this.state.rows[key];
        if (!row || !this.canEdit(row) || this.isSaving()) return;
        this.captureRow(key); row.draft.status = 'Archived';
        await this.saveRow(key);
    }

    async rescheduleRow(key) {
        const row = this.state.rows[key];
        if (!row || !this.canEdit(row) || this.isSaving()) return;
        this.captureRow(key);
        Object.assign(row.draft, {isCallback: true, status: 'Open', dateStart: null, localDate: ''});
        row.dirty = true; row.error = '';
        await this.reconcileRows(key);
        this.rowViews.get(key)?.$el.find('[name="localDate"]').trigger('focus');
    }

    async removeDraft(key) {
        const row = this.state.rows[key];
        if (!row || row.draft.id || this.isSaving()) return;
        if (row.draft.description.trim()) {
            try { await this.confirm({message: 'Discard this unsaved callback row?', confirmText: 'Discard row'}); } catch { return; }
        }
        delete this.state.rows[key];
        this.$el.find('.espo-notes-notice').addClass('hidden');
        await this.reconcileRows();
    }

    async reloadRow(key) {
        const row = this.state.rows[key];
        if (!row?.draft.id || this.isSaving()) return;
        if (row.dirty) {
            try { await this.confirm({message: 'Reload this callback and discard its unsaved changes? Other rows stay here.', confirmText: 'Reload row'}); }
            catch { return; }
        }
        try {
            const record = await Espo.Ajax.getRequest(`${scope}/${row.draft.id}`);
            row.draft = {...record}; row.original = record; row.dirty = false; row.error = ''; row.saved = false;
            await this.reconcileRows(key);
        } catch { row.error = 'Could not reload this callback. Your draft is still here.'; this.rowViews.get(key)?.updateControls(); }
    }

    setParent(key, type, id, name) {
        const row = this.state.rows[key];
        if (!row || row.saving || this.batchSaving || !this.canEdit(row)) return;
        Object.assign(row.draft, {parentType: type || row.draft.parentType, parentId: id, parentName: name});
        row.dirty = true;
        if (type) this.rowViews.get(key)?.$el.find('[name="parentType"]').val(type);
        this.rowViews.get(key)?.updateControls(); this.updateSummary();
    }

    async selectParent(key) {
        const row = this.state.rows[key];
        if (!row || this.isSaving() || !this.canEdit(row)) return;
        const type = this.rowViews.get(key).$el.find('[name="parentType"]').val();
        if (!parentTypes.includes(type) || !this.getAcl().check(type, 'read')) return;
        const modal = await this.createView('selectParent', 'views/modals/select-records', {
            scope: type, createButton: false,
            onSelect: models => this.setParent(key, type, models[0].id, models[0].get('name')),
        });
        await modal.render();
    }

    async useCurrentRecord(key) {
        const row = this.state.rows[key];
        if (!row || this.isSaving() || !this.canEdit(row)) return;
        const match = (this.getRouter().getCurrentUrl() || '').match(/^#?([A-Za-z]+)\/view\/([a-zA-Z0-9]+)(?:[/?]|$)/);
        if (!match || !parentTypes.includes(match[1]) || !this.getAcl().check(match[1], 'read')) {
            row.error = 'Open a Lead, Contact, Account, Opportunity, or Case first, or choose Select.';
            this.rowViews.get(key)?.updateControls(); return;
        }
        try {
            const record = await Espo.Ajax.getRequest(`${match[1]}/${match[2]}`);
            this.setParent(key, match[1], record.id, record.name);
        } catch { row.error = 'This record is not available to link.'; this.rowViews.get(key)?.updateControls(); }
    }
}
