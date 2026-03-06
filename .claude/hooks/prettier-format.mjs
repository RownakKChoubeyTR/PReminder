import { execSync } from 'child_process';

/* global process */

let data = '';
process.stdin.on('data', chunk => {
    data += chunk;
});
process.stdin.on('end', () => {
    try {
        const filePath = JSON.parse(data).tool_input.file_path;
        if (filePath) {
            execSync(`npx prettier --write ${JSON.stringify(filePath)}`, { stdio: 'pipe' });
        }
    } catch {
        // fail silently — don't block the edit
    }
});
