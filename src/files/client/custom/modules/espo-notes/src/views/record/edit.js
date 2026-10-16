import Edit from 'views/record/edit';

export default class extends Edit {
    setup() {
        if (!this.model.isNew() && !this.getUser().isAdmin() && this.model.get('assignedUserId') !== this.getUser().id) {
            this.readOnly = true;
        }
        super.setup();
    }
}
