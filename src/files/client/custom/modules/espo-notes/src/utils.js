export function emptyDraft() {
    return {description: '', customerName: '', phoneNumber: '', isCallback: false,
        dateStart: null, reminderMinutes: 0, status: 'Open', parentType: 'Lead', parentId: null, parentName: ''};
}

export function errorText(error) {
    if (error.status === 409) return 'This row changed in another tab. Copy any changes you need, then use Reload row. Other drafts stay here.';
    if (error.status === 403) return 'You do not have permission to change this entry.';
    if (error.status === 0) return 'Connection lost. Your draft is still here. Check your connection before retrying.';
    let message;
    try { message = JSON.parse(error.responseText || '{}').message; } catch (e) { /* Non-JSON proxy response. */ }
    const header = error.getResponseHeader && error.getResponseHeader('X-Status-Reason');
    return message || header || 'Could not save. Your draft is still here; check the fields and try again.';
}
