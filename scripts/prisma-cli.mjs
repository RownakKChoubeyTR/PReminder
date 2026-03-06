#!/usr/bin/env node

/**
 * Prisma CLI Wrapper — compose DATABASE_URL from individual env vars.
 *
 * Prisma CLI (`prisma migrate`, `prisma db seed`, etc.) requires a
 * `DATABASE_URL` env var matching the `env("DATABASE_URL")` in
 * `schema.prisma`. Rather than storing the full URL (with password)
 * in a config file, this script reads the split credentials
 * (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) from the
 * environment / `.env.local` (or a custom file via `--env-file`),
 * composes the URL at runtime, and forwards the remaining
 * arguments to the Prisma CLI.
 *
 * Usage (called automatically via package.json scripts):
 *   node scripts/prisma-cli.mjs migrate dev
 *   node scripts/prisma-cli.mjs db seed
 *
 * Multi-environment:
 *   node scripts/prisma-cli.mjs --env-file .env.staging migrate deploy
 *   node scripts/prisma-cli.mjs --env-file .env.production migrate deploy
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Parse --env-file flag (must come before prisma args) ────

const rawArgs = process.argv.slice(2);
let envFileOverride = null;
let prismaArgs = rawArgs;

const envFlagIdx = rawArgs.indexOf('--env-file');
if (envFlagIdx !== -1 && rawArgs[envFlagIdx + 1]) {
  envFileOverride = rawArgs[envFlagIdx + 1];
  prismaArgs = [...rawArgs.slice(0, envFlagIdx), ...rawArgs.slice(envFlagIdx + 2)];
}

// ─── Load env file (no dotenv dependency) ────────────────────

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;

  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Only set if not already present in the real environment
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

const projectRoot = resolve(import.meta.dirname, '..');

if (envFileOverride) {
  const envPath = resolve(projectRoot, envFileOverride);
  if (!loadEnvFile(envPath)) {
    console.error(`\x1b[31m[prisma-cli] Env file not found: ${envFileOverride}\x1b[0m`);
    process.exit(1);
  }
  console.log(`\x1b[36m[prisma-cli] Loaded env from: ${envFileOverride}\x1b[0m`);
} else {
  loadEnvFile(resolve(projectRoot, '.env.local'));
}

// ─── Compose DATABASE_URL from parts ─────────────────────────

const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const name = process.env.DB_NAME;

if (!user || !password || !host || !port || !name) {
  console.error(
    '\x1b[31m[prisma-cli] Missing required env vars: DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME\x1b[0m',
  );
  console.error(
    'Set them in .env.local or export them before running Prisma commands.',
  );
  process.exit(1);
}

const schema = process.env.DB_SCHEMA || 'public';
const sslMode = process.env.DB_SSL_MODE;

let databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}?schema=${schema}`;
if (sslMode) {
  databaseUrl += `&sslmode=${sslMode}`;
}

// Inject into env so Prisma reads it via env("DATABASE_URL") in schema.prisma
process.env.DATABASE_URL = databaseUrl;

const masked = databaseUrl.replace(
  /\/\/([^:]+):([^@]+)@/,
  (_, u) => `//${u}:****@`,
);
console.log(`\x1b[36m[prisma-cli] Composed DATABASE_URL: ${masked}\x1b[0m`);

// ─── Forward to Prisma CLI ───────────────────────────────────

const args = prismaArgs.join(' ');
const command = `npx prisma ${args}`;

console.log(`\x1b[36m[prisma-cli] Running: ${command}\x1b[0m\n`);

try {
  execSync(command, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
  });
} catch {
  process.exit(1);
}
