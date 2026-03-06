import { authenticateUser } from '@/lib/auth-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: Auth Utilities
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    auth: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
    prisma: {
        user: {
            findFirst: vi.fn()
        }
    }
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
    mockAuth.mockReset();
    vi.mocked(prisma.user.findFirst).mockReset();
});

describe('authenticateUser', () => {
    it('returns 401 when no session exists', async () => {
        mockAuth.mockResolvedValueOnce(null);

        const result = await authenticateUser();

        expect(result.error).toBeDefined();
        expect(result.user).toBeUndefined();

        const body = await result.error!.json();
        expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('returns 401 when session has no user', async () => {
        mockAuth.mockResolvedValueOnce({ user: undefined } as never);

        const result = await authenticateUser();

        expect(result.error).toBeDefined();
    });

    it('returns user when found by githubId', async () => {
        mockAuth.mockResolvedValueOnce({
            user: { githubLogin: 'testuser', githubId: '12345' },
            accessToken: 'gho_abc123'
        } as never);

        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
            id: 'cuid-1',
            username: 'testuser',
            email: 'test@corp.com'
        } as never);

        const result = await authenticateUser();

        expect(result.user).toEqual({
            id: 'cuid-1',
            githubLogin: 'testuser',
            email: 'test@corp.com',
            accessToken: 'gho_abc123'
        });
        expect(result.error).toBeUndefined();

        expect(prisma.user.findFirst).toHaveBeenCalledWith({
            where: { githubId: 12345 },
            select: { id: true, username: true, email: true }
        });
    });

    it('falls back to username when githubId is missing', async () => {
        mockAuth.mockResolvedValueOnce({
            user: { githubLogin: 'testuser', githubId: undefined },
            accessToken: 'gho_xyz'
        } as never);

        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
            id: 'cuid-2',
            username: 'testuser',
            email: null
        } as never);

        const result = await authenticateUser();

        expect(result.user).toBeDefined();
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
            where: { username: 'testuser' },
            select: { id: true, username: true, email: true }
        });
    });

    it('returns 404 when DB user not found', async () => {
        mockAuth.mockResolvedValueOnce({
            user: { githubLogin: 'ghost', githubId: '99999' }
        } as never);

        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

        const result = await authenticateUser();

        expect(result.error).toBeDefined();
        const body = await result.error!.json();
        expect(body.code).toBe('USER_NOT_FOUND');
    });
});
