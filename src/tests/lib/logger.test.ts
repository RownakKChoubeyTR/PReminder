import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

//
// Tests: Server Logger
//
// The logger uses module-level constants (IS_DEV, IS_SERVER) that are computed
// at import time. To test different environments we must reset the module cache
// and dynamically re-import after stubbing ENV.
//

describe('logger API shape', () => {
  it('createLogger returns an object with debug/info/warn/error', async () => {
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('test');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  it('logger singleton has info/warn/error', async () => {
    const { logger } = await import('@/lib/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('calling logger methods does not throw', async () => {
    const { logger, createLogger } = await import('@/lib/logger');
    expect(() => logger.info('msg', 'ctx')).not.toThrow();
    expect(() => logger.warn('msg')).not.toThrow();
    expect(() => logger.error('msg', 'ctx', new Error('e'))).not.toThrow();
    const log = createLogger('ctx');
    expect(() => log.debug('debug msg')).not.toThrow();
    expect(() => log.info('info msg', { x: 1 })).not.toThrow();
    expect(() => log.warn('warn msg')).not.toThrow();
    expect(() => log.error('error msg', new Error('e'), { retry: 3 })).not.toThrow();
  });
});

describe('logger - console output (development mode)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    // Mock node:fs so file writes are silent in tests
    vi.doMock('node:fs', () => ({ mkdirSync: vi.fn(), appendFileSync: vi.fn() }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('node:fs');
  });

  it('logger.info writes to console.info in development', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { logger } = await import('@/lib/logger');

    logger.info('Server started', 'app');

    expect(spy).toHaveBeenCalledOnce();
    const msg = spy.mock.calls[0]![0] as string;
    expect(msg).toContain('Server started');
    expect(msg).toMatch(/\d{2}:\d{2}:\d{2}/);
    spy.mockRestore();
  });

  it('logger.warn writes to console.warn in development', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger } = await import('@/lib/logger');

    logger.warn('Disk space low');

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]![0] as string).toContain('Disk space low');
    spy.mockRestore();
  });

  it('logger.error writes to console.error in development', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('@/lib/logger');

    logger.error('Connection failed', 'db');

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]![0] as string).toContain('Connection failed');
    spy.mockRestore();
  });

  it('createLogger writes context and message to console in dev', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('my-module');

    log.info('Hello world');

    expect(spy).toHaveBeenCalledOnce();
    const msg = spy.mock.calls[0]![0] as string;
    expect(msg).toContain('Hello world');
    expect(msg).toContain('my-module');
    spy.mockRestore();
  });

  it('createLogger.debug calls console.debug in dev', async () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { createLogger } = await import('@/lib/logger');
    createLogger('dbg').debug('trace me', { key: 'val' });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe('logger - silent in non-development', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'test');
    vi.doMock('node:fs', () => ({ mkdirSync: vi.fn(), appendFileSync: vi.fn() }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('node:fs');
  });

  it('logger.info does NOT write to console outside development', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { logger } = await import('@/lib/logger');
    logger.info('Silent message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logger.error does NOT write to console in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('@/lib/logger');
    logger.error('Silent error', 'ctx', new Error('secret'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('createLogger methods are silent outside dev', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { createLogger } = await import('@/lib/logger');
    createLogger('quiet').info('shh');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
