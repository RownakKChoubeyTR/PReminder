import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: /api/email-mappings routes
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-utils', () => ({
    authenticateUser: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
    prisma: {
        emailMapping: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            upsert: vi.fn(),
            delete: vi.fn()
        }
    }
}));

import { DELETE } from '@/app/api/email-mappings/[id]/route';
import { GET, POST } from '@/app/api/email-mappings/route';
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
    vi.mocked(prisma.emailMapping.findMany).mockReset();
    vi.mocked(prisma.emailMapping.upsert).mockReset();
    vi.mocked(prisma.emailMapping.findUnique).mockReset();
    vi.mocked(prisma.emailMapping.delete).mockReset();
});

describe('GET /api/email-mappings', () => {
    it('returns user mappings', async () => {
        const mappings = [
            {
                id: '1',
                githubUsername: 'alice',
                email: 'alice@corp.com',
                displayName: null,
                source: 'manual'
            }
        ];
        vi.mocked(prisma.emailMapping.findMany).mockResolvedValueOnce(mappings as never);

        const res = await GET();
        const body = await res.json();

        expect(body.data).toEqual(mappings);
    });

    it('returns 401 when not authenticated', async () => {
        vi.mocked(authenticateUser).mockResolvedValueOnce({
            error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        });

        const res = await GET();
        expect(res.status).toBe(401);
    });
});

describe('POST /api/email-mappings', () => {
    it('creates mapping with valid input (upsert)', async () => {
        const mapping = {
            id: 'm1',
            githubUsername: 'alice',
            email: 'alice@corp.com',
            displayName: 'Alice',
            source: 'manual'
        };
        vi.mocked(prisma.emailMapping.upsert).mockResolvedValueOnce(mapping as never);

        const req = new NextRequest('http://localhost/api/email-mappings', {
            method: 'POST',
            body: JSON.stringify({
                githubUsername: 'alice',
                email: 'alice@corp.com',
                displayName: 'Alice'
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.data.email).toBe('alice@corp.com');
    });

    it('returns 400 for invalid email', async () => {
        const req = new NextRequest('http://localhost/api/email-mappings', {
            method: 'POST',
            body: JSON.stringify({ githubUsername: 'alice', email: 'not-an-email' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('returns 400 for missing githubUsername', async () => {
        const req = new NextRequest('http://localhost/api/email-mappings', {
            method: 'POST',
            body: JSON.stringify({ email: 'alice@corp.com' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid JSON', async () => {
        const req = new NextRequest('http://localhost/api/email-mappings', {
            method: 'POST',
            body: 'not json'
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/email-mappings/[id]', () => {
    const routeParams = { params: Promise.resolve({ id: 'm1' }) };

    it('deletes owned mapping', async () => {
        vi.mocked(prisma.emailMapping.findUnique).mockResolvedValueOnce({
            id: 'm1',
            userId: 'user-1'
        } as never);
        vi.mocked(prisma.emailMapping.delete).mockResolvedValueOnce({} as never);

        const req = new Request('http://localhost/api/email-mappings/m1', { method: 'DELETE' });
        const res = await DELETE(req, routeParams);
        const body = await res.json();

        expect(body.success).toBe(true);
    });

    it('returns 404 for non-existent mapping', async () => {
        vi.mocked(prisma.emailMapping.findUnique).mockResolvedValueOnce(null);

        const req = new Request('http://localhost/api/email-mappings/m1', { method: 'DELETE' });
        const res = await DELETE(req, routeParams);

        expect(res.status).toBe(404);
    });

    it('returns 404 for mapping owned by another user', async () => {
        vi.mocked(prisma.emailMapping.findUnique).mockResolvedValueOnce({
            id: 'm1',
            userId: 'other-user'
        } as never);

        const req = new Request('http://localhost/api/email-mappings/m1', { method: 'DELETE' });
        const res = await DELETE(req, routeParams);

        expect(res.status).toBe(404);
    });
});
