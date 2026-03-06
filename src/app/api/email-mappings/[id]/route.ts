import { authenticateUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// /api/email-mappings/[id] — single email mapping operations
// ─────────────────────────────────────────────────────────────

interface RouteParams {
    params: Promise<{ id: string }>;
}

/** DELETE — remove an email mapping. */
export async function DELETE(_request: Request, { params }: RouteParams) {
    const auth = await authenticateUser();
    if (auth.error) return auth.error;

    const { id } = await params;

    const mapping = await prisma.emailMapping.findUnique({ where: { id } });

    if (!mapping || mapping.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    await prisma.emailMapping.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
