import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
    auth: vi.fn()
}));

vi.mock('@/lib/cache', () => ({
    cacheKey: vi.fn((...args: unknown[]) => JSON.stringify(args)),
    githubCache: {
        getOrSet: vi.fn((_k: string, fn: () => Promise<unknown>) => fn())
    }
}));

vi.mock('@/lib/github/client', () => ({
    isSamlError: vi.fn(() => false),
    listOrgRepos: vi.fn(),
    resolveToken: vi.fn((t: string) => t),
    SAML_HELP_URL: 'https://docs.github.com/saml',
    SAML_NOTICE: 'SAML notice',
    searchOrgRepos: vi.fn(),
    searchOrgReposByName: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}));

import { GET } from '@/app/api/github/repos/route';
import { auth } from '@/lib/auth';
import { isSamlError, listOrgRepos, searchOrgRepos, searchOrgReposByName } from '@/lib/github/client';

const mockSession = { accessToken: 'ghp_test' };

beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(mockSession as never);
});

describe('GET /api/github/repos', () => {
    it('returns paginated repos', async () => {
        const repos = { data: [{ id: 1, name: 'repo1' }], total: 1 };
        vi.mocked(listOrgRepos).mockResolvedValueOnce(repos as never);

        const req = new NextRequest('http://localhost/api/github/repos?page=1&per_page=30');
        const res = await GET(req);
        const body = await res.json();

        expect(body.data).toHaveLength(1);
    });

    it('uses search API when search >= 3 chars', async () => {
        const searchResult = { data: [{ id: 2, name: 'match' }], total: 1 };
        vi.mocked(searchOrgReposByName).mockResolvedValueOnce(searchResult as never);

        const req = new NextRequest('http://localhost/api/github/repos?search=mat');
        const res = await GET(req);
        const body = await res.json();

        expect(body.data).toHaveLength(1);
        expect(searchOrgReposByName).toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
        vi.mocked(auth).mockResolvedValueOnce(null as never);

        const req = new NextRequest('http://localhost/api/github/repos');
        const res = await GET(req);

        expect(res.status).toBe(401);
    });

    it('returns 502 on GitHub API error', async () => {
        vi.mocked(listOrgRepos).mockRejectedValueOnce(new Error('API down'));

        const req = new NextRequest('http://localhost/api/github/repos');
        const res = await GET(req);

        expect(res.status).toBe(502);
    });

    it('falls back to Search API on SAML error', async () => {
        vi.mocked(isSamlError).mockReturnValueOnce(true);
        vi.mocked(listOrgRepos).mockRejectedValueOnce(new Error('SAML'));
        const fallback = { data: [{ id: 3 }], total: 1 };
        vi.mocked(searchOrgRepos).mockResolvedValueOnce(fallback as never);

        const req = new NextRequest('http://localhost/api/github/repos');
        const res = await GET(req);
        const body = await res.json();

        expect(body.notice).toBe('SAML notice');
    });

    it('returns 403 when SAML fallback also fails', async () => {
        vi.mocked(isSamlError).mockReturnValueOnce(true);
        vi.mocked(listOrgRepos).mockRejectedValueOnce(new Error('SAML'));
        vi.mocked(searchOrgRepos).mockRejectedValueOnce(new Error('also failed'));

        const req = new NextRequest('http://localhost/api/github/repos');
        const res = await GET(req);

        expect(res.status).toBe(403);
    });
});
