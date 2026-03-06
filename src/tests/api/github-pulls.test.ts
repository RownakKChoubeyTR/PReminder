import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cacheKey: vi.fn((...args: unknown[]) => JSON.stringify(args)),
  githubCache: {
    getOrSet: vi.fn((_k: string, fn: () => Promise<unknown>) => fn()),
  },
}));

vi.mock('@/lib/github/client', () => ({
  isSamlError: vi.fn(() => false),
  listOpenPulls: vi.fn(),
  resolveToken: vi.fn((t: string) => t),
  SAML_HELP_URL: 'https://docs.github.com/saml',
  SAML_NOTICE: 'SAML notice',
  searchRepoPulls: vi.fn(),
  searchRepoPullsByQuery: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { auth } from '@/lib/auth';
import { listOpenPulls, searchRepoPullsByQuery, isSamlError, searchRepoPulls } from '@/lib/github/client';
import { GET } from '@/app/api/github/pulls/route';

const mockSession = { accessToken: 'ghp_test' };

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(mockSession as never);
});

describe('GET /api/github/pulls', () => {
  it('returns paginated pull requests', async () => {
    const pulls = { data: [{ number: 1, title: 'PR 1' }], total: 1 };
    vi.mocked(listOpenPulls).mockResolvedValueOnce(pulls as never);

    const req = new NextRequest('http://localhost/api/github/pulls?repo=org/repo');
    const res = await GET(req);
    const body = await res.json();

    expect(body.data).toHaveLength(1);
  });

  it('returns 400 when repo param missing', async () => {
    const req = new NextRequest('http://localhost/api/github/pulls');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('MISSING_PARAM');
  });

  it('uses search API when search >= 3 chars', async () => {
    const searchResult = { data: [{ number: 2, title: 'Match' }], total: 1 };
    vi.mocked(searchRepoPullsByQuery).mockResolvedValueOnce(searchResult as never);

    const req = new NextRequest('http://localhost/api/github/pulls?repo=org/repo&search=Match');
    const res = await GET(req);
    const body = await res.json();

    expect(searchRepoPullsByQuery).toHaveBeenCalled();
    expect(body.data).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const req = new NextRequest('http://localhost/api/github/pulls?repo=org/repo');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 502 on GitHub API error', async () => {
    vi.mocked(listOpenPulls).mockRejectedValueOnce(new Error('API down'));

    const req = new NextRequest('http://localhost/api/github/pulls?repo=org/repo');
    const res = await GET(req);

    expect(res.status).toBe(502);
  });

  it('falls back to search on SAML error', async () => {
    vi.mocked(isSamlError).mockReturnValueOnce(true);
    vi.mocked(listOpenPulls).mockRejectedValueOnce(new Error('SAML'));
    const fallback = { data: [], total: 0 };
    vi.mocked(searchRepoPulls).mockResolvedValueOnce(fallback as never);

    const req = new NextRequest('http://localhost/api/github/pulls?repo=org/repo');
    const res = await GET(req);
    const body = await res.json();

    expect(body.notice).toBe('SAML notice');
  });
});
