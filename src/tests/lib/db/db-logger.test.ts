// @vitest-environment node
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

//
// Tests: dbLogger (src/lib/logger.ts)
//
// STRATEGY: vi.mock('node:fs') only intercepts ESM imports, NOT require()
// calls made inside imported modules. Since logger.ts uses require('node:fs')
// internally (for Edge compatibility), we use an integration approach:
// let the logger write to the real filesystem and verify content using
// unique timestamp-keyed messages.
//
// // @vitest-environment node ensures IS_SERVER=true (typeof window ===
// 'undefined'), which is required for file writing to be enabled.
//

const LOGS_DIR = join(process.cwd(), 'logs');
const DB_LOG_PATH = join(LOGS_DIR, 'dbLog.txt');

interface LogEntry {
  ts: string;
  level: string;
  ctx: string;
  msg: string;
  data?: Record<string, unknown>;
  err?: string;
}

/** Find lines in the log file that contain a given marker string. */
function findLogLines(marker: string): LogEntry[] {
  if (!existsSync(DB_LOG_PATH)) return [];
  return readFileSync(DB_LOG_PATH, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && l.includes(marker))
    .map((l) => JSON.parse(l) as LogEntry);
}

// Top-level import: NODE_ENV='test'  IS_DEV=false (used for non-dev tests)
import { dbLogger } from '@/lib/logger';

const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

beforeEach(() => {
  infoSpy.mockClear();
  warnSpy.mockClear();
  errorSpy.mockClear();
  debugSpy.mockClear();
  logSpy.mockClear();
});

afterAll(() => {
  // Clean up the log file written during integration tests
  if (existsSync(DB_LOG_PATH)) {
    try {
      unlinkSync(DB_LOG_PATH);
    } catch {
      /* ignore */
    }
  }
});

describe('dbLogger', () => {
  describe('file output (dev only)', () => {
    // Each test in this block needs IS_DEV=true.
    // We re-import the logger fresh after stubbing NODE_ENV='development'.
    type DbLoggerType = typeof dbLogger;
    let devLogger: DbLoggerType;

    beforeEach(async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.resetModules();
      const mod = await import('@/lib/logger');
      devLogger = mod.dbLogger;
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('info writes JSON line to dbLog.txt in development', () => {
      const marker = `db-info-${Date.now()}`;
      devLogger.info(marker);

      const lines = findLogLines(marker);
      expect(lines).toHaveLength(1);
      expect(lines[0]!.level).toBe('INFO');
      expect(lines[0]!.ctx).toBe('db');
      expect(lines[0]!.msg).toBe(marker);
    });

    it('warn writes JSON line with correct level', () => {
      const marker = `db-warn-${Date.now()}`;
      devLogger.warn(marker);

      const lines = findLogLines(marker);
      expect(lines).toHaveLength(1);
      expect(lines[0]!.level).toBe('WARN');
      expect(lines[0]!.ctx).toBe('db');
      expect(lines[0]!.msg).toBe(marker);
    });

    it('error writes JSON line with err field when Error is passed', () => {
      const marker = `db-error-${Date.now()}`;
      devLogger.error(marker, new Error('ECONNREFUSED'));

      const lines = findLogLines(marker);
      expect(lines).toHaveLength(1);
      expect(lines[0]!.level).toBe('ERROR');
      expect(lines[0]!.ctx).toBe('db');
      expect(lines[0]!.err).toBe('ECONNREFUSED');
    });

    it('debug writes JSON line in development', () => {
      const marker = `db-debug-${Date.now()}`;
      devLogger.debug(marker, { table: 'User' });

      const lines = findLogLines(marker);
      expect(lines).toHaveLength(1);
      expect(lines[0]!.level).toBe('DEBUG');
      expect(lines[0]!.data).toEqual({ table: 'User' });
    });

    it('does not write to file outside development', () => {
      // top-level dbLogger has IS_DEV=false (loaded with NODE_ENV='test')
      vi.unstubAllEnvs();
      vi.stubEnv('NODE_ENV', 'production');

      const marker = `db-no-write-${Date.now()}`;
      dbLogger.info(marker);
      dbLogger.warn(marker);
      dbLogger.error(marker);

      expect(findLogLines(marker)).toHaveLength(0);
    });

    it('creates the log file in the logs directory', async () => {
      // Remove the log file so the logger must write a fresh one.
      // mkdirSync({ recursive: true }) is used internally and must not throw
      // even when the directory already exists.
      if (existsSync(DB_LOG_PATH)) unlinkSync(DB_LOG_PATH);

      // Fresh module so the _writeFileLine cache is reset
      vi.resetModules();
      const mod = await import('@/lib/logger');
      const freshLogger = mod.dbLogger;

      const marker = `db-file-create-${Date.now()}`;
      freshLogger.info(marker);

      expect(existsSync(DB_LOG_PATH)).toBe(true);
      const lines = findLogLines(marker);
      expect(lines).toHaveLength(1);
    });

    it('does not throw when file write fails', () => {
      // Logger wraps writeToFile in try/catch  ensure no propagation
      const marker = `db-nothrow-${Date.now()}`;
      expect(() => devLogger.info(marker)).not.toThrow();
    });
  });

  describe('separator()', () => {
    it('does not write to file', () => {
      vi.stubEnv('NODE_ENV', 'development');

      const linesBefore = existsSync(DB_LOG_PATH)
        ? readFileSync(DB_LOG_PATH, 'utf8')
            .split('\n')
            .filter((l) => l.trim()).length
        : 0;

      dbLogger.separator();

      const linesAfter = existsSync(DB_LOG_PATH)
        ? readFileSync(DB_LOG_PATH, 'utf8')
            .split('\n')
            .filter((l) => l.trim()).length
        : 0;

      expect(linesAfter).toBe(linesBefore);

      vi.unstubAllEnvs();
    });

    it('does not log in production', () => {
      vi.stubEnv('NODE_ENV', 'production');

      dbLogger.separator();

      expect(logSpy).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });
  });
});
