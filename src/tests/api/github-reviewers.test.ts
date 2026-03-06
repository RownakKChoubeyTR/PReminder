import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    reminderLog: { findFirst: vi.fn() },
    emailMapping: { findMany: vi.fn(() => Promise.resolve([])) },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cacheKey: vi.fn((...args: unknown[]) => JSON.stringify(args)),
  reviewersCache: {
    getOrSet: vi.fn((_k: string, fn: () => Promise<unknown>) => fn()),
  },
}));

vi.mock('@/lib/github/client', () => ({
  isSamlError: vi.fn(() => false),
  listReviews: vi.fn(),
  getPullRequest: vi.fn(),
  resolveToken: vi.fn((t: string) => t),
  SAML_HELP_URL: 'https://docs.github.com/saml',
  SAML_NOTICE: 'SAML notice',
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
}));

import { GET } from '@/app/api/github/reviewers/route';
import { authenticateUser } from '@/lib/auth-utils';
import { getPullRequest, isSamlError, listReviews } from '@/lib/github/client';

const mockUser = {
  id: 'user-1',
  githubLogin: 'testuser',
  email: 'test@corp.com',
  accessToken: 'gho_test',
};

beforeEach(() => {
  vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser, error: null } as never);
  vi.mocked(getPullRequest).mockResolvedValue({
    number: 42,
    title: 'Test PR',
    requested_reviewers: [
      { login: 'alice', id: 1, avatar_url: '' },
      { login: 'bob', id: 2, avatar_url: '' },
    ],
  } as never);
});

describe('GET /api/github/reviewers', () => {
  it('returns reviewers with computed statuses', async () => {
    vi.mocked(listReviews).mockResolvedValueOnce([
      { user: { login: 'alice', id: 1 }, state: 'APPROVED', submitted_at: '2024-01-02T00:00:00Z' },
      {
        user: { login: 'bob', id: 2 },
        state: 'CHANGES_REQUESTED',
        submitted_at: '2024-01-01T00:00:00Z',
      },
    ] as never);

    const req = new NextRequest('http://localhost/api/github/reviewers?repo=org/repo&pr=42');
    const res = await GET(req);
    const body = await res.json();

    expect(body.data).toHaveLength(2);
    const alice = body.data.find((r: { user: { login: string } }) => r.user.login === 'alice');
    expect(alice.status).toBe('approved');
  });

  it('returns 400 when repo missing', async () => {
    const req = new NextRequest('http://localhost/api/github/reviewers?pr=42');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('MISSING_PARAM');
  });

  it('returns 400 when pr missing', async () => {
    const req = new NextRequest('http://localhost/api/github/reviewers?repo=org/repo');
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 when pr is not a number', async () => {
    const req = new NextRequest('http://localhost/api/github/reviewers?repo=org/repo&pr=abc');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_PARAM');
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce({
      user: null,
      error: (await import('next/server')).NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      ),
    } as never);

    const req = new NextRequest('http://localhost/api/github/reviewers?repo=org/repo&pr=42');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns empty array on SAML error', async () => {
    vi.mocked(isSamlError).mockReturnValueOnce(true);
    vi.mocked(listReviews).mockRejectedValueOnce(new Error('SAML'));

    const req = new NextRequest('http://localhost/api/github/reviewers?repo=org/repo&pr=42');
    const res = await GET(req);
    const body = await res.json();

    expect(body.data).toEqual([]);
    expect(body.mode).toBe('restricted');
  });

  it('returns 502 on non-SAML error', async () => {
    vi.mocked(listReviews).mockRejectedValueOnce(new Error('timeout'));

    const req = new NextRequest('http://localhost/api/github/reviewers?repo=org/repo&pr=42');
    const res = await GET(req);

    expect(res.status).toBe(502);
  });

  it('computes COMMENTED status when only comments exist', async () => {
    vi.mocked(listReviews).mockResolvedValueOnce([
      {
        user: { login: 'charlie', id: 3 },
        state: 'COMMENTED',
        submitted_at: '2024-01-01T00:00:00Z',
      },
    ] as never);

    const req = new NextRequest('http://localhost/api/github/reviewers?repo=org/repo&pr=42');
    const res = await GET(req);
    const body = await res.json();

    expect(body.data[0].status).toBe('commented');
  });

  it('takes latest actionable review when multiple exist', async () => {
    vi.mocked(listReviews).mockResolvedValueOnce([
      {
        user: { login: 'alice', id: 1 },
        state: 'CHANGES_REQUESTED',
        submitted_at: '2024-01-01T00:00:00Z',
      },
      { user: { login: 'alice', id: 1 }, state: 'APPROVED', submitted_at: '2024-01-02T00:00:00Z' },
    ] as never);

    const req = new NextRequest('http://localhost/api/github/reviewers?repo=org/repo&pr=42');
    const res = await GET(req);
    const body = await res.json();

    expect(body.data[0].status).toBe('approved');
  });
});
