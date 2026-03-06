// ─────────────────────────────────────────────────────────────
// Power Automate HTTP Trigger — Send Teams DM
// ─────────────────────────────────────────────────────────────
// Each user configures their own Power Automate flow that
// accepts an HTTP POST and sends a Teams DM. This module
// calls that webhook URL.
//
// Flow design:
//   HTTP trigger → Parse JSON → Post message in chat (Teams)
//
// @see docs/TEAMS-INTEGRATION.md

import https from 'node:https';

// Allow skipping TLS verification in dev or via explicit env var.
// Useful when a corporate proxy does SSL inspection with its own CA cert.
const skipTlsVerify =
  process.env.NODE_ENV === 'development' || process.env.WEBHOOK_SKIP_TLS_VERIFY === 'true';

// ── SSRF Protection ─────────────────────────────────────────

const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]',
]);

const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^10\.\d+\.\d+\.\d+$/,                     // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,     // 172.16.0.0/12
  /^192\.168\.\d+\.\d+$/,                     // 192.168.0.0/16
  /^169\.254\.\d+\.\d+$/,                     // link-local
  /\.local$/,
  /\.internal$/,
];

/**
 * Validate that a webhook URL is safe to call (HTTPS, no internal hosts).
 * Prevents SSRF attacks where a stored webhook targets internal infrastructure.
 */
export function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname)) return false;
    if (BLOCKED_HOST_PATTERNS.some((p) => p.test(hostname))) return false;
    return true;
  } catch {
    return false;
  }
}

// ── Types ───────────────────────────────────────────────────

export interface PowerAutomatePayload {
  /** The recipient's Microsoft 365 / Teams email address (one call per recipient). */
  recipientEmail: string;
  message: string;
  /** Required — Power Automate's SendEmailV3 action rejects null/missing subjects. */
  subject: string;
}

export interface PowerAutomateResult {
  success: boolean;
  statusCode: number;
  error?: string;
}

// ── Message normalisation ────────────────────────────────────

/**
 * Prepare a message body for Teams delivery via Power Automate.
 *
 * Templates are stored as plain text with `\n` line breaks. PA's
 * SendEmailV3 action renders the body as HTML, so bare `\n` is
 * invisible. This function:
 *   1. Strips any outer block-level HTML wrapper (e.g. Lexical's
 *      `<p class="editor-paragraph">…</p>`) that may have been
 *      saved by the template editor.
 *   2. Converts remaining `\n` characters to `<br>` so line breaks
 *      render correctly in the Teams message.
 */
export function normalizeMessageBody(body: string): string {
  // Strip a single wrapping <p ...>…</p> if that's the whole content
  const stripped = body.trim().replace(/^<p[^>]*>([\s\S]*)<\/p>$/i, '$1').trim();
  // Convert newlines to <br> for HTML rendering
  const withBreaks = stripped.replace(/\n/g, '<br>');
  // Convert bare URLs to clickable anchor tags (template stores plain text URLs)
  return withBreaks.replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1">$1</a>');
}

// ── HTTPS POST helper (with optional TLS bypass) ────────────

interface HttpsPostResult {
  statusCode: number;
  body: string;
  ok: boolean;
}

/**
 * POST JSON to an HTTPS URL using node:https directly.
 * This allows setting `rejectUnauthorized` per-request without
 * affecting the global Node.js TLS settings.
 */
function httpsPost(
  url: string,
  jsonBody: string,
  timeoutMs = 30_000,
): Promise<HttpsPostResult> {
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
          'Content-Length': Buffer.byteLength(jsonBody),
        },
        rejectUnauthorized: !skipTlsVerify,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const statusCode = res.statusCode ?? 0;
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            statusCode,
            body,
            ok: statusCode >= 200 && statusCode < 300,
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.write(jsonBody);
    req.end();
  });
}

/**
 * Send a Teams DM via a user's Power Automate HTTP trigger.
 *
 * @param webhookUrl - The HTTP POST URL from the user's Power Automate flow
 * @param payload    - Recipient email + message body
 * @param timeoutMs  - Request timeout in milliseconds (default: 30s)
 */
export async function sendTeamsDM(
  webhookUrl: string,
  payload: PowerAutomatePayload,
  timeoutMs = 30_000,
): Promise<PowerAutomateResult> {
  // Reject internal/private URLs to prevent SSRF
  if (!isAllowedWebhookUrl(webhookUrl)) {
    return {
      success: false,
      statusCode: 0,
      error: 'Webhook URL must be HTTPS and must not target internal/private hosts',
    };
  }

  try {
    const normalizedPayload: PowerAutomatePayload = {
      ...payload,
      message: normalizeMessageBody(payload.message),
    };
    const res = await httpsPost(webhookUrl, JSON.stringify(normalizedPayload), timeoutMs);

    if (res.ok || res.statusCode === 202) {
      return { success: true, statusCode: res.statusCode };
    }

    return {
      success: false,
      statusCode: res.statusCode,
      error: `Power Automate returned ${res.statusCode}: ${res.body}`.slice(0, 500),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('timed out')) {
      return {
        success: false,
        statusCode: 0,
        error: `Request timed out after ${timeoutMs}ms`,
      };
    }

    return {
      success: false,
      statusCode: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send a message to a Teams channel via Incoming Webhook.
 *
 * @param webhookUrl - The Incoming Webhook URL for the channel
 * @param title      - Card title
 * @param message    - Card body text
 * @param prUrl      - Link to the PR (added as action button)
 */
export async function sendTeamsChannelMessage(
  webhookUrl: string,
  title: string,
  message: string,
  prUrl: string,
): Promise<PowerAutomateResult> {
  const adaptiveCard = {
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
              text: title,
              weight: 'Bolder',
              size: 'Medium',
            },
            {
              type: 'TextBlock',
              text: message,
              wrap: true,
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'View Pull Request',
              url: prUrl,
            },
          ],
        },
      },
    ],
  };

  try {
    const res = await httpsPost(webhookUrl, JSON.stringify(adaptiveCard));

    return {
      success: res.ok,
      statusCode: res.statusCode,
      error: res.ok ? undefined : `Webhook returned ${res.statusCode}`,
    };
  } catch (err) {
    return {
      success: false,
      statusCode: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
