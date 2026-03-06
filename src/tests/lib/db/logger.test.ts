import { dbLogger } from '@/lib/db/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: dbLogger wrapper (src/lib/db/logger.ts)
// ─────────────────────────────────────────────────────────────
// This file is a thin adapter that wraps createLogger('db') from the
// universal logger and adds a separator() helper. These tests verify
// the adapter surface — the individual log methods are covered by
// the universal logger's own test suite.
// ─────────────────────────────────────────────────────────────

const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

beforeEach(() => {
  logSpy.mockClear();
});

describe('dbLogger (db/logger.ts wrapper)', () => {
  it('exposes info, warn, error and debug methods', () => {
    expect(typeof dbLogger.info).toBe('function');
    expect(typeof dbLogger.warn).toBe('function');
    expect(typeof dbLogger.error).toBe('function');
    expect(typeof dbLogger.debug).toBe('function');
  });

  it('exposes separator()', () => {
    expect(typeof dbLogger.separator).toBe('function');
  });

  describe('separator()', () => {
    it('calls console.log in development', () => {
      vi.stubEnv('NODE_ENV', 'development');

      dbLogger.separator();

      expect(logSpy).toHaveBeenCalledOnce();
      expect(logSpy.mock.calls[0]![0]).toContain('─');

      vi.unstubAllEnvs();
    });

    it('does not call console.log outside development', () => {
      vi.stubEnv('NODE_ENV', 'production');

      dbLogger.separator();

      expect(logSpy).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it('does not call console.log in test environment', () => {
      // NODE_ENV='test' is the default in Vitest
      dbLogger.separator();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
