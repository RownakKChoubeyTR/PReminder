import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: Auth Middleware
// ─────────────────────────────────────────────────────────────

function createRequest(pathname: string, options?: { cookies?: Record<string, string> }): NextRequest {
    const url = `http://localhost:3000${pathname}`;
    const req = new NextRequest(url);
    if (options?.cookies) {
        for (const [name, value] of Object.entries(options.cookies)) {
            req.cookies.set(name, value);
        }
    }
    return req;
}

function signedInRequest(pathname: string): NextRequest {
    return createRequest(pathname, {
        cookies: { 'authjs.session-token': 'abc123' }
    });
}

describe('middleware', () => {
    // ── Passthrough routes ─────────────────────────────────
    it('passes through _next/ static assets', () => {
        const res = middleware(createRequest('/_next/static/chunk.js'));
        // NextResponse.next() doesn't set a redirect
        expect(res.headers.get('Location')).toBeNull();
        expect(res.status).toBe(200);
    });

    it('passes through /favicon.ico', () => {
        const res = middleware(createRequest('/favicon.ico'));
        expect(res.status).toBe(200);
    });

    it('passes through /api/auth/ routes', () => {
        const res = middleware(createRequest('/api/auth/callback/github'));
        expect(res.status).toBe(200);
    });

    it('passes through /sw.js', () => {
        const res = middleware(createRequest('/sw.js'));
        expect(res.status).toBe(200);
    });

    it('passes through /icons/', () => {
        const res = middleware(createRequest('/icons/icon-192x192.png'));
        expect(res.status).toBe(200);
    });

    // ── Guest-only (/login, /) ──────────────────────────────
    it('shows landing page when not signed in at /', () => {
        const res = middleware(createRequest('/'));
        expect(res.status).toBe(200);
        expect(res.headers.get('Location')).toBeNull();
    });

    it('redirects to /dashboard when signed in at /', () => {
        const res = middleware(signedInRequest('/'));
        expect(res.status).toBe(307);
        expect(res.headers.get('Location')).toContain('/dashboard');
    });

    it('shows login page when not signed in at /login', () => {
        const res = middleware(createRequest('/login'));
        expect(res.status).toBe(200);
    });

    it('redirects to /dashboard when signed in at /login', () => {
        const res = middleware(signedInRequest('/login'));
        expect(res.status).toBe(307);
        expect(res.headers.get('Location')).toContain('/dashboard');
    });

    // ── Protected API routes ────────────────────────────────
    it('returns 401 JSON for unauthenticated API requests', async () => {
        const res = middleware(createRequest('/api/github/repos'));
        expect(res.status).toBe(401);

        const body = await res.json();
        expect(body.error).toBe('Unauthorized');
        expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('passes through authenticated API requests with security headers', () => {
        const res = middleware(signedInRequest('/api/github/repos'));
        expect(res.status).toBe(200);
        expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('off');
        expect(res.headers.get('X-Download-Options')).toBe('noopen');
    });

    // ── Protected pages ─────────────────────────────────────
    it('redirects to /login for unauthenticated dashboard access', () => {
        const res = middleware(createRequest('/dashboard'));
        expect(res.status).toBe(307);
        expect(res.headers.get('Location')).toContain('/login');
    });

    it('allows authenticated dashboard access with security headers', () => {
        const res = middleware(signedInRequest('/dashboard'));
        expect(res.status).toBe(200);
        expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('off');
    });

    it('redirects to /login for unauthenticated settings access', () => {
        const res = middleware(createRequest('/dashboard/settings'));
        expect(res.status).toBe(307);
        expect(res.headers.get('Location')).toContain('/login');
    });

    it('recognizes __Secure cookie variant', () => {
        const req = createRequest('/dashboard', {
            cookies: { '__Secure-authjs.session-token': 'xyz' }
        });
        const res = middleware(req);
        expect(res.status).toBe(200);
    });
});
