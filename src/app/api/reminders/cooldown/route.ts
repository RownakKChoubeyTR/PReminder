import { authenticateUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// GET /api/reminders/cooldown — Check anti-spam cooldown per reviewer
// ─────────────────────────────────────────────────────────────

const COOLDOWN_SECONDS = 3600; // 1 hour per recipient per PR
const MAX_RECIPIENTS = 50; // Hard cap to prevent unbounded DB queries

export async function GET(request: NextRequest) {
    const authResult = await authenticateUser();
    if (authResult.error) return authResult.error;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const recipientsStr = searchParams.get('recipients') ?? '';
    const rawPrNumber = parseInt(searchParams.get('prNumber') ?? '0', 10);
    const prNumber = Number.isFinite(rawPrNumber) ? rawPrNumber : 0;
    const repo = searchParams.get('repo') ?? '';

    if (!recipientsStr || !prNumber || !repo) {
        return NextResponse.json(
            {
                error: 'Missing required parameters: recipients, prNumber, repo',
                code: 'VALIDATION_ERROR'
            },
            { status: 400 }
        );
    }

    // Cap recipients to prevent DoS via unbounded parallel queries
    const recipients = recipientsStr.split(',').filter(Boolean).slice(0, MAX_RECIPIENTS);

    if (recipients.length === 0) {
        return NextResponse.json({ error: 'No valid recipients provided', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    try {
        // Batch query: fetch all recent SENT reminders for these recipients in one query
        const cutoff = new Date(Date.now() - COOLDOWN_SECONDS * 1000);
        const recentReminders = await prisma.reminderLog.findMany({
            where: {
                userId: user.id,
                reviewerGithub: { in: recipients },
                prNumber,
                repo,
                status: 'SENT',
                sentAt: { gte: cutoff }
            },
            select: { reviewerGithub: true, sentAt: true },
            orderBy: { sentAt: 'desc' }
        });

        // Build a map of login → most recent sentAt
        const lastSentMap = new Map<string, Date>();
        for (const reminder of recentReminders) {
            if (!lastSentMap.has(reminder.reviewerGithub)) {
                lastSentMap.set(reminder.reviewerGithub, reminder.sentAt);
            }
        }

        const results = recipients.map(login => {
            const lastSent = lastSentMap.get(login);
            if (!lastSent) {
                return { login, allowed: true, remainingSeconds: 0 };
            }

            const elapsed = (Date.now() - lastSent.getTime()) / 1000;
            const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed);

            return {
                login,
                allowed: remaining <= 0,
                remainingSeconds: Math.ceil(remaining)
            };
        });

        return NextResponse.json({ data: results });
    } catch (err) {
        logger.error('Failed to check cooldowns', '/api/reminders/cooldown', err);
        return NextResponse.json({ error: 'Failed to check cooldown status', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
