import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: GET /api/github/my-prs
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-utils', () => ({
    authenticateUser: vi.fn()
}));

vi.mock('@/lib/cache', () => ({
    cacheKey: vi.fn((...args: unknown[]) => JSON.stringify(args)),
    githubCache: {
        getOrSet: vi.fn((_k: string, fn: () => Promise<unknown>) => fn())
    }
}));

vi.mock('@/lib/github/client', () => ({
    isSamlError: vi.fn(() => false),
    listUserPRs: vi.fn(),
    SAML_HELP_URL: 'https://docs.github.com/saml',
    SAML_NOTICE: 'SAML notice'
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    createLogger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
}));

import { GET } from '@/app/api/github/my-prs/route';
import { authenticateUser } from '@/lib/auth-utils';
import { isSamlError, listUserPRs } from '@/lib/github/client';

const mockUser = {
    id: 'user-1',
    githubLogin: 'alice',
    email: 'alice@corp.com',
    accessToken: 'gho_test'
};

const mockPaginatedPRs = {
    data: [
        {
            id: 1,
            number: 42,
            title: 'Fix login bug',
            repo_name: 'org/frontend',
            state: 'open',
            draft: false,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z'
        }
    ],
    total: 1,
    page: 1,
    perPage: 30,
    hasNextPage: false
};

beforeEach(() => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser, error: null } as never);
    vi.mocked(listUserPRs).mockResolvedValue(mockPaginatedPRs as never);
});

describe('GET /api/github/my-prs', () => {
    it('returns paginated PRs for the authenticated user', async () => {
        const req = new NextRequest('http://localhost/api/github/my-prs?page=1&per_page=30');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].title).toBe('Fix login bug');
    });

    it('passes page and perPage to listUserPRs', async () => {
        const req = new NextRequest('http://localhost/api/github/my-prs?page=2&per_page=10');
        await GET(req);

        expect(listUserPRs).toHaveBeenCalledWith('gho_test', 'alice', 2, 10);
    });

    it('defaults to page=1 and perPage=30 when params are absent', async () => {
        const req = new NextRequest('http://localhost/api/github/my-prs');
        await GET(req);

        expect(listUserPRs).toHaveBeenCalledWith('gho_test', 'alice', 1, 30);
    });

    it('clamps per_page to 100 max', async () => {
        const req = new NextRequest('http://localhost/api/github/my-prs?per_page=999');
        await GET(req);

        const [, , , perPage] = vi.mocked(listUserPRs).mock.calls[0]!;
        expect(perPage).toBeLessThanOrEqual(100);
    });

    it('returns 401 when not authenticated', async () => {
        vi.mocked(authenticateUser).mockResolvedValueOnce({
            error: Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
        } as never);

        const req = new NextRequest('http://localhost/api/github/my-prs');
        const res = await GET(req);

        expect(res.status).toBe(401);
    });

    it('returns 403 with SAML info on SAML error', async () => {
        vi.mocked(isSamlError).mockReturnValueOnce(true);
        vi.mocked(listUserPRs).mockRejectedValueOnce(new Error('SAML enforcement'));

        const req = new NextRequest('http://localhost/api/github/my-prs');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.code).toBe('SAML_REQUIRED');
        expect(body.notice).toBe('SAML notice');
    });

    it('returns 500 on unexpected GitHub API error', async () => {
        vi.mocked(listUserPRs).mockRejectedValueOnce(new Error('API down'));

        const req = new NextRequest('http://localhost/api/github/my-prs');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.code).toBe('GITHUB_ERROR');
    });

    it('passes githubLogin from session to listUserPRs', async () => {
        const req = new NextRequest('http://localhost/api/github/my-prs');
        await GET(req);

        expect(listUserPRs).toHaveBeenCalledWith('gho_test', 'alice', expect.any(Number), expect.any(Number));
    });
});
