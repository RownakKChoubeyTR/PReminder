import { authenticateUser } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// /api/templates — CRUD for message templates
// ─────────────────────────────────────────────────────────────

const templateInputSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  type: z.enum(['TEAMS_DM', 'TEAMS_CHANNEL', 'EMAIL']),
  subject: z.string().max(500).trim().optional(),
  body: z.string().min(1, 'Body is required').max(10_000).trim(),
  isDefault: z.boolean().optional(),
});

/** GET /api/templates — List user's templates */
export async function GET() {
  const authResult = await authenticateUser();
  if (authResult.error) return authResult.error;
  const { user } = authResult;

  try {
    const templates = await prisma.messageTemplate.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: templates });
  } catch (err) {
    logger.error('Failed to fetch templates', '/api/templates', err);
    return NextResponse.json(
      { error: 'Failed to fetch templates', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/** POST /api/templates — Create a new template */
export async function POST(request: Request) {
  const authResult = await authenticateUser();
  if (authResult.error) return authResult.error;
  const { user } = authResult;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const parsed = templateInputSchema.safeParse(rawBody);
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

  const input = parsed.data;

  try {
    // Atomic: unset existing default + create — prevents duplicate defaults
    const template = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.messageTemplate.updateMany({
          where: { userId: user.id, type: input.type, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.messageTemplate.create({
        data: {
          userId: user.id,
          name: input.name,
          type: input.type,
          subject: input.subject ?? null,
          body: input.body,
          isDefault: input.isDefault ?? false,
        },
      });
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    logger.error('Failed to create template', '/api/templates', err);
    return NextResponse.json(
      { error: 'Failed to create template', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
