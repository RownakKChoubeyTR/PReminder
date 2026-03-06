import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';

// ─────────────────────────────────────────────────────────────
// Tests: /api/integrations routes
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-utils', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    integrationConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/encryption', () => ({
  encrypt: vi.fn((v: string) => `ENC:${v}`),
  decrypt: vi.fn((v: string) => v.replace('ENC:', '')),
}));

vi.mock('@/lib/teams/power-automate', () => ({
  isAllowedWebhookUrl: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

// Mock node:https for the PATCH connectivity test
const mockHttpsRequest = vi.fn();
vi.mock('node:https', () => ({
  default: { request: (...args: unknown[]) => mockHttpsRequest(...args) },
}));

import { authenticateUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db/prisma';
import { isAllowedWebhookUrl } from '@/lib/teams/power-automate';
import { GET, POST, PUT, DELETE, PATCH } from '@/app/api/integrations/route';

const mockUser = { id: 'user-1', githubLogin: 'testuser', email: 'test@corp.com', accessToken: 'gho_test' };
const mockFetch = vi.fn();

/**
 * Helper: simulate a successful https.request with a given status code and body.
 */
function mockHttpsSuccess(statusCode: number, responseBody = '') {
  mockHttpsRequest.mockImplementation((_opts: unknown, callback: (res: IncomingMessage) => void) => {
    const fakeReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
    fakeReq.write = vi.fn();
    fakeReq.end = vi.fn();
    fakeReq.destroy = vi.fn();

    // Schedule callback on next tick so the request listeners are attached first
    process.nextTick(() => {
      const fakeRes = new EventEmitter() as EventEmitter & { statusCode: number };
      fakeRes.statusCode = statusCode;
      callback(fakeRes as unknown as IncomingMessage);
      fakeRes.emit('data', Buffer.from(responseBody));
      fakeRes.emit('end');
    });

    return fakeReq;
  });
}

/**
 * Helper: simulate a failed https.request (emits 'error' on the request).
 */
function mockHttpsError(error: Error) {
  mockHttpsRequest.mockImplementation(() => {
    const fakeReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
    fakeReq.write = vi.fn();
    fakeReq.end = vi.fn();
    fakeReq.destroy = vi.fn();

    process.nextTick(() => {
      fakeReq.emit('error', error);
    });

    return fakeReq;
  });
}

beforeEach(() => {
  vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser });
  vi.mocked(isAllowedWebhookUrl).mockReturnValue(true);
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/integrations', () => {
  it('returns user integrations', async () => {
    const configs = [{ id: '1', type: 'POWER_AUTOMATE_DM', label: 'My Flow', isActive: true }];
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce(configs as never);

    const res = await GET();
    const body = await res.json();

    expect(body.data).toEqual(configs);
  });
});

describe('POST /api/integrations', () => {
  it('creates integration with valid input', async () => {
    const created = { id: '2', type: 'TEAMS_WEBHOOK', label: 'Channel', isActive: true };
    vi.mocked(prisma.integrationConfig.create).mockResolvedValueOnce(created as never);

    const req = new NextRequest('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'TEAMS_WEBHOOK',
        label: 'Channel',
        value: 'https://example.com/webhook',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('rejects invalid webhook URL (SSRF)', async () => {
    vi.mocked(isAllowedWebhookUrl).mockReturnValueOnce(false);

    const req = new NextRequest('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'TEAMS_WEBHOOK',
        label: 'Bad',
        value: 'https://localhost/hook',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('INVALID_URL');
  });

  it('returns 400 for validation errors', async () => {
    const req = new NextRequest('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ type: 'INVALID', label: '', value: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/integrations', {
      method: 'POST',
      body: 'not json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/integrations', () => {
  it('updates integration', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1',
    } as never);
    vi.mocked(prisma.integrationConfig.update).mockResolvedValueOnce({
      id: '1', label: 'Updated',
    } as never);

    const req = new NextRequest('http://localhost/api/integrations?id=1', {
      method: 'PUT',
      body: JSON.stringify({ label: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req);
    const body = await res.json();
    expect(body.data.label).toBe('Updated');
  });

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/integrations', {
      method: 'PUT',
      body: JSON.stringify({ label: 'X' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-owned integration', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'other-user',
    } as never);

    const req = new NextRequest('http://localhost/api/integrations?id=1', {
      method: 'PUT',
      body: JSON.stringify({ label: 'X' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req);
    expect(res.status).toBe(404);
  });

  it('rejects SSRF on value update', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1',
    } as never);
    vi.mocked(isAllowedWebhookUrl).mockReturnValueOnce(false);

    const req = new NextRequest('http://localhost/api/integrations?id=1', {
      method: 'PUT',
      body: JSON.stringify({ value: 'https://localhost/bad' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/integrations', () => {
  it('deletes owned integration', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1',
    } as never);
    vi.mocked(prisma.integrationConfig.delete).mockResolvedValueOnce({} as never);

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'DELETE' });
    const res = await DELETE(req);
    const body = await res.json();

    expect(body.success).toBe(true);
  });

  it('returns 400 when id missing', async () => {
    const req = new NextRequest('http://localhost/api/integrations', { method: 'DELETE' });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent integration', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'DELETE' });
    const res = await DELETE(req);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/integrations (test connectivity)', () => {
  it('returns success on OK response', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1', encryptedValue: 'ENC:https://example.com/hook',
    } as never);
    mockHttpsSuccess(200);

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'PATCH' });
    const res = await PATCH(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.statusCode).toBe(200);
  });

  it('returns success on 202 response', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1', encryptedValue: 'ENC:https://example.com/hook',
    } as never);
    mockHttpsSuccess(202);

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'PATCH' });
    const res = await PATCH(req);
    const body = await res.json();

    expect(body.success).toBe(true);
  });

  it('returns failure on DNS error', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1', type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook',
    } as never);
    mockHttpsError(new Error('getaddrinfo ENOTFOUND example.com'));

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'PATCH' });
    const res = await PATCH(req);
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.error).toContain('DNS lookup failed');
  });

  it('classifies SSL/TLS errors', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1', type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook',
    } as never);
    mockHttpsError(new Error('unable to verify the first certificate'));

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'PATCH' });
    const res = await PATCH(req);
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.error).toContain('SSL/TLS error');
  });

  it('classifies connection refused errors', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1', type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook',
    } as never);
    mockHttpsError(new Error('connect ECONNREFUSED 1.2.3.4:443'));

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'PATCH' });
    const res = await PATCH(req);
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.error).toContain('Connection refused');
  });

  it('returns descriptive error for HTTP 404', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1', type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook',
    } as never);
    mockHttpsSuccess(404, 'Not Found');

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'PATCH' });
    const res = await PATCH(req);
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(404);
    expect(body.error).toContain('Power Automate flow');
  });

  it('returns decrypt error when encryption key is wrong', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'user-1', type: 'POWER_AUTOMATE_DM', encryptedValue: 'bad-data',
    } as never);
    const { decrypt } = await import('@/lib/db/encryption');
    vi.mocked(decrypt).mockImplementationOnce(() => { throw new Error('Invalid encrypted value'); });

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'PATCH' });
    const res = await PATCH(req);
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.error).toContain('could not be decrypted');
  });

  it('returns 400 when id missing', async () => {
    const req = new NextRequest('http://localhost/api/integrations', { method: 'PATCH' });
    const res = await PATCH(req);

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-owned config', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValueOnce({
      id: '1', userId: 'other-user',
    } as never);

    const req = new NextRequest('http://localhost/api/integrations?id=1', { method: 'PATCH' });
    const res = await PATCH(req);

    expect(res.status).toBe(404);
  });
});
