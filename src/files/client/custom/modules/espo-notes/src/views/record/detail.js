import Detail from 'views/record/detail';

export default class extends Detail {
    setup() {
        if (!this.getUser().isAdmin() && this.model.get('assignedUserId') !== this.getUser().id) {
            this.readOnly = true;
        }
        super.setup();
    }
}
