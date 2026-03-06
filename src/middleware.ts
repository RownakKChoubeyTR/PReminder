import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Auth Middleware — Routing & Protection
// ─────────────────────────────────────────────────────────────
// Single source of truth for all route-level auth decisions.
//
// Routing matrix:
//   ┌──────────────────┬──────────────┬─────────────────────┐
//   │ Route            │ Signed in    │ Not signed in       │
//   ├──────────────────┼──────────────┼─────────────────────┤
//   │ /                │ → /dashboard │ Landing page        │
//   │ /login           │ → /dashboard │ Login form          │
//   │ /dashboard/**    │ Page renders │ → /login            │
//   │ /api/auth/**     │ Pass-through │ Pass-through        │
//   │ /api/**          │ Pass-through │ → 401 JSON          │
//   │ Static assets    │ Pass-through │ Pass-through        │
//   └──────────────────┴──────────────┴─────────────────────┘
//
// Why cookie-check (not auth() wrapper)?
//   The auth module imports env.ts (Zod validation) which is
//   incompatible with the Edge runtime. A cookie presence check
//   is the standard lightweight guard; actual JWT verification
//   happens in Auth.js route handlers and server-side auth().
// ─────────────────────────────────────────────────────────────

// ── Route classification ─────────────────────────────────────

/** Routes that bypass the middleware entirely (static assets, Auth.js). */
const PASSTHROUGH_PREFIXES = ['/_next/', '/favicon.ico', '/sw.js', '/icons/', '/api/auth/'];

/** Routes that are publicly accessible (shown to unauthenticated users). */
const GUEST_ONLY_PATHS = new Set(['/', '/login']);

/** Auth.js v5 session cookie names (HTTP / HTTPS). */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

// ── Helpers ──────────────────────────────────────────────────

function isPassthrough(pathname: string): boolean {
    return PASSTHROUGH_PREFIXES.some(p => pathname.startsWith(p));
}

function isAuthenticated(request: NextRequest): boolean {
    return SESSION_COOKIES.some(name => request.cookies.has(name));
}

function withSecurityHeaders(response: NextResponse): NextResponse {
    // Additional headers beyond what next.config.ts provides.
    // X-Content-Type-Options, X-Frame-Options, Referrer-Policy are
    // already set globally via next.config.ts headers config.
    response.headers.set('X-DNS-Prefetch-Control', 'off');
    response.headers.set('X-Download-Options', 'noopen');
    return response;
}

// ── Middleware ────────────────────────────────────────────────

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Static assets & Auth.js endpoints — always pass through
    if (isPassthrough(pathname)) {
        return NextResponse.next();
    }

    const signedIn = isAuthenticated(request);

    // 2. Guest-only pages (/, /login) — redirect to dashboard if signed in
    if (GUEST_ONLY_PATHS.has(pathname)) {
        if (signedIn) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.next();
    }

    // 3. Protected API routes — return 401 JSON (not a redirect)
    if (pathname.startsWith('/api/')) {
        if (!signedIn) {
            return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
        }
        return withSecurityHeaders(NextResponse.next());
    }

    // 4. All other routes (dashboard, settings, repos, pr, etc.) — require auth
    if (!signedIn) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    return withSecurityHeaders(NextResponse.next());
}

export const config = {
    matcher: [
        /*
         * Match all routes except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public folder assets (svg, png, jpg, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
    ]
};
