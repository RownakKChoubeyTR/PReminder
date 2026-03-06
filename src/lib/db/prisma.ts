import { PrismaClient } from '@prisma/client';

import { dbLogger } from '@/lib/logger';
import { composeDatabaseUrl, connectWithRetry, maskDatabaseUrl } from './connection';

// ─────────────────────────────────────────────────────────────
// Prisma Client Singleton
// ─────────────────────────────────────────────────────────────
// Enterprise pattern:
//   • Credentials split across individual env vars (DB_USER,
//     DB_PASSWORD, …) — password never stored in a full URL.
//   • Connection URL composed at runtime from those parts.
//   • Automatic retry with exponential back-off on first connect.
//   • All connection events logged to console AND file.
//   • Hot-reload safe (cached on `globalThis` in dev).
//
// @see https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
// ─────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnected: boolean | undefined;
};

/**
 * Compose the database URL at runtime.
 *
 * `datasourceUrl` overrides the URL declared in `schema.prisma`,
 * so Prisma never reads the password from a static config file.
 */
const databaseUrl = composeDatabaseUrl();

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create a new PrismaClient and attach dbLogger listeners.
 *
 * Listeners must be attached on the concrete typed instance
 * (before the `??` coalescion) so TypeScript retains the
 * log-event generics for $on — otherwise the type is widened
 * to `PrismaClient` and $on event names become `never`.
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasourceUrl: databaseUrl,
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });

  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e) => {
      dbLogger.debug(`${e.query}`, { duration: `${e.duration}ms` });
    });
    client.$on('warn', (e) => {
      dbLogger.warn(e.message);
    });
  }
  client.$on('error', (e) => {
    dbLogger.error(e.message);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache in all environments — prevents a new PrismaClient (and a new
// connectWithRetry call) whenever the module is re-evaluated (dev HMR
// full-restart, production module re-import between warm invocations).
globalForPrisma.prisma = prisma;

// ─── Eager Connection with Retry ─────────────────────────────

/**
 * Attempt to connect when the module is first imported.
 *
 * This IIFE logs connection status to both console and file,
 * and retries automatically on transient failures.
 *
 * In Next.js, module-level side effects run once per cold start
 * (or module re-evaluation in dev). The `globalForPrisma.prismaConnected`
 * flag prevents duplicate connection attempts during hot-reload.
 */
if (!globalForPrisma.prismaConnected) {
  connectWithRetry(prisma, databaseUrl)
    .then(() => {
      globalForPrisma.prismaConnected = true;
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      dbLogger.error(`Fatal: ${message}`);
      dbLogger.error(
        `Database is unreachable at ${maskDatabaseUrl(databaseUrl)}. ` +
          'Requests requiring the database will fail until the connection is restored.',
      );
    });
}

// ─── Re-exports for convenience ──────────────────────────────

export { dbLogger } from '@/lib/logger';
export { composeDatabaseUrl, healthCheck } from './connection';
