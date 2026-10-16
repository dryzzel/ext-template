import {execFileSync} from 'node:child_process';
import {api, php} from './helpers.mjs';

const run = (command, args) => execFileSync(command, args, {stdio: 'inherit'});
run('docker', ['compose', '-f', 'compose.dev.yaml', 'up', '-d', 'crm']);
let ready = false;
for (let i = 0; i < 90; i++) {
    try { await api('App/user'); ready = true; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 2000));
}
if (!ready) throw new Error('CRM did not become ready. Inspect docker compose logs.');
run(process.execPath, ['build.js', '--extension']);
run('docker', ['compose', '-f', 'compose.dev.yaml', 'exec', '-T', '-u', 'www-data', 'crm', 'php', 'command.php', 'extension', '--file=/packages/espo-notes-1.0.0.zip']);
php('websocket-on');
run('docker', ['compose', '-f', 'compose.dev.yaml', '--profile', 'websocket', 'up', '-d', 'websocket']);
console.log('Disposable EspoCRM 9.3.3 ready at http://localhost:8093 (admin / notes-dev-admin).');
