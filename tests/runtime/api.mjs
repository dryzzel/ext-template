import assert from 'node:assert/strict';
import {api, fixtures, password, future, utc, php, base, queryString} from './helpers.mjs';

const f = await fixtures();
const user = name => [f.users[name].userName, password];
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); console.log('PASS', message); checks++; };
const note = await api('DovAgentNote', {method: 'POST', user: user('agentA'), data: {
    description: '  Call customer about renewal\nBring account notes.  ', customerName: 'Alex', phoneNumber: '+1 555 0100',
}});
check(note.name === 'Call customer about renewal', 'title derives from trimmed first line');
check(note.assignedUserId === f.users.agentA.id && note.teamsIds.includes(f.team.id), 'server assigns owner and teams');
check((await api(`DovAgentNote/${note.id}`, {user: user('agentA')})).description.includes('Bring account'), 'note survives reload');
await api(`DovAgentNote/${note.id}`, {user: user('agentB'), status: 403}); checks++;
await api(`DovAgentNote/${note.id}`, {user: user('outsider'), status: 403}); checks++;
check((await api(`DovAgentNote/${note.id}`, {user: user('manager')})).id === note.id, 'team manager can review');
await api(`DovAgentNote/${note.id}`, {method: 'PUT', user: user('manager'), data: {description: 'unauthorized edit'}, status: 403}); checks++;
const mine = await api('DovAgentNote', {user: user('agentB')});
check(!mine.list.some(row => row.id === note.id) && mine.total === 0, 'list and total enforce own visibility');
const outside = await api('DovAgentNote', {user: user('outsider')});
check(outside.total === 0, 'unrelated manager cannot list team notes');
const share = await api(`DovAgentNote/${note.id}`, {method: 'PUT', user: user('agentA'), data: {
    assignedUserId: f.users.agentB.id, teamsIds: [f.otherTeam.id],
}});
check(share.assignedUserId === f.users.agentA.id && share.teamsIds.includes(f.team.id) && !share.teamsIds.includes(f.otherTeam.id), 'ownership fields cannot be changed');
await api(`DovAgentNote/${note.id}/teams`, {method: 'POST', user: user('agentA'), data: {id: f.otherTeam.id}, status: 403}); checks++;
await api('DovAgentNote', {method: 'POST', user: user('agentA'), data: {description: '  '}, status: 400}); checks++;
await api('DovAgentNote', {method: 'POST', user: user('agentA'), data: {description: 'missing time', isCallback: true}, status: 400}); checks++;
await api('DovAgentNote', {method: 'POST', user: user('agentA'), data: {description: 'past time', isCallback: true, dateStart: '2020-01-01 00:00:00'}, status: 400}); checks++;
await api('DovAgentNote', {method: 'POST', user: user('agentA'), data: {description: 'past reminder', isCallback: true, dateStart: future(3), reminderMinutes: 5}, status: 400}); checks++;
const callback = await api('DovAgentNote', {method: 'POST', user: user('agentA'), data: {
    description: 'Callback QA', isCallback: true, dateStart: future(), reminderMinutes: 5,
    reminders: [{type: 'Email', seconds: 0}],
}});
let reminders = php('reminders', callback.id);
check(reminders.length === 1 && reminders[0].type === 'Popup' && reminders[0].seconds === 300 && reminders[0].userId === f.users.agentA.id,
    'native reminder created only as Popup for the agent');
const moved = await api(`DovAgentNote/${callback.id}`, {method: 'PUT', user: user('agentA'), data: {dateStart: future(120)}});
reminders = php('reminders', callback.id);
check(reminders.length === 1 && reminders[0].startAt === moved.dateStart, 'reschedule replaces old reminder');
const adminMoved = await api(`DovAgentNote/${callback.id}`, {method: 'PUT', data: {dateStart: future(150)}});
reminders = php('reminders', callback.id);
check(reminders.length === 1 && reminders[0].seconds === 300 && reminders[0].userId === f.users.agentA.id && reminders[0].startAt === adminMoved.dateStart,
    'administrator reschedule preserves agent reminder choice');
await api(`DovAgentNote/${callback.id}`, {method: 'PUT', user: user('agentA'), data: {description: 'Callback QA updated'}, headers: {'X-Version-Number': String(callback.versionNumber)}, status: 409}); checks++;
const completed = await api(`DovAgentNote/${callback.id}`, {method: 'PUT', user: user('agentA'), data: {status: 'Completed'}});
check(php('reminders', callback.id).length === 0, 'completion clears native reminders');
await api(`DovAgentNote/${callback.id}`, {method: 'PUT', user: user('agentA'), data: {status: 'Open'}});
check(php('reminders', callback.id).length === 1, 'reopening restores future popup');
await api(`DovAgentNote/${callback.id}`, {method: 'PUT', user: user('agentA'), data: {status: 'Archived'}});
check(php('reminders', callback.id).length === 0, 'archive clears native reminders');
await api(`DovAgentNote/${callback.id}`, {method: 'PUT', user: user('agentA'), data: {status: 'Open', isCallback: false}});
check(php('reminders', callback.id).length === 0, 'removing callback clears time and reminder');
await api(`DovAgentNote/${callback.id}`, {method: 'PUT', user: user('agentA'), data: {isCallback: true, dateStart: future()}});
php('age', callback.id);
const overdueQuery = new URLSearchParams({primaryFilter: 'overdue'});
check((await api('DovAgentNote?' + overdueQuery, {user: user('agentA')})).list.some(row => row.id === callback.id), 'overdue list keeps callbacks older than 24 hours');
await api(`DovAgentNote/${callback.id}`, {method: 'PUT', user: user('agentA'), data: {description: 'Overdue content edit'}});
check((await api(`DovAgentNote/${callback.id}`, {user: user('agentA')})).description === 'Overdue content edit', 'overdue text edits do not require a new time');
const leadA = await api('Lead', {method: 'POST', user: user('agentA'), data: {lastName: 'Agent A lead'}});
const leadB = await api('Lead', {method: 'POST', user: user('agentB'), data: {lastName: 'Agent B lead'}});
await api(`DovAgentNote/${note.id}`, {method: 'PUT', user: user('agentA'), data: {parentType: 'Lead', parentId: leadB.id}, status: 403}); checks++;
check((await api(`DovAgentNote/${note.id}`, {method: 'PUT', user: user('agentA'), data: {parentType: 'Lead', parentId: leadA.id}})).parentId === leadA.id,
    'optional parent links respect parent ACL');
const popup = await api('DovAgentNote', {method: 'POST', user: user('agentA'), data: {
    description: 'Actual timed popup', isCallback: true, dateStart: utc(new Date(Date.now() + 4000)), reminderMinutes: 0,
}});
await new Promise(resolve => setTimeout(resolve, 5000));
const delivered = await api('PopupNotification/action/grouped', {user: user('agentA')});
check(delivered.event.some(item => item.data.id === popup.id && item.data.dateField === 'dateStart'), 'real native popup polling delivers scheduled custom record');
await api(`DovAgentNote/${popup.id}`, {method: 'DELETE', user: user('agentA')});
check(php('reminders', popup.id).length === 0, 'deletion cleans reminders');
const search = queryString({where: [{type: 'textFilter', value: 'renewal'}]});
check((await api('DovAgentNote?' + search, {user: user('agentA')})).list.some(row => row.id === note.id), 'text search works');
check((await api('DovAgentNote?' + queryString({where: [{type: 'textFilter', value: 'no-such-note-unique'}]}), {user: user('agentA')})).total === 0,
    'search excludes nonmatching entries');
check((await api('DovAgentNote?' + queryString({where: [{type: 'equals', attribute: 'assignedUserId', value: f.users.agentA.id}]}), {user: user('agentB')})).total === 0,
    'explicit owner filter cannot bypass ACL');
console.log(`API integration: ${checks} assertions passed on ${base}.`);
