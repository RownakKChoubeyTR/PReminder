import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';

// Mock node:https before importing the module under test
const mockHttpsRequest = vi.fn();
vi.mock('node:https', () => ({
  default: { request: (...args: unknown[]) => mockHttpsRequest(...args) },
}));

import {
  isAllowedWebhookUrl,
  sendTeamsDM,
  sendTeamsChannelMessage,
} from '@/lib/teams/power-automate';

// ── Test helpers ─────────────────────────────────────────────

/** Simulate a successful https.request that returns given status + body. */
function mockHttpsSuccess(statusCode: number, responseBody = '') {
  mockHttpsRequest.mockImplementation((_opts: unknown, callback: (res: IncomingMessage) => void) => {
    const fakeReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
    fakeReq.write = vi.fn();
    fakeReq.end = vi.fn();
    fakeReq.destroy = vi.fn();

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

/** Simulate a failed https.request (emits 'error' on the request). */
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

/** Simulate a timeout (emits 'timeout' then error on the request). */
function mockHttpsTimeout() {
  mockHttpsRequest.mockImplementation(() => {
    const fakeReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
    fakeReq.write = vi.fn();
    fakeReq.end = vi.fn();
    fakeReq.destroy = vi.fn();

    process.nextTick(() => {
      fakeReq.emit('timeout');
    });

    return fakeReq;
  });
}

// ─────────────────────────────────────────────────────────────
// Tests: Power Automate webhook integration
// ─────────────────────────────────────────────────────────────

describe('isAllowedWebhookUrl', () => {
  it('allows valid HTTPS URLs', () => {
    expect(isAllowedWebhookUrl('https://prod-10.westus.logic.azure.com/workflows/abc')).toBe(true);
    expect(isAllowedWebhookUrl('https://example.com/webhook')).toBe(true);
  });

  it('rejects HTTP (non-HTTPS) URLs', () => {
    expect(isAllowedWebhookUrl('http://example.com/webhook')).toBe(false);
  });

  it('rejects localhost', () => {
    expect(isAllowedWebhookUrl('https://localhost/hook')).toBe(false);
    expect(isAllowedWebhookUrl('https://127.0.0.1/hook')).toBe(false);
    expect(isAllowedWebhookUrl('https://0.0.0.0/hook')).toBe(false);
    expect(isAllowedWebhookUrl('https://[::1]/hook')).toBe(false);
  });

  it('rejects private IP ranges (10.x, 172.16-31.x, 192.168.x)', () => {
    expect(isAllowedWebhookUrl('https://10.0.0.1/hook')).toBe(false);
    expect(isAllowedWebhookUrl('https://10.255.255.255/hook')).toBe(false);
    expect(isAllowedWebhookUrl('https://172.16.0.1/hook')).toBe(false);
    expect(isAllowedWebhookUrl('https://172.31.255.255/hook')).toBe(false);
    expect(isAllowedWebhookUrl('https://192.168.1.1/hook')).toBe(false);
  });

  it('rejects link-local (169.254.x.x)', () => {
    expect(isAllowedWebhookUrl('https://169.254.1.1/hook')).toBe(false);
  });

  it('rejects .local and .internal domains', () => {
    expect(isAllowedWebhookUrl('https://server.local/hook')).toBe(false);
    expect(isAllowedWebhookUrl('https://app.internal/hook')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isAllowedWebhookUrl('not-a-url')).toBe(false);
    expect(isAllowedWebhookUrl('')).toBe(false);
  });

  it('allows 172.x outside of 16-31 range', () => {
    expect(isAllowedWebhookUrl('https://172.15.0.1/hook')).toBe(true);
    expect(isAllowedWebhookUrl('https://172.32.0.1/hook')).toBe(true);
  });
});

describe('sendTeamsDM', () => {
  const validUrl = 'https://prod-10.westus.logic.azure.com/workflows/abc';
  const payload = {
    recipientEmail: 'test@example.com',
    message: 'Please review PR #42',
    subject: 'Review Needed',
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends successfully when API returns 200', async () => {
    mockHttpsSuccess(200);

    const result = await sendTeamsDM(validUrl, payload);

    expect(result).toEqual({ success: true, statusCode: 200 });
    expect(mockHttpsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'prod-10.westus.logic.azure.com',
        method: 'POST',
      }),
      expect.any(Function),
    );
  });

  it('sends successfully when API returns 202 (accepted)', async () => {
    mockHttpsSuccess(202);

    const result = await sendTeamsDM(validUrl, payload);
    expect(result).toEqual({ success: true, statusCode: 202 });
  });

  it('returns failure when API returns error', async () => {
    mockHttpsSuccess(400, 'Bad Request');

    const result = await sendTeamsDM(validUrl, payload);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.error).toContain('400');
    expect(result.error).toContain('Bad Request');
  });

  it('rejects internal/private webhook URLs (SSRF)', async () => {
    const result = await sendTeamsDM('https://localhost/hook', payload);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0);
    expect(result.error).toMatch(/SSRF|internal|private/i);
    expect(mockHttpsRequest).not.toHaveBeenCalled();
  });

  it('handles network errors', async () => {
    mockHttpsError(new Error('Connection refused'));

    const result = await sendTeamsDM(validUrl, payload);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0);
    expect(result.error).toBe('Connection refused');
  });

  it('handles timeout', async () => {
    mockHttpsTimeout();

    const result = await sendTeamsDM(validUrl, payload, 100);

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });

  it('handles non-Error thrown objects', async () => {
    mockHttpsRequest.mockImplementation(() => {
      const fakeReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
      fakeReq.write = vi.fn();
      fakeReq.end = vi.fn();
      fakeReq.destroy = vi.fn();
      process.nextTick(() => {
        fakeReq.emit('error', 'string error');
      });
      return fakeReq;
    });

    const result = await sendTeamsDM(validUrl, payload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });

  it('truncates long error messages to 500 chars', async () => {
    const longBody = 'X'.repeat(600);
    mockHttpsSuccess(500, longBody);

    const result = await sendTeamsDM(validUrl, payload);

    expect(result.error!.length).toBeLessThanOrEqual(500);
  });
});

describe('sendTeamsChannelMessage', () => {
  const webhookUrl = 'https://outlook.office.com/webhook/abc';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends adaptive card and returns success', async () => {
    mockHttpsSuccess(200);

    const result = await sendTeamsChannelMessage(
      webhookUrl,
      'PR Reminder',
      'Please review PR #42',
      'https://github.com/org/repo/pull/42',
    );

    expect(result).toEqual({ success: true, statusCode: 200 });

    // Verify the JSON body written to the request
    const fakeReq = mockHttpsRequest.mock.results[0]!.value;
    const writtenBody = fakeReq.write.mock.calls[0]![0] as string;
    const body = JSON.parse(writtenBody);
    expect(body.type).toBe('message');
    expect(body.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(body.attachments[0].content.body[0].text).toBe('PR Reminder');
    expect(body.attachments[0].content.body[1].text).toBe('Please review PR #42');
    expect(body.attachments[0].content.actions[0].url).toBe(
      'https://github.com/org/repo/pull/42',
    );
  });

  it('returns failure on non-OK response', async () => {
    mockHttpsSuccess(403);

    const result = await sendTeamsChannelMessage(webhookUrl, 'T', 'M', 'U');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.error).toContain('403');
  });

  it('handles network error', async () => {
    mockHttpsError(new Error('DNS resolution failed'));

    const result = await sendTeamsChannelMessage(webhookUrl, 'T', 'M', 'U');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0);
    expect(result.error).toBe('DNS resolution failed');
  });

  it('handles non-Error thrown object', async () => {
    mockHttpsRequest.mockImplementation(() => {
      const fakeReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
      fakeReq.write = vi.fn();
      fakeReq.end = vi.fn();
      fakeReq.destroy = vi.fn();
      process.nextTick(() => {
        fakeReq.emit('error', 42);
      });
      return fakeReq;
    });

    const result = await sendTeamsChannelMessage(webhookUrl, 'T', 'M', 'U');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });
});
