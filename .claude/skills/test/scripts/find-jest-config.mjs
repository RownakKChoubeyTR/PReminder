/**
 * Finds the closest jest.config.js for one or more test file paths.
 *
 * Usage:
 *   node find-jest-config.mjs <test-file-path> [<test-file-path> ...]
 *
 * Paths must be relative to the repository root (e.g., Platform/tests/Jest/Core/SomeModule.test.js).
 * Relative paths are resolved from the repository root, not the current working directory.
 *
 * Output:
 *   JSON mapping each unique jest.config.js path (relative to the repo root) to an array of test files
 *   that belong to it. This allows the caller to run one Jest invocation per config.
 *
 * Example output:
 *   {
 *     "Platform/tests/Jest/Core/jest.config.js": ["Platform/tests/Jest/Core/SomeModule.test.js"],
 *     "Platform/tests/Jest/Indigo/Core/jest.config.js": ["Platform/tests/Jest/Indigo/Core/Button.test.jsx"]
 *   }
 */

 
/* global process, console */

import { existsSync } from 'fs';
import { resolve, dirname, relative, isAbsolute, parse, join } from 'path';

const repoRoot = resolve(import.meta.dirname, '../../../..');

function findClosestJestConfig(testFilePath) {
    const absolutePath = isAbsolute(testFilePath) ? testFilePath : resolve(repoRoot, testFilePath);

    let dir = dirname(absolutePath);
    const root = parse(dir).root;

    while (dir !== root && dir.length >= repoRoot.length) {
        const configPath = join(dir, 'jest.config.js');
        if (existsSync(configPath)) {
            return configPath;
        }
        dir = dirname(dir);
    }

    return null;
}

const testFiles = process.argv.slice(2);

if (testFiles.length === 0) {
    console.error('Usage: node find-jest-config.mjs <test-file> [<test-file> ...]');
    process.exit(1);
}

const groups = {};

for (const testFile of testFiles) {
    const configPath = findClosestJestConfig(testFile);
    if (!configPath) {
        console.error(`WARNING: No jest.config.js found for ${testFile}`);
        continue;
    }
    const relativeConfigPath = relative(repoRoot, configPath).replace(/\\/g, '/');
    const relativeTestFile = relative(repoRoot, resolve(repoRoot, testFile)).replace(/\\/g, '/');

    if (!groups[relativeConfigPath]) {
        groups[relativeConfigPath] = [];
    }
    groups[relativeConfigPath].push(relativeTestFile);
}

console.log(JSON.stringify(groups, null, 2));
