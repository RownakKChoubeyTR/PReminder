import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-utils', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    messageTemplate: { findUnique: vi.fn() },
    integrationConfig: { findMany: vi.fn() },
    reminderLog: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/db/encryption', () => ({
  decrypt: vi.fn((v: string) => v.replace('ENC:', '')),
}));

vi.mock('@/lib/email/resolve', () => ({
  resolveRecipientEmail: vi.fn(),
}));

vi.mock('@/lib/teams/power-automate', () => ({
  sendTeamsDM: vi.fn(),
  sendTeamsChannelMessage: vi.fn(),
}));

vi.mock('@/lib/teams/deeplink', () => ({
  buildTeamsDMDeepLink: vi.fn(() => 'https://teams.microsoft.com/l/chat/0/0?users=test@corp.com'),
}));

vi.mock('@/lib/templates/engine', () => ({
  renderTemplate: vi.fn((_tpl: string, _ctx: unknown) => 'Rendered message'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
}));

import { authenticateUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db/prisma';
import { resolveRecipientEmail } from '@/lib/email/resolve';
import { sendTeamsDM, sendTeamsChannelMessage } from '@/lib/teams/power-automate';
import { POST } from '@/app/api/reminders/send/route';

const mockUser = { id: 'user-1', githubLogin: 'testuser', email: 'test@corp.com', accessToken: 'gho_test' };

const validBody = {
  recipients: ['alice'],
  pr: {
    number: 42,
    title: 'Add feature',
    url: 'https://github.com/org/repo/pull/42',
    repo: 'org/repo',
    branch: 'feat',
    targetBranch: 'main',
    age: 3,
    labels: ['enhancement'],
    description: 'Test PR',
  },
  templateId: 'tmpl-1',
  channel: 'TEAMS_DM',
};

const mockTemplate = { id: 'tmpl-1', body: 'Hello {{receiverName}}', subject: 'Reminder' };

beforeEach(() => {
  vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser });
  vi.mocked(prisma.messageTemplate.findUnique).mockResolvedValue(mockTemplate as never);
  vi.mocked(prisma.reminderLog.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.reminderLog.create).mockResolvedValue({} as never);
  vi.mocked(resolveRecipientEmail).mockResolvedValue({
    email: 'alice@corp.com', displayName: 'Alice', source: 'email_mapping',
  });
});

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/reminders/send', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/reminders/send', () => {
  it('sends TEAMS_DM successfully', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([
      { type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook' },
    ] as never);
    vi.mocked(sendTeamsDM).mockResolvedValueOnce({ success: true, statusCode: 200 });

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(body.results[0].status).toBe('SENT');
  });

  it('fails TEAMS_DM when no webhook configured (no fallback)', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([]);

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].channel).toBe('TEAMS_DM');
    expect(body.results[0].status).toBe('FAILED');
    expect(body.results[0].error).toContain('No Teams DM webhook');
  });

  it('sends TEAMS_CHANNEL successfully', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([
      { type: 'TEAMS_WEBHOOK', encryptedValue: 'ENC:https://example.com/chan' },
    ] as never);
    vi.mocked(sendTeamsChannelMessage).mockResolvedValueOnce({ success: true, statusCode: 200 });

    const channelBody = { ...validBody, channel: 'TEAMS_CHANNEL' };
    const res = await POST(makeReq(channelBody));
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(body.results[0].channel).toBe('TEAMS_CHANNEL');
  });

  it('fails TEAMS_CHANNEL when no webhook configured', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([]);

    const channelBody = { ...validBody, channel: 'TEAMS_CHANNEL' };
    const res = await POST(makeReq(channelBody));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].status).toBe('FAILED');
    expect(body.results[0].error).toContain('No Teams channel webhook');
  });

  it('rejects DEEP_LINK channel (not in schema)', async () => {
    const dlBody = { ...validBody, channel: 'DEEP_LINK' };
    const res = await POST(makeReq(dlBody));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects EMAIL channel (not in schema)', async () => {
    const emailBody = { ...validBody, channel: 'EMAIL' };
    const res = await POST(makeReq(emailBody));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('sends despite recent reminder log (cooldown disabled)', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([
      { type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook' },
    ] as never);
    vi.mocked(prisma.reminderLog.findFirst).mockResolvedValueOnce({
      sentAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    } as never);
    vi.mocked(sendTeamsDM).mockResolvedValueOnce({ success: true, statusCode: 200 });

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(body.results[0].status).toBe('SENT');
  });

  it('fails TEAMS_DM when no email mapping', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([
      { type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook' },
    ] as never);
    vi.mocked(resolveRecipientEmail).mockResolvedValueOnce({
      email: null, displayName: 'alice', source: null,
      reason: 'No public email on GitHub profile for "alice".',
    });

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].error).toContain('No public email');
  });

  it('returns 404 when template not found', async () => {
    vi.mocked(prisma.messageTemplate.findUnique).mockResolvedValueOnce(null);

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/reminders/send', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_BODY');
  });

  it('returns 400 for validation errors', async () => {
    const res = await POST(makeReq({ recipients: [], pr: {}, templateId: '', channel: 'INVALID' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('handles multiple recipients', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([
      { type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook' },
    ] as never);
    vi.mocked(sendTeamsDM)
      .mockResolvedValueOnce({ success: true, statusCode: 200 })
      .mockResolvedValueOnce({ success: false, statusCode: 500, error: 'API error' });
    vi.mocked(resolveRecipientEmail)
      .mockResolvedValueOnce({ email: 'alice@corp.com', displayName: 'Alice', source: 'email_mapping' })
      .mockResolvedValueOnce({ email: 'bob@corp.com', displayName: 'Bob', source: 'github_profile' });

    const multiBody = { ...validBody, recipients: ['alice', 'bob'] };
    const res = await POST(makeReq(multiBody));
    const body = await res.json();

    expect(body.total).toBe(2);
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
  });

  it('catches per-recipient exceptions', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([
      { type: 'POWER_AUTOMATE_DM', encryptedValue: 'ENC:https://example.com/hook' },
    ] as never);
    vi.mocked(prisma.reminderLog.findFirst).mockRejectedValueOnce(new Error('DB error'));

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].error).toBe('Internal error processing reminder');
  });
});
