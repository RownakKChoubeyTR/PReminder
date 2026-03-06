import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Tests: /api/templates/[id] routes
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-utils', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    messageTemplate: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { authenticateUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db/prisma';

// We need to import directly — Next.js route params are passed as { params: Promise<{id}> }
import { GET, PUT, DELETE } from '@/app/api/templates/[id]/route';

const mockUser = { id: 'user-1', githubLogin: 'testuser', email: 'test@corp.com', accessToken: 'gho_test' };
const routeParams = { params: Promise.resolve({ id: 'tmpl-1' }) };

beforeEach(() => {
  vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser });
  vi.mocked(prisma.messageTemplate.findFirst).mockReset();
  vi.mocked(prisma.messageTemplate.delete).mockReset();
  vi.mocked(prisma.$transaction).mockReset();
});

describe('GET /api/templates/[id]', () => {
  it('returns the template when found', async () => {
    const template = { id: 'tmpl-1', name: 'Test', body: 'Hi', userId: 'user-1' };
    vi.mocked(prisma.messageTemplate.findFirst).mockResolvedValueOnce(template as never);

    const req = new Request('http://localhost/api/templates/tmpl-1');
    const res = await GET(req, routeParams);
    const body = await res.json();

    expect(body.data).toEqual(template);
  });

  it('returns 404 when not found', async () => {
    vi.mocked(prisma.messageTemplate.findFirst).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/templates/tmpl-1');
    const res = await GET(req, routeParams);

    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    vi.mocked(prisma.messageTemplate.findFirst).mockRejectedValueOnce(new Error('DB'));

    const req = new Request('http://localhost/api/templates/tmpl-1');
    const res = await GET(req, routeParams);

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/templates/[id]', () => {
  it('updates template with valid input', async () => {
    const updated = { id: 'tmpl-1', name: 'Updated', body: 'New body', type: 'TEAMS_DM' };
    vi.mocked(prisma.$transaction).mockResolvedValueOnce(updated as never);

    const req = new Request('http://localhost/api/templates/tmpl-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated', body: 'New body', type: 'TEAMS_DM' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req, routeParams);
    const body = await res.json();

    expect(body.data).toEqual(updated);
  });

  it('returns 404 when template not found in transaction', async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/templates/tmpl-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated', body: 'New body', type: 'TEAMS_DM' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req, routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/templates/tmpl-1', {
      method: 'PUT',
      body: 'not json',
    });

    const res = await PUT(req, routeParams);
    expect(res.status).toBe(400);
  });

  it('returns 400 for validation errors', async () => {
    const req = new Request('http://localhost/api/templates/tmpl-1', {
      method: 'PUT',
      body: JSON.stringify({ name: '', body: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req, routeParams);
    expect(res.status).toBe(400);
  });

  it('returns 500 on DB error during update', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('DB'));

    const req = new Request('http://localhost/api/templates/tmpl-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated', body: 'New body', type: 'TEAMS_DM' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req, routeParams);
    expect(res.status).toBe(500);
  });

  it('unsets other defaults when isDefault is true', async () => {
    const updated = { id: 'tmpl-1', name: 'Default', body: 'Body', type: 'TEAMS_DM', isDefault: true };

    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const tx = {
        messageTemplate: {
          findFirst: vi.fn().mockResolvedValue({ id: 'tmpl-1', userId: 'user-1' }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue(updated),
        },
      };
      return fn(tx as never);
    });

    const req = new Request('http://localhost/api/templates/tmpl-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Default', body: 'Body', type: 'TEAMS_DM', isDefault: true }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req, routeParams);
    const body = await res.json();
    expect(body.data.isDefault).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as never);

    const req = new Request('http://localhost/api/templates/tmpl-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New', body: 'Body', type: 'TEAMS_DM' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req, routeParams);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/templates/[id]', () => {
  it('deletes template when found and owned', async () => {
    vi.mocked(prisma.messageTemplate.findFirst).mockResolvedValueOnce({
      id: 'tmpl-1',
      userId: 'user-1',
    } as never);
    vi.mocked(prisma.messageTemplate.delete).mockResolvedValueOnce({} as never);

    const req = new Request('http://localhost/api/templates/tmpl-1', { method: 'DELETE' });
    const res = await DELETE(req, routeParams);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(prisma.messageTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tmpl-1' } });
  });

  it('returns 404 when template not found', async () => {
    vi.mocked(prisma.messageTemplate.findFirst).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/templates/tmpl-1', { method: 'DELETE' });
    const res = await DELETE(req, routeParams);

    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error during delete', async () => {
    vi.mocked(prisma.messageTemplate.findFirst).mockResolvedValueOnce({
      id: 'tmpl-1',
      userId: 'user-1',
    } as never);
    vi.mocked(prisma.messageTemplate.delete).mockRejectedValueOnce(new Error('DB'));

    const req = new Request('http://localhost/api/templates/tmpl-1', { method: 'DELETE' });
    const res = await DELETE(req, routeParams);

    expect(res.status).toBe(500);
  });
});
