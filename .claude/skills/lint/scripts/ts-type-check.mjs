#!/usr/bin/env node

/**
 * Run TypeScript type checking on specific files.
 * Reuses the core ts-type-check logic without Grunt.
 *
 * Usage: node .claude/skills/lint/scripts/ts-type-check.mjs <files-or-globs...>
 *
 * - .jsx files: checked with checkJs:true using root tsconfig.json
 * - .ts files: checked using the nearest tsconfig.json (walking up from the file)
 */

 
/* global process, console */

import path, { resolve } from 'path';
import fs from 'fs';
import { globbySync } from 'globby';
import { check, formatDiagnostics } from '../../../../tasks/ts-type-check/index.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

const args = process.argv.slice(2);

if (!args.length) {
    console.error('Usage: node .claude/skills/lint/scripts/ts-type-check.mjs <files-or-globs...>');
    process.exit(1);
}

const matched = globbySync(args, { cwd: repoRoot });
const jsxFiles = matched.filter(f => f.endsWith('.jsx'));
const tsFiles = matched.filter(f => f.endsWith('.ts'));

if (!jsxFiles.length && !tsFiles.length) {
    console.log('No .jsx or .ts files matched.');
    process.exit(0);
}

let hasErrors = false;

if (jsxFiles.length) {
    const { diagnostics, fileCount } = check({ tsconfig: 'tsconfig.json', checkJs: true, files: jsxFiles });
    console.log(`JSX files to check: ${fileCount}`);
    formatDiagnostics(diagnostics);
    if (diagnostics.length) hasErrors = true;
}

if (tsFiles.length) {
    const groups = new Map();

    for (const file of tsFiles) {
        const tsconfig = findNearestTsconfig(file);

        if (!tsconfig) {
            console.error(`No tsconfig.json found for ${file}`);
            continue;
        }

        if (!groups.has(tsconfig)) groups.set(tsconfig, []);
        groups.get(tsconfig).push(file);
    }

    for (const [tsconfig, groupFiles] of groups) {
        const { diagnostics, fileCount } = check({ tsconfig, checkJs: false, files: groupFiles });
        console.log(`TS files to check (${tsconfig}): ${fileCount}`);
        formatDiagnostics(diagnostics);
        if (diagnostics.length) hasErrors = true;
    }
}

process.exit(hasErrors ? 1 : 0);

function findNearestTsconfig(filePath) {
    let dir = path.dirname(path.resolve(filePath));
    const root = path.resolve(repoRoot);

    while (dir.length >= root.length) {
        const candidate = path.join(dir, 'tsconfig.json');

        if (dir !== root && fs.existsSync(candidate)) {
            return candidate;
        }

        const parent = path.dirname(dir);

        if (parent === dir) break;
        dir = parent;
    }

    return null;
}
