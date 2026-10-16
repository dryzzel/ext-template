import {execFileSync} from 'node:child_process';
import path from 'node:path';
execFileSync('docker', ['run', '--rm', '--entrypoint', 'php', '--mount',
    `type=bind,source=${path.resolve('.')},target=/source,readonly`, 'espocrm/espocrm:9.3.3', '/source/tests/runtime/lint.php'], {stdio: 'inherit'});
