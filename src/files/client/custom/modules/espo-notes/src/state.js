// Memory only: drafts never enter localStorage or another user's session.
const sessions = new Map();

export default function getState(userId) {
    for (const key of sessions.keys()) {
        if (key !== userId) sessions.delete(key);
    }
    if (!sessions.has(userId)) {
        sessions.set(userId, {rows: {}, serverKeys: [], nextKey: 0, history: false, dirty: false});
    }
    return sessions.get(userId);
}
