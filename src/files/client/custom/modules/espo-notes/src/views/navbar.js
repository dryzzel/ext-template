import View from 'view';

export default class extends View {
    templateContent = `<a role="button" tabindex="0" data-action="toggleNotepad"
        aria-label="Notepad" aria-expanded="false" aria-controls="espo-notes-panel-root">
        <span class="fas fa-sticky-note icon" aria-hidden="true"></span>
        <span class="espo-notes-nav-label">Notepad</span>
        <span class="badge espo-notes-count hidden" aria-live="polite"></span></a>`;

    setup() {
        this.addActionHandler('toggleNotepad', () => this.togglePanel());
        this.events = {...this.events, 'keydown [data-action="toggleNotepad"]': e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.togglePanel(); }
        }};
        this.timer = setInterval(() => this.refreshCount(), 60000);
        this.listenTo(this.getRouter(), 'route', () => this.refreshCount());
        this.on('remove', () => {
            clearInterval(this.timer);
            document.getElementById('espo-notes-panel-root')?.remove();
        });
    }

    isAvailable() {
        return !this.getUser().isPortal() && this.getAcl().check('DovAgentNote', 'read');
    }

    afterRender() { this.refreshCount(); }

    async refreshCount() {
        try {
            const data = await Espo.Ajax.getRequest('DovAgentNote', {
                maxSize: 1, primaryFilter: 'overdue',
                where: [{type: 'equals', attribute: 'assignedUserId', value: this.getUser().id}],
            });
            const count = data.total;
            this.$el.find('.espo-notes-count').text(count > 99 ? '99+' : count)
                .toggleClass('hidden', !count);
            this.$el.find('[data-action="toggleNotepad"]').attr('aria-label', `Notepad, ${count} overdue callbacks`);
        } catch (e) {
            this.$el.find('.espo-notes-count').addClass('hidden');
        }
    }

    async togglePanel() {
        if (this.opening) return;
        this.opening = true;
        try {
            if (!this.getView('notepad')) {
                const root = document.createElement('aside');
                root.id = 'espo-notes-panel-root';
                root.className = 'espo-notes-panel hidden';
                root.setAttribute('aria-label', 'Agent notepad');
                document.body.append(root);
                const view = await this.createView('notepad', 'espo-notes:views/panel', {
                    el: '#espo-notes-panel-root', navbar: this,
                });
                await view.render();
            }
            const panel = this.getView('notepad');
            if (panel.isOpen) await panel.closePanel();
            else panel.openPanel();
        } finally { this.opening = false; }
    }
}
