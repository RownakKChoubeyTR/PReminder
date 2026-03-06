import { authenticateUser } from '@/lib/auth-utils';
import { isAllowedWebhookUrl } from '@/lib/teams/power-automate';
import { createLogger } from '@/lib/logger';
import https from 'node:https';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createLogger('api/integrations/test');
const skipTlsVerify = process.env.WEBHOOK_SKIP_TLS_VERIFY === 'true';

const testSchema = z.object({
  url: z.string().trim().url('Must be a valid URL'),
  type: z.enum(['POWER_AUTOMATE_DM', 'TEAMS_WEBHOOK']).default('POWER_AUTOMATE_DM'),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateUser();
  if (auth.error) return auth.error;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const parsed = testSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { url, type } = parsed.data;

  // SSRF protection — must be HTTPS and not an internal/private host
  if (!isAllowedWebhookUrl(url)) {
    return NextResponse.json(
      { error: 'URL must be HTTPS and must not target internal hosts', code: 'INVALID_URL' },
      { status: 400 },
    );
  }

  const testPayload =
    type === 'POWER_AUTOMATE_DM'
      ? JSON.stringify({
          recipientEmail: 'test@example.com',
          subject: 'PReminder Connectivity Test',
          message: 'This is an automated connectivity test from PReminder — please ignore.',
        })
      : JSON.stringify({
          type: 'message',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: {
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.4',
                body: [
                  {
                    type: 'TextBlock',
                    text: 'PReminder connectivity test — please ignore.',
                    wrap: true,
                  },
                ],
              },
            },
          ],
        });

  try {
    const res = await webhookTestPost(url, testPayload);

    if (!res.ok && res.statusCode !== 202) {
      log.warn('Test webhook returned non-success status', { url, statusCode: res.statusCode, body: res.body.slice(0, 500) });
    }

    const success = res.ok || res.statusCode === 202;

    return NextResponse.json({
      success,
      statusCode: res.statusCode,
      ...(!success && { error: classifyHttpError(res.statusCode, type) }),
    });
  } catch (err) {
    const detail = classifyFetchError(err);
    log.error('Connectivity test failed', err, { url, errorType: detail.errorType, hint: detail.hint });
    return NextResponse.json({
      success: false,
      statusCode: 0,
      error: detail.message,
      hint: detail.hint,
    });
  }
}

// ── Low-level HTTPS POST ─────────────────────────────────────

interface PostResult {
  ok: boolean;
  statusCode: number;
  body: string;
}

function webhookTestPost(url: string, body: string, timeoutMs = 10_000): Promise<PostResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        rejectUnauthorized: !skipTlsVerify,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const statusCode = res.statusCode ?? 0;
          resolve({
            ok: statusCode >= 200 && statusCode < 300,
            statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Connection timed out');
      err.name = 'TimeoutError';
      reject(err);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Error helpers ────────────────────────────────────────────

function classifyFetchError(err: unknown): { message: string; errorType: string; hint: string } {
  if (!(err instanceof Error)) {
    return { message: 'Connection failed — unknown error', errorType: 'unknown', hint: '' };
  }
  const root = err.cause instanceof Error ? err.cause : err;
  const msg = root.message.toLowerCase();
  const name = root.name.toLowerCase();

  if (name === 'timeouterror' || name === 'aborterror' || msg.includes('timed out') || msg.includes('timeout')) {
    return {
      message: 'Connection timed out after 10 seconds',
      errorType: 'timeout',
      hint: 'The webhook URL did not respond within 10s. Check that the Power Automate flow is enabled.',
    };
  }
  if (msg.includes('getaddrinfo') || msg.includes('enotfound') || msg.includes('dns')) {
    return {
      message: 'DNS lookup failed — the webhook hostname could not be resolved',
      errorType: 'dns',
      hint: 'Verify the URL is correct and DNS is reachable.',
    };
  }
  if (msg.includes('econnrefused')) {
    return {
      message: 'Connection refused by the server',
      errorType: 'connection_refused',
      hint: 'The flow may be disabled or the URL is invalid.',
    };
  }
  if (msg.includes('ssl') || msg.includes('tls') || msg.includes('cert')) {
    return {
      message: 'SSL/TLS error — could not establish a secure connection',
      errorType: 'ssl',
      hint: 'Certificate verification failed.',
    };
  }
  return {
    message: `Connection failed: ${root.message}`,
    errorType: 'fetch_error',
    hint: `${root.name}: ${root.message}`,
  };
}

function classifyHttpError(status: number, type: string): string {
  switch (true) {
    case status === 401: return 'Unauthorized (401) — the webhook URL may have expired.';
    case status === 403: return 'Forbidden (403) — the flow trigger URL may have been regenerated.';
    case status === 404:
      return type === 'POWER_AUTOMATE_DM'
        ? 'Not Found (404) — the Power Automate flow may have been deleted.'
        : 'Not Found (404) — the Teams webhook URL may have been removed.';
    case status === 429: return 'Rate limited (429) — try again in a few minutes.';
    case status >= 500: return `Server error (${status}) — try again later.`;
    default: return `Unexpected status ${status} from webhook.`;
  }
}
