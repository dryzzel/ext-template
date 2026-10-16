// Memory only: drafts never enter localStorage or another user's session.
const sessions = new Map();

export default function getState(userId) {
    for (const key of sessions.keys()) {
        if (key !== userId) sessions.delete(key);
    }
    if (!sessions.has(userId)) {
        sessions.set(userId, {draft: null, original: null, dirty: false, tab: 'notes'});
    }
    return sessions.get(userId);
}
