import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-utils', () => ({
    authenticateUser: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
    prisma: {
        reminderLog: {
            findMany: vi.fn()
        }
    }
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import { GET } from '@/app/api/reminders/cooldown/route';
import { authenticateUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db/prisma';

const mockUser = {
    id: 'user-1',
    githubLogin: 'testuser',
    email: 'test@corp.com',
    accessToken: 'gho_test'
};

beforeEach(() => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser });
});

describe('GET /api/reminders/cooldown', () => {
    it('returns allowed=true when no prior reminders', async () => {
        vi.mocked(prisma.reminderLog.findMany).mockResolvedValueOnce([]);

        const req = new NextRequest(
            'http://localhost/api/reminders/cooldown?recipients=alice,bob&prNumber=42&repo=org/repo'
        );
        const res = await GET(req);
        const body = await res.json();

        expect(body.data).toHaveLength(2);
        expect(body.data[0]).toEqual({ login: 'alice', allowed: true, remainingSeconds: 0 });
        expect(body.data[1]).toEqual({ login: 'bob', allowed: true, remainingSeconds: 0 });
    });

    it('returns allowed=false when cooldown is active', async () => {
        const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
        vi.mocked(prisma.reminderLog.findMany).mockResolvedValueOnce([
            { reviewerGithub: 'alice', sentAt: recentDate }
        ] as never);

        const req = new NextRequest(
            'http://localhost/api/reminders/cooldown?recipients=alice&prNumber=42&repo=org/repo'
        );
        const res = await GET(req);
        const body = await res.json();

        expect(body.data[0].login).toBe('alice');
        expect(body.data[0].allowed).toBe(false);
        expect(body.data[0].remainingSeconds).toBeGreaterThan(0);
    });

    it('returns 400 when recipients missing', async () => {
        const req = new NextRequest('http://localhost/api/reminders/cooldown?prNumber=42&repo=org/repo');
        const res = await GET(req);

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when prNumber missing', async () => {
        const req = new NextRequest('http://localhost/api/reminders/cooldown?recipients=alice&repo=org/repo');
        const res = await GET(req);

        expect(res.status).toBe(400);
    });

    it('returns 400 when repo missing', async () => {
        const req = new NextRequest('http://localhost/api/reminders/cooldown?recipients=alice&prNumber=42');
        const res = await GET(req);

        expect(res.status).toBe(400);
    });

    it('returns 400 when recipients are empty after split', async () => {
        const req = new NextRequest('http://localhost/api/reminders/cooldown?recipients=&prNumber=42&repo=org/repo');
        const res = await GET(req);

        expect(res.status).toBe(400);
    });

    it('caps recipients to MAX_RECIPIENTS', async () => {
        vi.mocked(prisma.reminderLog.findMany).mockResolvedValueOnce([]);
        const many = Array.from({ length: 60 }, (_, i) => `user${i}`).join(',');

        const req = new NextRequest(
            `http://localhost/api/reminders/cooldown?recipients=${many}&prNumber=42&repo=org/repo`
        );
        const res = await GET(req);
        const body = await res.json();

        // capped to 50
        expect(body.data.length).toBe(50);
    });

    it('returns 500 on DB error', async () => {
        vi.mocked(prisma.reminderLog.findMany).mockRejectedValueOnce(new Error('DB down'));

        const req = new NextRequest(
            'http://localhost/api/reminders/cooldown?recipients=alice&prNumber=42&repo=org/repo'
        );
        const res = await GET(req);

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
    });
});
