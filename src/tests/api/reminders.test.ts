import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-utils', () => ({
    authenticateUser: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
    prisma: {
        reminderLog: {
            findMany: vi.fn(),
            count: vi.fn()
        }
    }
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import { GET } from '@/app/api/reminders/route';
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

describe('GET /api/reminders', () => {
    it('returns paginated reminder logs', async () => {
        const logs = [{ id: '1', reviewerGithub: 'alice', status: 'SENT', sentAt: new Date() }];
        vi.mocked(prisma.reminderLog.findMany).mockResolvedValueOnce(logs as never);
        vi.mocked(prisma.reminderLog.count).mockResolvedValueOnce(1);

        const req = new NextRequest('http://localhost/api/reminders?page=1&per_page=20');
        const res = await GET(req);
        const body = await res.json();

        expect(body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: '1' })]));
        expect(body.total).toBe(1);
        expect(body.page).toBe(1);
        expect(body.perPage).toBe(20);
        expect(body.hasNextPage).toBe(false);
    });

    it('defaults page=1 and perPage=20', async () => {
        vi.mocked(prisma.reminderLog.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.reminderLog.count).mockResolvedValueOnce(0);

        const req = new NextRequest('http://localhost/api/reminders');
        const res = await GET(req);
        const body = await res.json();

        expect(body.page).toBe(1);
        expect(body.perPage).toBe(20);
    });

    it('clamps invalid page/perPage', async () => {
        vi.mocked(prisma.reminderLog.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.reminderLog.count).mockResolvedValueOnce(0);

        const req = new NextRequest('http://localhost/api/reminders?page=-5&per_page=999');
        const res = await GET(req);
        const body = await res.json();

        expect(body.page).toBe(1);
        expect(body.perPage).toBe(100);
    });

    it('returns hasNextPage=true when more results exist', async () => {
        vi.mocked(prisma.reminderLog.findMany).mockResolvedValueOnce(
            Array.from({ length: 20 }, (_, i) => ({ id: String(i) })) as never
        );
        vi.mocked(prisma.reminderLog.count).mockResolvedValueOnce(50);

        const req = new NextRequest('http://localhost/api/reminders?page=1&per_page=20');
        const res = await GET(req);
        const body = await res.json();

        expect(body.hasNextPage).toBe(true);
    });

    it('returns 401 when unauthenticated', async () => {
        const { NextResponse: NR } = await import('next/server');
        vi.mocked(authenticateUser).mockResolvedValueOnce({
            error: NR.json({ error: 'Unauthorized' }, { status: 401 })
        });

        const req = new NextRequest('http://localhost/api/reminders');
        const res = await GET(req);

        expect(res.status).toBe(401);
    });

    it('returns 500 on DB error', async () => {
        vi.mocked(prisma.reminderLog.findMany).mockRejectedValueOnce(new Error('DB down'));
        vi.mocked(prisma.reminderLog.count).mockRejectedValueOnce(new Error('DB down'));

        const req = new NextRequest('http://localhost/api/reminders?page=1');
        const res = await GET(req);

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
    });
});
