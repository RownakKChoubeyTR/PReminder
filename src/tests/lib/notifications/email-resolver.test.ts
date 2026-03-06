import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: resolveRecipientEmail — 3-strategy email resolution
// Strategies:
//   1. EmailMapping table (DB cache)
//   2. GitHub user profile (/users/{login})
//   3. Commit Search API
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    emailMapping: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock(import('@/lib/logger'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    })),
  };
});

vi.mock('@/lib/github/client', () => ({
  resolveToken: vi.fn((t: string) => t),
  getUserProfile: vi.fn(),
  getCommitEmailForUser: vi.fn(),
}));

import { resolveRecipientEmail } from '@/lib/email/resolve';
import { prisma } from '@/lib/db/prisma';
import { getUserProfile, getCommitEmailForUser } from '@/lib/github/client';
import type { GitHubUserProfile } from '@/types/github';

// ── Shared fixtures ────────────────────────────────────────

const userId = 'user-1';
const loginName = 'testuser';
const accessToken = 'gha_token123';
const NOREPLY = `12345+${loginName}@users.noreply.github.com`;

/** Minimal valid GitHubUserProfile for mocking. */
function makeProfile(overrides: Partial<GitHubUserProfile> = {}): GitHubUserProfile {
  return {
    id: 1,
    login: loginName,
    avatar_url: 'https://avatars.githubusercontent.com/u/1',
    html_url: `https://github.com/${loginName}`,
    type: 'User',
    name: null,
    email: null,
    company: null,
    bio: null,
    ...overrides,
  };
}

describe('resolveRecipientEmail', () => {
  beforeEach(() => {
    vi.mocked(prisma.emailMapping.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.emailMapping.upsert).mockResolvedValue({} as never);
    vi.mocked(getUserProfile).mockResolvedValue(null);
    vi.mocked(getCommitEmailForUser).mockResolvedValue(null);
  });

  afterEach(() => vi.clearAllMocks());

  // ── Strategy 1: EmailMapping table ─────────────────────────

  it('returns cached mapping immediately (strategy 1)', async () => {
    vi.mocked(prisma.emailMapping.findFirst).mockResolvedValueOnce({
      id: 'm1',
      userId,
      githubUsername: loginName,
      email: 'cached@corp.com',
      displayName: 'Cached User',
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result).toMatchObject({ email: 'cached@corp.com', source: 'email_mapping' });
    expect(getUserProfile).not.toHaveBeenCalled();
    expect(getCommitEmailForUser).not.toHaveBeenCalled();
    expect(prisma.emailMapping.upsert).not.toHaveBeenCalled();
  });

  // ── Strategy 2: GitHub profile ─────────────────────────────

  it('resolves from profile public email and caches it (strategy 2)', async () => {
    vi.mocked(getUserProfile).mockResolvedValueOnce(
      makeProfile({ email: 'profile@corp.com', name: 'Profile User' }),
    );

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result).toMatchObject({
      email: 'profile@corp.com',
      displayName: 'Profile User',
      source: 'github_profile',
    });
    expect(prisma.emailMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: 'profile@corp.com', source: 'github-profile' }),
      }),
    );
    expect(getCommitEmailForUser).not.toHaveBeenCalled();
  });

  it('skips noreply profile email and falls through to strategy 3', async () => {
    vi.mocked(getUserProfile).mockResolvedValueOnce(
      makeProfile({ email: NOREPLY }),
    );
    vi.mocked(getCommitEmailForUser).mockResolvedValueOnce({
      email: 'commit@corp.com',
      name: 'Dev',
    });

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result).toMatchObject({ email: 'commit@corp.com', source: 'github_commit' });
  });

  it('skips null profile email and falls through to strategy 3', async () => {
    vi.mocked(getUserProfile).mockResolvedValueOnce(makeProfile({ email: null }));
    vi.mocked(getCommitEmailForUser).mockResolvedValueOnce({
      email: 'commit@corp.com',
      name: null,
    });

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result).toMatchObject({ email: 'commit@corp.com' });
  });

  it('falls through when getUserProfile returns null (e.g. 404)', async () => {
    vi.mocked(getUserProfile).mockResolvedValueOnce(null);
    vi.mocked(getCommitEmailForUser).mockResolvedValueOnce({
      email: 'commit@corp.com',
      name: null,
    });

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result).toMatchObject({ email: 'commit@corp.com' });
  });

  // ── Strategy 3: Commit Search API ──────────────────────────

  it('resolves from commit search and caches it (strategy 3)', async () => {
    vi.mocked(getUserProfile).mockResolvedValueOnce(makeProfile({ email: null }));
    vi.mocked(getCommitEmailForUser).mockResolvedValueOnce({
      email: 'commit@corp.com',
      name: 'Commit User',
    });

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result).toMatchObject({
      email: 'commit@corp.com',
      displayName: 'Commit User',
      source: 'github_commit',
    });
    expect(prisma.emailMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: 'commit@corp.com', source: 'github-commit' }),
        where: { userId_githubUsername: { userId, githubUsername: loginName } },
      }),
    );
  });

  it('skips noreply commit email and returns failure', async () => {
    vi.mocked(getUserProfile).mockResolvedValueOnce(makeProfile());
    vi.mocked(getCommitEmailForUser).mockResolvedValueOnce({ email: NOREPLY, name: null });

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result.email).toBeNull();
    expect((result as { source: null }).source).toBeNull();
  });

  // ── All strategies exhausted ────────────────────────────────

  it('returns structured failure when all strategies exhausted', async () => {
    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result).toMatchObject({ email: null, source: null });
    expect((result as { reason: string }).reason).toContain(loginName);
  });

  it('carries displayName from profile into failure result', async () => {
    vi.mocked(getUserProfile).mockResolvedValueOnce(
      makeProfile({ email: null, name: 'Known Name' }),
    );

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result.displayName).toBe('Known Name');
  });

  it('falls back to login as displayName when profile is null', async () => {
    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result.displayName).toBe(loginName);
  });

  // ── Caching behaviour ───────────────────────────────────────

  it('does not cache on failure (no upsert when all strategies fail)', async () => {
    await resolveRecipientEmail(userId, loginName, accessToken);

    expect(prisma.emailMapping.upsert).not.toHaveBeenCalled();
  });

  it('uses getCommitEmailForUser null return gracefully', async () => {
    vi.mocked(getUserProfile).mockResolvedValueOnce(makeProfile());
    vi.mocked(getCommitEmailForUser).mockResolvedValueOnce(null);

    const result = await resolveRecipientEmail(userId, loginName, accessToken);

    expect(result.email).toBeNull();
  });
});
