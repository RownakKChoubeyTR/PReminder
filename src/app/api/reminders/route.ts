import { authenticateUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// GET /api/reminders — List reminder history (paginated)
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const authResult = await authenticateUser();
    if (authResult.error) return authResult.error;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);

    // Safe parseInt with NaN guard
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawPerPage = parseInt(searchParams.get('per_page') ?? '20', 10);
    const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
    const perPage = Math.min(100, Math.max(1, Number.isFinite(rawPerPage) ? rawPerPage : 20));
    const skip = (page - 1) * perPage;

    try {
        const [logs, total] = await Promise.all([
            prisma.reminderLog.findMany({
                where: { userId: user.id },
                orderBy: { sentAt: 'desc' },
                skip,
                take: perPage,
                include: {
                    template: {
                        select: { name: true, type: true }
                    }
                }
            }),
            prisma.reminderLog.count({
                where: { userId: user.id }
            })
        ]);

        return NextResponse.json({
            data: logs,
            total,
            page,
            perPage,
            hasNextPage: skip + perPage < total
        });
    } catch (err) {
        logger.error('Failed to fetch reminder logs', '/api/reminders', err);
        return NextResponse.json(
            { error: 'Failed to fetch reminder history', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
