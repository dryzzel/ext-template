import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

export const base = 'http://localhost:8093';
export const admin = ['admin', 'notes-dev-admin'];
export const password = 'notes-test-password';
export const stamp = Date.now().toString(36);
export const utc = date => date.toISOString().slice(0, 19).replace('T', ' ');
export const future = (minutes = 90) => utc(new Date(Date.now() + minutes * 60000));
export const artifacts = 'test-results';
export const packageFile = `espo-notes-${JSON.parse(fs.readFileSync('package.json', 'utf8')).version}.zip`;
fs.mkdirSync(artifacts, {recursive: true});

export function queryString(parameters) {
    const query = new URLSearchParams();
    const append = (key, value) => {
        if (value !== null && typeof value === 'object') {
            for (const [child, item] of Object.entries(value)) append(`${key}[${child}]`, item);
        } else query.append(key, String(value ?? ''));
    };
    for (const [key, value] of Object.entries(parameters)) append(key, value);
    return query.toString();
}

export async function api(path, {method = 'GET', data, user = admin, status = 200, headers = {}} = {}) {
    const url = new URL('/api/v1/' + path, base);
    const response = await fetch(url, {method,
        headers: {Authorization: 'Basic ' + Buffer.from(user.join(':')).toString('base64'), 'Content-Type': 'application/json', ...headers},
        body: data === undefined ? undefined : JSON.stringify(data),
    });
    const text = await response.text();
    assert.equal(response.status, status, `${method} ${path}: ${text} (${response.headers.get('x-status-reason')})`);
    try { return JSON.parse(text); } catch { return text; }
}

export function php(command, id = '') {
    return JSON.parse(execFileSync('docker', ['compose', '-f', 'compose.dev.yaml', 'exec', '-T', '-u', 'www-data', 'crm',
        'php', '/tests/inspect.php', command, id], {encoding: 'utf8'}).trim());
}

export async function fixtures() {
    const team = await api('Team', {method: 'POST', data: {name: 'Notes QA ' + stamp}});
    const otherTeam = await api('Team', {method: 'POST', data: {name: 'Other QA ' + stamp}});
    const agentRole = await api('Role', {method: 'POST', data: {name: 'Notes Agent ' + stamp, assignmentPermission: 'no', data: {
        DovAgentNote: {create: 'yes', read: 'own', edit: 'own', delete: 'own', stream: 'no'},
        Lead: {create: 'yes', read: 'own', edit: 'own', delete: 'no', stream: 'no'},
    }}});
    const managerRole = await api('Role', {method: 'POST', data: {name: 'Notes Manager ' + stamp, data: {
        DovAgentNote: {create: 'yes', read: 'team', edit: 'own', delete: 'no', stream: 'no'},
        User: {create: 'no', read: 'team', edit: 'no', delete: 'no', stream: 'no'},
        Team: {create: 'no', read: 'team', edit: 'no', delete: 'no', stream: 'no'},
    }}});
    const users = {};
    for (const [key, role, teamId] of [['agentA', agentRole, team.id], ['agentB', agentRole, team.id],
        ['manager', managerRole, team.id], ['outsider', managerRole, otherTeam.id]]) {
        users[key] = await api('User', {method: 'POST', data: {userName: `notes_${key}_${stamp}`.toLowerCase(),
            lastName: key, type: 'regular', isActive: true, password, passwordConfirm: password,
            rolesIds: [role.id], teamsIds: [teamId], defaultTeamId: teamId, sendAccessInfo: false}});
    }
    const result = {team, otherTeam, users};
    fs.writeFileSync(`${artifacts}/fixtures.json`, JSON.stringify(result, null, 2));
    return result;
}
