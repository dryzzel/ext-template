import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {api, password, future, php, packageFile} from './helpers.mjs';

const fixtures = JSON.parse(fs.readFileSync('test-results/fixtures.json', 'utf8'));
const user = [fixtures.users.agentA.userName, password];
const run = args => execFileSync('docker', ['compose', '-f', 'compose.dev.yaml', 'exec', '-T', '-u', 'www-data', 'crm', 'php', 'command.php', 'extension', ...args], {stdio: 'inherit'});
const install = () => run([`--file=/packages/${packageFile}`]);
if (fs.existsSync('build/espo-notes-1.0.0.zip') && packageFile !== 'espo-notes-1.0.0.zip') {
    run(['-u', '--name=Espo Notes']);
    run(['--file=/packages/espo-notes-1.0.0.zip']);
    const legacy = await api('DovAgentNote', {method: 'POST', user, data: {
        description: 'Callback created on 1.0.0', isCallback: true, dateStart: future(), reminderMinutes: 5,
    }});
    install();
    assert.equal((await api(`DovAgentNote/${legacy.id}`, {user})).description, legacy.description);
    assert.equal(php('reminders', legacy.id).length, 1);
    assert.equal(php('reminders', legacy.id)[0].seconds, 300);
    console.log('PASS real 1.0.0 to current upgrade preserves callbacks and reminders');
}
const note = await api('DovAgentNote', {method: 'POST', user, data: {description: 'Lifecycle preservation', isCallback: true, dateStart: future(), reminderMinutes: 15}});
assert.equal(php('reminders', note.id).length, 1);
install();
assert.equal((await api(`DovAgentNote/${note.id}`, {user})).description, note.description);
assert.equal(php('reminders', note.id).length, 1);
console.log('PASS in-place installation preserves data without duplicating reminders');
run(['-u', '--name=Espo Notes']);
assert.equal(php('all-reminders'), 0);
console.log('PASS uninstall removes all outstanding extension reminders');
install();
assert.equal((await api(`DovAgentNote/${note.id}`, {user})).description, note.description);
const restored = php('reminders', note.id);
assert.equal(restored.length, 1);
assert.equal(restored[0].seconds, 900);
assert.equal(restored[0].userId, fixtures.users.agentA.id);
console.log('PASS reinstall preserves entries and restores future reminders');
