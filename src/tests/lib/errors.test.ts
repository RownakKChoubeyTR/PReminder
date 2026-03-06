import {
    AppError,
    ConfigError,
    ConflictError,
    ForbiddenError,
    isAppError,
    NotFoundError,
    ServiceUnavailableError,
    UnauthorizedError,
    UnprocessableError,
    ValidationError,
    withRouteHandler
} from '@/lib/errors';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    dbLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), separator: vi.fn() }
}));

// ─── AppError ────────────────────────────────────────────────

describe('AppError', () => {
    it('stores message, code, statusCode, and meta', () => {
        const err = new AppError('Something broke', 'BROKE', 400, { field: 'name' });

        expect(err.message).toBe('Something broke');
        expect(err.code).toBe('BROKE');
        expect(err.statusCode).toBe(400);
        expect(err.meta).toEqual({ field: 'name' });
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(AppError);
    });

    it('sets name to the constructor class name', () => {
        const err = new AppError('msg', 'CODE', 500);
        expect(err.name).toBe('AppError');
    });

    it('works without meta', () => {
        const err = new AppError('No meta', 'CODE', 200);
        expect(err.meta).toBeUndefined();
    });
});

// ─── Specialised errors ──────────────────────────────────────

describe('NotFoundError', () => {
    it('defaults to 404 and NOT_FOUND code', () => {
        const err = new NotFoundError();
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toBe('Resource not found');
    });

    it('accepts a custom message and code', () => {
        const err = new NotFoundError('PR not found', 'PR_NOT_FOUND');
        expect(err.message).toBe('PR not found');
        expect(err.code).toBe('PR_NOT_FOUND');
    });
});

describe('ValidationError', () => {
    it('defaults to 400 and VALIDATION_ERROR', () => {
        const err = new ValidationError();
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a custom message', () => {
        const err = new ValidationError('Invalid email');
        expect(err.message).toBe('Invalid email');
    });
});

describe('UnauthorizedError', () => {
    it('defaults to 401 and UNAUTHORIZED', () => {
        const err = new UnauthorizedError();
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });
});

describe('ForbiddenError', () => {
    it('defaults to 403 and FORBIDDEN', () => {
        const err = new ForbiddenError();
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
    });
});

describe('ConflictError', () => {
    it('defaults to 409 and CONFLICT', () => {
        const err = new ConflictError('Duplicate resource');
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('CONFLICT');
    });
});

describe('UnprocessableError', () => {
    it('defaults to 422 and UNPROCESSABLE', () => {
        const err = new UnprocessableError('Semantic error');
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('UNPROCESSABLE');
    });
});

describe('ServiceUnavailableError', () => {
    it('defaults to 503 and SERVICE_UNAVAILABLE', () => {
        const err = new ServiceUnavailableError('GitHub is down');
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe('SERVICE_UNAVAILABLE');
    });
});

describe('ConfigError', () => {
    it('defaults to 500 and CONFIG_ERROR', () => {
        const err = new ConfigError('Missing env var');
        expect(err.statusCode).toBe(500);
        expect(err.code).toBe('CONFIG_ERROR');
    });
});

// ─── isAppError ───────────────────────────────────────────────

describe('isAppError', () => {
    it('returns true for AppError instances', () => {
        expect(isAppError(new AppError('x', 'X', 400))).toBe(true);
        expect(isAppError(new NotFoundError())).toBe(true);
    });

    it('returns false for plain Error and non-errors', () => {
        expect(isAppError(new Error('plain'))).toBe(false);
        expect(isAppError('string')).toBe(false);
        expect(isAppError(null)).toBe(false);
    });
});

// ─── withRouteHandler ────────────────────────────────────────

describe('withRouteHandler', () => {
    const makeReq = () => new NextRequest('http://localhost/api/test');

    it('returns the handler response on success', async () => {
        const handler = withRouteHandler('api/test', async () => {
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        });

        const res = await handler(makeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it('returns structured JSON for AppError throws', async () => {
        const handler = withRouteHandler('api/test', async () => {
            throw new NotFoundError('Template missing', 'TMPL_NOT_FOUND');
        });

        const res = await handler(makeReq());
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Template missing');
        expect(body.code).toBe('TMPL_NOT_FOUND');
    });

    it('returns 500 INTERNAL_ERROR for unexpected throws', async () => {
        const handler = withRouteHandler('api/test', async () => {
            throw new Error('Something unexpected');
        });

        const res = await handler(makeReq());
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
        expect(body.error).toMatch(/unexpected error/i);
    });

    it('passes request and context to the handler', async () => {
        const innerHandler = vi.fn(async () => new Response('ok'));
        const handler = withRouteHandler<{ id: string }>('api/test', innerHandler);
        const req = makeReq();
        const ctx = { params: { id: '42' } };

        await handler(req, ctx);

        expect(innerHandler).toHaveBeenCalledWith(req, ctx);
    });
});
