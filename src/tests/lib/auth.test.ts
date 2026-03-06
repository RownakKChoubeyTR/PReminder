import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────

vi.mock('@/lib/db/encryption', () => ({
  encrypt: vi.fn((v: string) => `enc_${v}`),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock env with required values
vi.mock('@/lib/env', () => ({
  env: {
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    GITHUB_ORG: 'test-org',
  },
}));

// We can't easily test NextAuth directly, but we can test the callbacks
// by mocking NextAuth to capture the config and then calling the callbacks.
let capturedConfig: Record<string, unknown> = {};

vi.mock('next-auth', () => ({
  default: (config: Record<string, unknown>) => {
    capturedConfig = config;
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  },
}));

vi.mock('next-auth/providers/github', () => ({
  default: vi.fn(() => ({ id: 'github' })),
}));

// Trigger the module to execute—this calls NextAuth() with the config
await import('@/lib/auth');

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NextAuth callbacks', () => {
  const callbacks = capturedConfig.callbacks as {
    jwt: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
    session: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
    redirect: (params: { url: string; baseUrl: string }) => Promise<string>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('jwt callback', () => {
    it('populates token on first sign-in', async () => {
      const result = await callbacks.jwt({
        token: { sub: '123' },
        account: {
          access_token: 'gh-token',
          refresh_token: 'refresh',
          providerAccountId: '456',
        },
        profile: { login: 'testuser' },
      });

      expect(result.accessToken).toBe('gh-token');
      expect(result.githubLogin).toBe('testuser');
      expect(result.githubId).toBe('456');
      expect(result.tokenIssuedAt).toBeDefined();
      expect(result.lastVerifiedAt).toBeDefined();
    });

    it('returns session expired error when token is past expiry', async () => {
      const now = Math.floor(Date.now() / 1000);
      const result = await callbacks.jwt({
        token: {
          accessToken: 'gh-token',
          expiresAt: now - 100, // already expired
        },
      });

      expect(result.error).toBe('SessionExpired');
    });

    it('re-validates token when verification interval elapsed', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const now = Math.floor(Date.now() / 1000);
      const result = await callbacks.jwt({
        token: {
          accessToken: 'gh-token',
          lastVerifiedAt: now - 2000, // 2000 seconds ago (> 1800s refresh interval)
          expiresAt: now + 100000,
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer gh-token',
          }),
        }),
      );
      expect(result.lastVerifiedAt).toBeGreaterThanOrEqual(now);
    });

    it('marks token revoked when GitHub verification fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const now = Math.floor(Date.now() / 1000);
      const result = await callbacks.jwt({
        token: {
          accessToken: 'bad-token',
          lastVerifiedAt: now - 2000, // 2000 seconds ago (> 1800s refresh interval)
          expiresAt: now + 100000,
        },
      });

      expect(result.error).toBe('TokenRevoked');
    });

    it('keeps token valid on network error during verification', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network down'));

      const now = Math.floor(Date.now() / 1000);
      const result = await callbacks.jwt({
        token: {
          accessToken: 'gh-token',
          lastVerifiedAt: now - 1000,
          expiresAt: now + 100000,
        },
      });

      // Network error → don't invalidate
      expect(result.error).toBeUndefined();
    });

    it('skips verification when within interval', async () => {
      const now = Math.floor(Date.now() / 1000);
      const result = await callbacks.jwt({
        token: {
          accessToken: 'gh-token',
          lastVerifiedAt: now - 10, // only 10 seconds ago
          expiresAt: now + 100000,
        },
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('gh-token');
    });
  });

  describe('session callback', () => {
    it('shapes session object with user data', async () => {
      const session = { user: { name: 'Test' }, expires: '' };
      const token = {
        githubLogin: 'testuser',
        githubId: '456',
        accessToken: 'gh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await callbacks.session({ session, token }) as Record<string, unknown>;

      expect((result.user as Record<string, unknown>).githubLogin).toBe('testuser');
      expect((result.user as Record<string, unknown>).githubId).toBe('456');
      expect(result.accessToken).toBe('gh-token');
    });

    it('propagates token errors to session', async () => {
      const session = { user: {} };
      const token = { error: 'SessionExpired' };

      const result = await callbacks.session({ session, token }) as Record<string, unknown>;
      expect(result.error).toBe('SessionExpired');
    });
  });

  describe('redirect callback', () => {
    const baseUrl = 'http://localhost:3000';

    it('allows relative paths', async () => {
      const result = await callbacks.redirect({ url: '/dashboard', baseUrl });
      expect(result).toBe('http://localhost:3000/dashboard');
    });

    it('allows same-origin absolute URLs', async () => {
      const result = await callbacks.redirect({ url: 'http://localhost:3000/settings', baseUrl });
      expect(result).toBe('http://localhost:3000/settings');
    });

    it('blocks cross-origin redirects', async () => {
      const result = await callbacks.redirect({ url: 'https://evil.com', baseUrl });
      expect(result).toBe('http://localhost:3000/dashboard');
    });
  });
});

describe('NextAuth events', () => {
  const events = capturedConfig.events as {
    signIn: (params: Record<string, unknown>) => Promise<void>;
    signOut: () => Promise<void>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts user on sign-in', async () => {
    await events.signIn({
      account: { access_token: 'token', providerAccountId: '123' },
      profile: { login: 'testuser', email: 'test@corp.com', name: 'Test User', avatar_url: 'https://avatar.com/test.png' },
    });

    expect(vi.mocked(prisma.user.upsert)).toHaveBeenCalledWith({
      where: { githubId: 123 },
      create: expect.objectContaining({
        githubId: 123,
        username: 'testuser',
        email: 'test@corp.com',
        accessToken: 'enc_token',
      }),
      update: expect.objectContaining({
        username: 'testuser',
        email: 'test@corp.com',
      }),
    });
  });

  it('does nothing when account or profile is missing', async () => {
    await events.signIn({ account: null, profile: null });
    expect(vi.mocked(prisma.user.upsert)).not.toHaveBeenCalled();
  });

  it('logs error when upsert fails', async () => {
    vi.mocked(prisma.user.upsert).mockRejectedValueOnce(new Error('DB error'));

    await events.signIn({
      account: { access_token: 'token', providerAccountId: '123' },
      profile: { login: 'testuser' },
    });

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.stringContaining('failed to upsert'),
      'auth',
    );
  });

  it('logs sign-out', async () => {
    await events.signOut();
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('sign-out', 'auth');
  });
});
