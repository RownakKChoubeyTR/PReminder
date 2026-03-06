import type { PrismaClient } from '@prisma/client';

import { dbLogger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────
// Database Connection Manager
// ─────────────────────────────────────────────────────────────
// Enterprise-grade connection management:
//
//  1. Credentials are split into individual env vars so passwords
//     never appear in a full connection string inside config files.
//     In production, each var is injected from a secrets manager
//     (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault, etc.).
//
//  2. The full connection URL is composed at runtime — never stored.
//
//  3. Connection attempts use exponential back-off with jitter,
//     following the same pattern as AWS SDK, gRPC, and Kubernetes
//     pod restart policies.
//
//  4. Every attempt is logged to console AND a persistent log file
//     at `<project-root>/logs/db-connection.log`.
// ─────────────────────────────────────────────────────────────

/** Configuration for the retry strategy. */
interface RetryConfig {
  /** Maximum number of connection attempts before giving up. */
  maxRetries: number;
  /** Base delay in ms (doubles each attempt). */
  baseDelayMs: number;
  /** Ceiling for the delay (prevents absurdly long waits). */
  maxDelayMs: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

// ─── URL Composition ─────────────────────────────────────────

/**
 * Compose a PostgreSQL connection URL from individual environment
 * variables. No fallback — credentials must always be split.
 *
 * Env vars consumed:
 *   DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME,
 *   DB_SCHEMA (optional), DB_SSL_MODE (optional)
 *
 * @throws If any required env var (DB_USER, DB_PASSWORD, DB_HOST,
 *         DB_PORT, DB_NAME) is missing.
 */
export function composeDatabaseUrl(): string {
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const name = process.env.DB_NAME;

  if (!user || !password || !host || !port || !name) {
    const missing = [
      !user && 'DB_USER',
      !password && 'DB_PASSWORD',
      !host && 'DB_HOST',
      !port && 'DB_PORT',
      !name && 'DB_NAME',
    ].filter(Boolean);

    throw new Error(
      `[DB] Missing required env vars: ${missing.join(', ')}. ` +
        'Set them in .env.local or inject from your secrets manager.',
    );
  }

  const schema = process.env.DB_SCHEMA ?? 'public';
  const sslMode = process.env.DB_SSL_MODE; // e.g. "require", "prefer", "disable"

  let url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}?schema=${schema}`;

  if (sslMode) {
    url += `&sslmode=${sslMode}`;
  }

  return url;
}

/**
 * Return a safe version of the URL for logging (password masked).
 */
export function maskDatabaseUrl(url: string): string {
  try {
    // postgresql://user:password@host:port/db?params
    return url.replace(/\/\/([^:]+):([^@]+)@/, (_, user: string) => `//${user}:****@`);
  } catch {
    return '(unparseable URL)';
  }
}

// ─── Retry with Exponential Back-off ─────────────────────────

/**
 * Sleep for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential back-off + jitter.
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt) + random jitter
 *
 * Jitter prevents the "thundering herd" problem when many
 * instances restart simultaneously.
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponential = config.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, config.maxDelayMs);
  const jitter = Math.random() * config.baseDelayMs * 0.5;
  return capped + jitter;
}

/**
 * Attempt to connect to the database, retrying with exponential
 * back-off on failure. Every attempt is logged to console and file.
 *
 * @param client  The PrismaClient instance to connect.
 * @param url     The composed URL (used for logging only).
 * @param config  Retry configuration.
 *
 * @throws After exhausting all retries.
 */
export async function connectWithRetry(
  client: PrismaClient,
  url: string,
  config: RetryConfig = DEFAULT_RETRY,
): Promise<void> {
  const masked = maskDatabaseUrl(url);
  dbLogger.separator();
  dbLogger.info(`Connecting to database: ${masked}`);

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      await client.$connect();
      dbLogger.info(`Connected successfully${attempt > 0 ? ` (after ${attempt} retries)` : ''}`);
      dbLogger.separator();
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (attempt < config.maxRetries) {
        const delay = calculateDelay(attempt, config);
        dbLogger.warn(`Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${message}`);
        dbLogger.info(`Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
      } else {
        dbLogger.error(
          `All ${config.maxRetries + 1} connection attempts failed. Last error: ${message}`,
        );
        dbLogger.separator();
        throw new Error(
          `[DB] Unable to connect after ${config.maxRetries + 1} attempts. ` +
            `Last error: ${message}`,
        );
      }
    }
  }
}

// ─── Health Check ────────────────────────────────────────────

/**
 * Execute a lightweight query to verify the database is responsive.
 * Returns true if healthy, false otherwise.
 */
export async function healthCheck(client: PrismaClient): Promise<boolean> {
  try {
    await client.$queryRaw`SELECT 1`;
    dbLogger.debug('Health check passed');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dbLogger.error(`Health check failed: ${message}`);
    return false;
  }
}
