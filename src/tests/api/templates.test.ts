import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Tests: /api/templates routes
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-utils', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    messageTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
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
import { GET, POST } from '@/app/api/templates/route';

const mockUser = { id: 'user-1', githubLogin: 'testuser', email: 'test@corp.com', accessToken: 'gho_test' };

beforeEach(() => {
  vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser });
  vi.mocked(prisma.messageTemplate.findMany).mockReset();
  vi.mocked(prisma.$transaction).mockReset();
});

describe('GET /api/templates', () => {
  it('returns user templates', async () => {
    const templates = [
      { id: '1', name: 'Default', body: 'Hello', type: 'TEAMS_DM', userId: 'user-1' },
    ];
    vi.mocked(prisma.messageTemplate.findMany).mockResolvedValueOnce(templates as never);

    const res = await GET();
    const body = await res.json();

    expect(body.data).toEqual(templates);
    expect(prisma.messageTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(prisma.messageTemplate.findMany).mockRejectedValueOnce(new Error('DB down'));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/templates', () => {
  it('creates a template with valid input', async () => {
    const created = { id: '2', name: 'Custom', body: 'Hi', type: 'TEAMS_DM', userId: 'user-1' };
    vi.mocked(prisma.$transaction).mockResolvedValueOnce(created as never);

    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name: 'Custom', body: 'Hi', channel: 'TEAMS_DM', type: 'TEAMS_DM' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(request);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.data).toEqual(created);
  });

  it('returns 400 for invalid JSON', async () => {
    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('INVALID_BODY');
  });

  it('returns 400 for validation errors', async () => {
    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name: '', body: '', type: 'INVALID' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 on database error during create', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('DB error'));

    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', body: 'Hello', type: 'TEAMS_DM' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(request);
    expect(res.status).toBe(500);
  });

  it('unsets other defaults when isDefault is true', async () => {
    const created = { id: '3', name: 'New Default', body: 'Hi', type: 'TEAMS_DM', isDefault: true };

    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const tx = {
        messageTemplate: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue(created),
        },
      };
      return fn(tx as never);
    });

    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Default', body: 'Hi', type: 'TEAMS_DM', isDefault: true }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(request);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.isDefault).toBe(true);
  });
});
