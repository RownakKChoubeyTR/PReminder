import { authenticateUser } from '@/lib/auth-utils';
import { decrypt, encrypt } from '@/lib/db/encryption';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';
import { isAllowedWebhookUrl } from '@/lib/teams/power-automate';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import https from 'node:https';
import { z } from 'zod';

const log = createLogger('api/integrations');

// Allow skipping TLS verification for webhook tests in dev or via explicit env var.
// Useful when a corporate proxy does SSL inspection with its own CA cert.
const skipTlsVerify = process.env.WEBHOOK_SKIP_TLS_VERIFY === 'true';

// ─────────────────────────────────────────────────────────────
// /api/integrations — CRUD for integration configs
// ─────────────────────────────────────────────────────────────

const createSchema = z.object({
    type: z.enum(['POWER_AUTOMATE_DM', 'TEAMS_WEBHOOK']),
    label: z.string().trim().min(1, 'Label is required').max(100),
    value: z.string().trim().url('Must be a valid URL')
});

const updateSchema = z.object({
    label: z.string().trim().min(1).max(100).optional(),
    value: z.string().trim().url().optional(),
    isActive: z.boolean().optional()
});

/** GET — list all integration configs for the current user. */
export async function GET() {
    const auth = await authenticateUser();
    if (auth.error) return auth.error;

    const configs = await prisma.integrationConfig.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            type: true,
            label: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
            // Never return encryptedValue
        }
    });

    return NextResponse.json({ data: configs });
}

/** POST — create a new integration config. */
export async function POST(request: NextRequest) {
    const auth = await authenticateUser();
    if (auth.error) return auth.error;

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const parsed = createSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: parsed.error.flatten().fieldErrors
            },
            { status: 400 }
        );
    }

    const { type, label, value } = parsed.data;

    // SSRF validation
    if (!isAllowedWebhookUrl(value)) {
        return NextResponse.json(
            { error: 'URL must be HTTPS and must not target internal hosts', code: 'INVALID_URL' },
            { status: 400 }
        );
    }

    const config = await prisma.integrationConfig.create({
        data: {
            userId: auth.user.id,
            type,
            label,
            encryptedValue: encrypt(value)
        },
        select: { id: true, type: true, label: true, isActive: true, createdAt: true }
    });

    return NextResponse.json({ data: config }, { status: 201 });
}

/** PUT — update an existing integration config (by query param ?id=). */
export async function PUT(request: NextRequest) {
    const auth = await authenticateUser();
    if (auth.error) return auth.error;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'Missing id parameter', code: 'MISSING_ID' }, { status: 400 });
    }

    const existing = await prisma.integrationConfig.findUnique({ where: { id } });
    if (!existing || existing.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: parsed.error.flatten().fieldErrors
            },
            { status: 400 }
        );
    }

    const { label, value, isActive } = parsed.data;

    if (value && !isAllowedWebhookUrl(value)) {
        return NextResponse.json(
            { error: 'URL must be HTTPS and must not target internal hosts', code: 'INVALID_URL' },
            { status: 400 }
        );
    }

    const updated = await prisma.integrationConfig.update({
        where: { id },
        data: {
            ...(label !== undefined && { label }),
            ...(value !== undefined && { encryptedValue: encrypt(value) }),
            ...(isActive !== undefined && { isActive })
        },
        select: { id: true, type: true, label: true, isActive: true, updatedAt: true }
    });

    return NextResponse.json({ data: updated });
}

/** DELETE — remove an integration config (by query param ?id=). */
export async function DELETE(request: NextRequest) {
    const auth = await authenticateUser();
    if (auth.error) return auth.error;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'Missing id parameter', code: 'MISSING_ID' }, { status: 400 });
    }

    const existing = await prisma.integrationConfig.findUnique({ where: { id } });
    if (!existing || existing.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    await prisma.integrationConfig.delete({ where: { id } });

    return NextResponse.json({ success: true });
}

/** PATCH — test webhook URL connectivity. */
export async function PATCH(request: NextRequest) {
    const auth = await authenticateUser();
    if (auth.error) return auth.error;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const config = await prisma.integrationConfig.findUnique({ where: { id } });
    if (!config || config.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    let url: string;
    try {
        url = decrypt(config.encryptedValue);
    } catch (decryptErr) {
        log.error('Failed to decrypt webhook URL', decryptErr, { id, type: config.type });
        return NextResponse.json({
            success: false,
            statusCode: 0,
            error: 'Stored webhook URL could not be decrypted — the encryption key may have changed. Please re-save the integration.'
        });
    }

    // Validate decrypted URL before attempting connection
    try {
        new URL(url);
    } catch {
        log.error('Decrypted value is not a valid URL', undefined, { id, type: config.type });
        return NextResponse.json({
            success: false,
            statusCode: 0,
            error: 'Stored webhook URL is malformed. Please update the integration with a valid URL.'
        });
    }

    // Simple connectivity check — POST with a safe test payload
    try {
        const testPayload = JSON.stringify({
            recipientEmail: 'test@example.com',
            subject: 'PReminder Connectivity Test',
            message: 'This is an automated connectivity test from PReminder — please ignore.'
        });

        const res = await webhookTestFetch(url, testPayload);

        if (!res.ok && res.status !== 202) {
            const body = await res.text().catch(() => '(empty)');
            log.warn('Test webhook returned non-success status', {
                id,
                type: config.type,
                status: res.status,
                responseBody: body.slice(0, 500)
            });
        }

        return NextResponse.json({
            success: res.ok || res.status === 202,
            statusCode: res.status,
            ...(!res.ok &&
                res.status !== 202 && {
                    error: classifyHttpError(res.status, config.type)
                })
        });
    } catch (err) {
        const detail = classifyFetchError(err);
        log.error('Webhook connectivity test failed', err, {
            id,
            type: config.type,
            errorType: detail.errorType,
            hint: detail.hint
        });

        return NextResponse.json({
            success: false,
            statusCode: 0,
            error: detail.message,
            hint: detail.hint
        });
    }
}

// ── Webhook test fetch with optional TLS bypass ─────────────

interface WebhookTestResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
}

/**
 * POST to a webhook URL with optional TLS certificate bypass.
 * Uses node:https directly so we can set `rejectUnauthorized: false`
 * without affecting the global Node.js TLS settings.
 */
function webhookTestFetch(url: string, body: string): Promise<WebhookTestResponse> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const timeout = 10_000;

        const req = https.request(
            {
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                },
                rejectUnauthorized: !skipTlsVerify,
                timeout
            },
            res => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const status = res.statusCode ?? 0;
                    const responseText = Buffer.concat(chunks).toString('utf8');
                    resolve({
                        ok: status >= 200 && status < 300,
                        status,
                        text: () => Promise.resolve(responseText)
                    });
                });
            }
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

// ── Error classification helpers ────────────────────────────

function classifyFetchError(err: unknown): {
    message: string;
    errorType: string;
    hint: string;
} {
    if (!(err instanceof Error)) {
        return {
            message: 'Connection failed — unknown error',
            errorType: 'unknown',
            hint: 'An unexpected non-Error value was thrown.'
        };
    }

    // Node.js undici-based fetch wraps the real error in err.cause.
    // Unwrap it so we can classify the actual underlying failure.
    const rootCause = err.cause instanceof Error ? err.cause : err;
    const msg = rootCause.message.toLowerCase();
    const name = rootCause.name.toLowerCase();
    // Also check the top-level message for timeout indicators
    const topMsg = err.message.toLowerCase();

    // Timeout (AbortSignal.timeout or AbortError)
    if (
        name === 'timeouterror' ||
        name === 'aborterror' ||
        msg.includes('timed out') ||
        msg.includes('timeout') ||
        topMsg.includes('timeout')
    ) {
        return {
            message: 'Connection timed out after 10 seconds',
            errorType: 'timeout',
            hint: 'The webhook URL did not respond within 10s. Check that the Power Automate flow is enabled and the trigger URL has not expired.'
        };
    }

    // DNS resolution failure
    if (msg.includes('getaddrinfo') || msg.includes('enotfound') || msg.includes('dns')) {
        return {
            message: 'DNS lookup failed — the webhook hostname could not be resolved',
            errorType: 'dns',
            hint: 'The hostname in the webhook URL does not exist or DNS is unreachable. Verify the URL is correct.'
        };
    }

    // Connection refused
    if (msg.includes('econnrefused') || msg.includes('connection refused')) {
        return {
            message: 'Connection refused — the server rejected the connection',
            errorType: 'connection_refused',
            hint: 'The remote server actively refused the connection. The flow may be disabled or the URL may be invalid.'
        };
    }

    // Connection reset
    if (msg.includes('econnreset') || msg.includes('connection reset') || msg.includes('other side closed')) {
        return {
            message: 'Connection reset by the remote server',
            errorType: 'connection_reset',
            hint: 'The connection was established but then dropped. This could be a firewall issue or the server terminated the connection.'
        };
    }

    // SSL/TLS errors
    if (
        msg.includes('ssl') ||
        msg.includes('tls') ||
        msg.includes('cert') ||
        msg.includes('unable to verify') ||
        msg.includes('self-signed') ||
        msg.includes('self_signed')
    ) {
        return {
            message: 'SSL/TLS error — could not establish a secure connection',
            errorType: 'ssl',
            hint: 'Certificate verification failed. The webhook URL may have an expired or invalid SSL certificate.'
        };
    }

    // Network unreachable
    if (msg.includes('enetunreach') || msg.includes('network') || msg.includes('ehostunreach')) {
        return {
            message: 'Network unreachable — could not reach the webhook server',
            errorType: 'network',
            hint: 'The server or network may be down. Check your internet connection and the webhook URL.'
        };
    }

    // Build a useful message from the deepest cause
    const causeMsg = err.cause instanceof Error ? `${rootCause.name}: ${rootCause.message}` : err.message;

    return {
        message: `Connection failed: ${causeMsg}`,
        errorType: 'fetch_error',
        hint: `Raw error: ${rootCause.name} — ${rootCause.message}`
    };
}

function classifyHttpError(status: number, integrationType: string): string {
    switch (true) {
        case status === 401:
            return 'Unauthorized (401) — the webhook URL may require re-authentication or has expired.';
        case status === 403:
            return 'Forbidden (403) — access was denied. The flow trigger URL may have been regenerated.';
        case status === 404:
            return integrationType === 'POWER_AUTOMATE_DM'
                ? 'Not Found (404) — the Power Automate flow may have been deleted or the trigger URL is no longer valid.'
                : 'Not Found (404) — the Teams webhook URL may have been removed from the channel.';
        case status === 429:
            return 'Rate limited (429) — too many requests. Try again in a few minutes.';
        case status >= 500:
            return `Server error (${status}) — the remote service returned an internal error. Try again later.`;
        default:
            return `Unexpected status ${status} from webhook.`;
    }
}
