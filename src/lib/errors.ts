// ─────────────────────────────────────────────────────────────
// Application Error Hierarchy + Route Handler Wrapper
// ─────────────────────────────────────────────────────────────
// Provides typed error classes for every failure domain and a
// `withRouteHandler` HOF that turns unhandled throws into clean
// JSON responses — keeping route handlers slim and uniform.
//
// Error anatomy:
//   message    — human-readable (may be shown in UI / logs)
//   code       — machine-readable ALL_CAPS snake_case string
//   statusCode — HTTP status to return
//   meta       — optional debug context (logged, not sent to client)
//
// Usage in a route:
//   export const GET = withRouteHandler('api/templates', async (req) => {
//     const tmpl = await prisma.messageTemplate.findUnique(…);
//     if (!tmpl) throw new NotFoundError('Template not found', 'TEMPLATE_NOT_FOUND');
//     return NextResponse.json({ data: tmpl });
//   });
// ─────────────────────────────────────────────────────────────

import { createLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';

// ── Base AppError ─────────────────────────────────────────────

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly meta?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name       = this.constructor.name;
    this.code       = code;
    this.statusCode = statusCode;
    this.meta       = meta;

    // Ensure instanceof works correctly after TypeScript compilation
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Specialised error types ───────────────────────────────────

/** 404 — resource does not exist or is not owned by the caller. */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND', meta?: Record<string, unknown>) {
    super(message, code, 404, meta);
  }
}

/** 400 — request body / query params fail validation. */
export class ValidationError extends AppError {
  constructor(
    message = 'Validation failed',
    code = 'VALIDATION_ERROR',
    meta?: Record<string, unknown>,
  ) {
    super(message, code, 400, meta);
  }
}

/** 401 — caller is not authenticated. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(message, code, 401);
  }
}

/** 403 — caller is authenticated but not permitted. */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(message, code, 403);
  }
}

/** 409 — state conflict (e.g. duplicate resource). */
export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT', meta?: Record<string, unknown>) {
    super(message, code, 409, meta);
  }
}

/** 422 — request is syntactically valid but semantically wrong. */
export class UnprocessableError extends AppError {
  constructor(message: string, code = 'UNPROCESSABLE', meta?: Record<string, unknown>) {
    super(message, code, 422, meta);
  }
}

/** 503 — downstream service (GitHub, Teams, etc.) is unavailable. */
export class ServiceUnavailableError extends AppError {
  constructor(message: string, code = 'SERVICE_UNAVAILABLE', meta?: Record<string, unknown>) {
    super(message, code, 503, meta);
  }
}

/** 500 — misconfiguration or missing required env / encryption keys. */
export class ConfigError extends AppError {
  constructor(message: string, code = 'CONFIG_ERROR', meta?: Record<string, unknown>) {
    super(message, code, 500, meta);
  }
}

// ── withRouteHandler HOF ────────────────────────────────────
// Wraps an async Next.js route handler so that:
//   • AppErrors  → logged at WARN level + structured JSON response
//   • Other errors → logged at ERROR level + 500 JSON response
// This eliminates per-route try/catch boilerplate and guarantees
// a consistent error response shape across the entire API.

type RouteHandler<P = Record<string, string>> = (
  req: import('next/server').NextRequest,
  ctx?: { params: P },
) => Promise<Response>;

/**
 * Wrap a Next.js API route handler with unified error handling and logging.
 *
 * @param routeContext - identifying string used in log messages (e.g. 'api/templates')
 * @param handler      - async function that should throw AppErrors for expected failures
 */
export function withRouteHandler<P = Record<string, string>>(
  routeContext: string,
  handler: RouteHandler<P>,
): RouteHandler<P> {
  const log = createLogger(routeContext);

  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        log.warn(`${err.code}: ${err.message}`, { statusCode: err.statusCode, ...err.meta });
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.statusCode },
        );
      }

      // Unhandled / unexpected error
      log.error('Unhandled route error', err);
      return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again.', code: 'INTERNAL_ERROR' },
        { status: 500 },
      );
    }
  };
}

// ── Type guard ────────────────────────────────────────────────

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
