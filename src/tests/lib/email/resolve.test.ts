import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: Email Resolver — resolveRecipientEmail
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db/prisma', () => ({
    prisma: {
        emailMapping: {
            findFirst: vi.fn(),
            upsert: vi.fn()
        }
    }
}));

vi.mock('@/lib/github/client', () => ({
    resolveToken: vi.fn((t: string) => t),
    getUserProfile: vi.fn(),
    getCommitEmailForUser: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }))
}));

import { prisma } from '@/lib/db/prisma';
import { resolveRecipientEmail } from '@/lib/email/resolve';
import { getUserProfile } from '@/lib/github/client';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('resolveRecipientEmail', () => {
    const userId = 'user-1';
    const login = 'alice';
    const token = 'gho_test';

    it('returns email from EmailMapping when present', async () => {
        vi.mocked(prisma.emailMapping.findFirst).mockResolvedValueOnce({
            email: 'alice@corp.com',
            displayName: 'Alice Dev',
            source: 'manual'
        } as never);

        const result = await resolveRecipientEmail(userId, login, token);

        expect(result.email).toBe('alice@corp.com');
        expect(result.displayName).toBe('Alice Dev');
        expect(result.source).toBe('email_mapping');
        // Should NOT call GitHub API
        expect(getUserProfile).not.toHaveBeenCalled();
    });

    it('falls back to GitHub profile when no EmailMapping exists', async () => {
        vi.mocked(prisma.emailMapping.findFirst).mockResolvedValueOnce(null);
        vi.mocked(getUserProfile).mockResolvedValueOnce({
            id: 123,
            login: 'alice',
            avatar_url: 'https://example.com/alice.png',
            html_url: 'https://github.com/alice',
            type: 'User',
            name: 'Alice GitHub',
            email: 'alice@github.com',
            company: 'Acme',
            bio: null
        });
        vi.mocked(prisma.emailMapping.upsert).mockResolvedValueOnce({} as never);

        const result = await resolveRecipientEmail(userId, login, token);

        expect(result.email).toBe('alice@github.com');
        expect(result.displayName).toBe('Alice GitHub');
        expect(result.source).toBe('github_profile');
    });

    it('auto-saves GitHub profile email to EmailMapping', async () => {
        vi.mocked(prisma.emailMapping.findFirst).mockResolvedValueOnce(null);
        vi.mocked(getUserProfile).mockResolvedValueOnce({
            id: 123,
            login: 'alice',
            avatar_url: '',
            html_url: '',
            type: 'User',
            name: 'Alice',
            email: 'alice@example.com',
            company: null,
            bio: null
        });
        vi.mocked(prisma.emailMapping.upsert).mockResolvedValueOnce({} as never);

        await resolveRecipientEmail(userId, login, token);

        expect(prisma.emailMapping.upsert).toHaveBeenCalledWith({
            where: {
                userId_githubUsername: { userId, githubUsername: login }
            },
            update: {
                email: 'alice@example.com',
                displayName: 'Alice',
                source: 'github-profile'
            },
            create: {
                userId,
                githubUsername: login,
                email: 'alice@example.com',
                displayName: 'Alice',
                source: 'github-profile'
            }
        });
    });

    it('returns failure when GitHub profile has no email', async () => {
        vi.mocked(prisma.emailMapping.findFirst).mockResolvedValueOnce(null);
        vi.mocked(getUserProfile).mockResolvedValueOnce({
            id: 123,
            login: 'bob',
            avatar_url: '',
            html_url: '',
            type: 'User',
            name: 'Bob Private',
            email: null,
            company: null,
            bio: null
        });

        const result = await resolveRecipientEmail(userId, 'bob', token);

        expect(result.email).toBeNull();
        expect(result.source).toBeNull();
        expect('reason' in result && result.reason).toContain('Their GitHub profile has no public email');
    });

    it('returns failure when GitHub profile is null (user not found)', async () => {
        vi.mocked(prisma.emailMapping.findFirst).mockResolvedValueOnce(null);
        vi.mocked(getUserProfile).mockResolvedValueOnce(null);

        const result = await resolveRecipientEmail(userId, 'ghost', token);

        expect(result.email).toBeNull();
        expect(result.source).toBeNull();
    });

    it('returns failure with diagnostics when GitHub API throws', async () => {
        vi.mocked(prisma.emailMapping.findFirst).mockResolvedValueOnce(null);
        vi.mocked(getUserProfile).mockRejectedValueOnce(new Error('403 Forbidden'));

        const result = await resolveRecipientEmail(userId, login, token);

        expect(result.email).toBeNull();
        expect(result.source).toBeNull();
        expect('reason' in result && result.reason).toContain('Could not find a deliverable email for');
    });

    it('uses login as displayName when GitHub name is null', async () => {
        vi.mocked(prisma.emailMapping.findFirst).mockResolvedValueOnce(null);
        vi.mocked(getUserProfile).mockResolvedValueOnce({
            id: 456,
            login: 'anonymous',
            avatar_url: '',
            html_url: '',
            type: 'User',
            name: null,
            email: 'anon@corp.com',
            company: null,
            bio: null
        });
        vi.mocked(prisma.emailMapping.upsert).mockResolvedValueOnce({} as never);

        const result = await resolveRecipientEmail(userId, 'anonymous', token);

        expect(result.email).toBe('anon@corp.com');
        expect(result.displayName).toBe('anonymous');
        expect(result.source).toBe('github_profile');
    });
});
