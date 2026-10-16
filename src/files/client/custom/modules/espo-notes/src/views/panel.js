import View from 'view';
import moment from 'moment';
import getState from 'modules/espo-notes/state';
import {emptyDraft, errorText} from 'modules/espo-notes/utils';

const scope = 'DovAgentNote';
const parentTypes = ['Lead', 'Contact', 'Account', 'Opportunity', 'Case'];

export default class extends View {
    template = 'espo-notes:notepad';

    data() {
        return {canCreate: this.getAcl().check(scope, 'create'),
            parentTypes: parentTypes.filter(type => this.getAcl().check(type, 'read'))};
    }

    setup() {
        this.state = getState(this.getUser().id);
        this.state.draft ||= emptyDraft();
        this.entries = [];
        this.search = '';
        this.requestId = 0;
        const actions = {
            close: () => this.closePanel(), new: () => this.startNew(),
            save: () => this.save(), complete: () => this.save('Completed'),
            archive: () => this.save('Archived'), reschedule: () => this.reschedule(),
            selectParent: () => this.selectParent(), currentRecord: () => this.useCurrentRecord(),
            clearParent: () => { this.state.draft.parentId = null; this.state.draft.parentName = ''; this.changed(); this.fillParent(); },
            more: () => this.loadEntries(true),
        };
        for (const [name, handler] of Object.entries(actions)) this.addActionHandler(name, handler);
        this.events = {...this.events,
            'submit form': e => { e.preventDefault(); this.save(); },
            'input .espo-notes-form input, .espo-notes-form textarea': () => this.captureDraft(),
            'change .espo-notes-form input, .espo-notes-form select': e => {
                if (e.target.name === 'parentType') {
                    this.state.draft.parentId = null; this.state.draft.parentName = '';
                }
                this.captureDraft(); this.fillParent();
            },
            'click [data-tab]': e => { this.state.tab = e.currentTarget.dataset.tab; this.loadEntries(); },
            'input #espo-notes-search': e => {
                this.search = e.currentTarget.value;
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => this.loadEntries(), 250);
            },
            'click [data-entry-id]': e => this.editEntry(e.currentTarget.dataset.entryId),
            'click [data-action="fullList"]': () => this.closePanel(true),
            'keydown': e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.save(); }
                if (e.key === 'Escape' && !document.querySelector('.modal.in')) { e.stopPropagation(); this.closePanel(); }
            },
        };
        this.unloadHandler = e => {
            if (!this.state.dirty) return;
            e.preventDefault(); e.returnValue = '';
        };
        window.addEventListener('beforeunload', this.unloadHandler);
        this.focusHandler = event => {
            if (!this.isOpen || this.busy || this.$el[0]?.contains(event.target)) return;
            if (event.target.closest('.modal, .espo-notes-navbar, #popup-notifications-container')) return;
            // A non-modal panel must not cover the user's keyboard focus on the CRM behind it.
            this.closePanel(true, false);
        };
        document.addEventListener('focusin', this.focusHandler);
        this.timer = setInterval(() => { if (this.isOpen) this.loadEntries(); }, 60000);
        this.on('remove', () => {
            clearInterval(this.timer); clearTimeout(this.searchTimer);
            window.removeEventListener('beforeunload', this.unloadHandler);
            document.removeEventListener('focusin', this.focusHandler);
        });
    }

    afterRender() { this.fillForm(); this.loadEntries(); }

    openPanel() {
        this.isOpen = true;
        this.$el.removeClass('hidden');
        this.options.navbar.$el.find('[data-action="toggleNotepad"]').attr('aria-expanded', 'true');
        this.$el.find('[name="description"]').trigger('focus');
        this.loadEntries();
    }

    async closePanel(skipGuard = false, restoreFocus = true) {
        if (this.busy) return;
        if (this.state.dirty && !skipGuard) {
            try {
                await this.confirm({message: 'Close with an unsaved draft? It will stay here until you reload or sign out.',
                    confirmText: 'Keep draft and close', cancelText: 'Keep editing'});
            } catch (e) { return; }
        }
        this.isOpen = false;
        this.$el.addClass('hidden');
        const toggle = this.options.navbar.$el.find('[data-action="toggleNotepad"]').attr('aria-expanded', 'false');
        if (restoreFocus) toggle.trigger('focus');
    }

    async allowReplace() {
        if (this.busy) return false;
        if (!this.state.dirty) return true;
        try {
            await this.confirm({message: 'Discard the unsaved changes to this draft?', confirmText: 'Discard changes'});
            return true;
        } catch (e) { return false; }
    }

    async startNew() {
        if (!await this.allowReplace()) return;
        this.state.draft = emptyDraft(); this.state.original = null; this.state.dirty = false;
        this.fillForm(); this.$el.find('[name="description"]').trigger('focus');
    }

    captureDraft() {
        if (this.busy || !this.canEdit()) return;
        const draft = this.state.draft;
        for (const field of ['description', 'customerName', 'phoneNumber', 'parentType']) {
            draft[field] = this.$el.find(`[name="${field}"]`).val();
        }
        draft.isCallback = this.$el.find('[name="isCallback"]').prop('checked');
        draft.reminderMinutes = Number(this.$el.find('[name="reminderMinutes"]').val());
        const input = this.$el.find('[name="localDate"]').val();
        draft.localDate = input;
        const date = moment.tz(input, 'YYYY-MM-DDTHH:mm', true, this.getDateTime().getTimeZone());
        const valid = input && date.isValid() && date.format('YYYY-MM-DDTHH:mm') === input;
        const unchanged = draft.dateStart && this.getDateTime().toMoment(draft.dateStart).format('YYYY-MM-DDTHH:mm') === input;
        draft.dateStart = draft.isCallback && valid ? (unchanged ? draft.dateStart : date.utc().format('YYYY-MM-DD HH:mm:ss')) : null;
        this.$el.find('.espo-notes-schedule').toggleClass('hidden', !draft.isCallback);
        this.$el.find('[name="localDate"]').prop('required', draft.isCallback);
        this.changed();
    }

    changed() {
        this.state.dirty = true;
        this.$el.find('.espo-notes-save-state').text('Unsaved');
    }

    canEdit() {
        const d = this.state.draft;
        return !d.id ? this.getAcl().check(scope, 'create') :
            (this.getUser().isAdmin() || d.assignedUserId === this.getUser().id) && this.getAcl().check(scope, 'edit');
    }

    fillForm() {
        const draft = this.state.draft;
        for (const name of ['description', 'customerName', 'phoneNumber', 'reminderMinutes', 'parentType']) {
            const value = name === 'parentType' ? draft[name] || this.data().parentTypes[0] : draft[name];
            this.$el.find(`[name="${name}"]`).val(value ?? '');
        }
        this.$el.find('[name="isCallback"]').prop('checked', !!draft.isCallback);
        const local = draft.localDate ?? (draft.dateStart ? this.getDateTime().toMoment(draft.dateStart).format('YYYY-MM-DDTHH:mm') : '');
        this.$el.find('[name="localDate"]').val(local).prop('required', !!draft.isCallback);
        this.$el.find('.espo-notes-zone').text(`(${this.getDateTime().getTimeZone()})`);
        this.$el.find('.espo-notes-schedule').toggleClass('hidden', !draft.isCallback);
        this.$el.find('.espo-notes-editor-title').text(draft.id ? 'Edit entry' : 'New note');
        this.$el.find('.espo-notes-save-state').text(this.state.dirty ? 'Unsaved' : '');
        this.$el.find('.espo-notes-error').addClass('hidden');
        this.$el.find('.espo-notes-form input, .espo-notes-form textarea, .espo-notes-form select, .espo-notes-form button')
            .prop('disabled', !this.canEdit());
        this.$el.find('[data-action="complete"], [data-action="archive"]').toggleClass('hidden', !draft.id || draft.status !== 'Open');
        this.$el.find('[data-action="reschedule"]').toggleClass('hidden', !draft.id || !draft.isCallback);
        this.fillParent();
    }

    fillParent() {
        this.$el.find('.espo-notes-parent-name').text(this.state.draft.parentId ? this.state.draft.parentName : 'No record linked');
    }

    async editEntry(id) {
        if (!await this.allowReplace()) return;
        try {
            const record = await Espo.Ajax.getRequest(`${scope}/${id}`);
            this.state.original = record;
            this.state.draft = {...record}; this.state.dirty = false;
            this.fillForm(); this.$el.find('[name="description"]').trigger('focus');
        } catch (e) { this.showError('Could not open this entry. Refresh the list and try again.'); }
    }

    async loadEntries(append = false) {
        const request = ++this.requestId;
        const tab = this.state.tab;
        this.$el.find('[data-tab]').each((i, button) => {
            const active = button.dataset.tab === tab;
            button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
        });
        const where = [{type: 'equals', attribute: 'assignedUserId', value: this.getUser().id}];
        if (tab !== 'history') where.push({type: tab === 'callbacks' ? 'isTrue' : 'isFalse', attribute: 'isCallback'});
        if (this.search.trim()) where.push({type: 'textFilter', value: this.search.trim()});
        const offset = append ? this.entries.length : 0;
        try {
            const data = await Espo.Ajax.getRequest(scope, {where,
                primaryFilter: tab === 'history' ? 'history' : 'open', maxSize: 30, offset,
                orderBy: tab === 'callbacks' ? 'dateStart' : 'modifiedAt', order: tab === 'callbacks' ? 'asc' : 'desc',
            });
            if (request !== this.requestId) return;
            this.entries = append ? [...this.entries, ...data.list] : data.list;
            this.renderEntries();
            this.$el.find('[data-action="more"]').toggleClass('hidden', data.list.length < 30);
        } catch (e) {
            if (request !== this.requestId) return;
            this.$el.find('.espo-notes-list').text('Could not load entries. Reopen the panel to retry.');
        }
    }

    renderEntries() {
        const list = this.$el.find('.espo-notes-list')[0];
        list.replaceChildren();
        if (!this.entries.length) { list.textContent = 'No entries here yet.'; return; }
        let previousGroup;
        const now = this.getDateTime().getNow();
        const today = this.getDateTime().getToday();
        for (const entry of this.entries) {
            let group;
            if (this.state.tab === 'callbacks') {
                const localDay = this.getDateTime().toMoment(entry.dateStart).format('YYYY-MM-DD');
                group = entry.dateStart < now ? 'Overdue' : localDay === today ? 'Today' : 'Upcoming';
                if (group !== previousGroup) {
                    const heading = document.createElement('h5'); heading.textContent = group; list.append(heading);
                    previousGroup = group;
                }
            }
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'espo-notes-entry'; button.dataset.entryId = entry.id;
            if (group === 'Overdue') button.classList.add('is-overdue');
            const title = document.createElement('span'); title.textContent = entry.name; button.append(title);
            const details = [entry.customerName, entry.phoneNumber,
                entry.dateStart ? this.getDateTime().toDisplay(entry.dateStart) : null,
                entry.status !== 'Open' ? entry.status : null].filter(Boolean);
            if (details.length) { const meta = document.createElement('small'); meta.textContent = details.join(' · '); button.append(meta); }
            list.append(button);
        }
    }

    showError(message) {
        this.$el.find('.espo-notes-error').text(message).removeClass('hidden');
        this.$el.find('.espo-notes-save-state').text('Not saved');
    }

    async save(status) {
        if (this.busy || !this.canEdit()) return;
        this.captureDraft();
        const draft = this.state.draft;
        if (!draft.description.trim()) { this.showError('Enter some note text.'); return; }
        if (draft.isCallback && !draft.dateStart) { this.showError('Choose a valid callback date and time.'); return; }
        const payload = {};
        for (const name of ['description', 'customerName', 'phoneNumber', 'isCallback', 'dateStart', 'reminderMinutes', 'parentType', 'parentId']) {
            payload[name] = draft[name] ?? null;
        }
        payload.status = status || draft.status || 'Open';
        if (!payload.parentId) payload.parentType = null;
        this.busy = true;
        this.$el.find('.espo-notes-form input, .espo-notes-form textarea, .espo-notes-form select, .espo-notes-form button').prop('disabled', true);
        this.$el.find('.espo-notes-save-state').text('Saving…');
        this.$el.find('.espo-notes-error').addClass('hidden');
        try {
            const saved = draft.id ? await Espo.Ajax.putRequest(`${scope}/${draft.id}`, payload, {
                headers: {'X-Version-Number': this.state.original.versionNumber},
            }) : await Espo.Ajax.postRequest(scope, payload);
            this.state.draft = {...saved}; this.state.original = saved; this.state.dirty = false;
            this.fillForm();
            this.$el.find('.espo-notes-save-state').text('Saved');
            this.loadEntries(); this.options.navbar.refreshCount();
        } catch (e) { this.showError(errorText(e)); }
        finally {
            this.busy = false;
            this.$el.find('.espo-notes-form input, .espo-notes-form textarea, .espo-notes-form select, .espo-notes-form button').prop('disabled', !this.canEdit());
        }
    }

    reschedule() {
        if (!this.canEdit() || this.busy) return;
        this.state.draft.isCallback = true; this.state.draft.status = 'Open';
        this.changed(); this.fillForm(); this.$el.find('[name="localDate"]').trigger('focus');
    }

    async selectParent() {
        if (!this.canEdit() || this.busy) return;
        const type = this.$el.find('[name="parentType"]').val();
        if (!parentTypes.includes(type) || !this.getAcl().check(type, 'read')) return;
        const modal = await this.createView('selectParent', 'views/modals/select-records', {
            scope: type, createButton: false,
            onSelect: models => {
                this.state.draft.parentType = type; this.state.draft.parentId = models[0].id;
                this.state.draft.parentName = models[0].get('name'); this.changed(); this.fillParent();
            },
        });
        await modal.render();
    }

    async useCurrentRecord() {
        if (!this.canEdit() || this.busy) return;
        const match = (this.getRouter().getCurrentUrl() || '').match(/^#?([A-Za-z]+)\/view\/([a-zA-Z0-9]+)(?:[/?]|$)/);
        if (!match || !parentTypes.includes(match[1]) || !this.getAcl().check(match[1], 'read')) {
            this.showError('Open a Lead, Contact, Account, Opportunity, or Case first, or choose Select.'); return;
        }
        try {
            const record = await Espo.Ajax.getRequest(`${match[1]}/${match[2]}`);
            Object.assign(this.state.draft, {parentType: match[1], parentId: record.id, parentName: record.name});
            this.$el.find('[name="parentType"]').val(match[1]);
            this.changed(); this.fillParent();
        } catch (e) { this.showError('This record is not available to link.'); }
    }
}
