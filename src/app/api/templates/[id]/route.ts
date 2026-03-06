import { authenticateUser } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// /api/templates/[id] — Single template operations
// ─────────────────────────────────────────────────────────────

const templateUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  type: z.enum(['TEAMS_DM', 'TEAMS_CHANNEL', 'EMAIL']),
  subject: z.string().max(500).trim().optional(),
  body: z.string().min(1, 'Body is required').max(10_000).trim(),
  isDefault: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/templates/[id] — Fetch a single template */
export async function GET(_request: Request, { params }: RouteParams) {
  const authResult = await authenticateUser();
  if (authResult.error) return authResult.error;
  const { user } = authResult;

  const { id } = await params;

  try {
    const template = await prisma.messageTemplate.findFirst({
      where: { id, userId: user.id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: template });
  } catch (err) {
    logger.error('Failed to fetch template', `/api/templates/${id}`, err);
    return NextResponse.json(
      { error: 'Failed to fetch template', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/** PUT /api/templates/[id] — Update an existing template */
export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await authenticateUser();
  if (authResult.error) return authResult.error;
  const { user } = authResult;

  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const parsed = templateUpdateSchema.safeParse(rawBody);
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
    // Atomic: verify ownership + unset defaults + update — single transaction
    const template = await prisma.$transaction(async (tx) => {
      const existing = await tx.messageTemplate.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) return null;

      if (input.isDefault) {
        await tx.messageTemplate.updateMany({
          where: {
            userId: user.id,
            type: input.type,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }

      return tx.messageTemplate.update({
        where: { id },
        data: {
          name: input.name,
          type: input.type,
          subject: input.subject ?? null,
          body: input.body,
          isDefault: input.isDefault ?? false,
        },
      });
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: template });
  } catch (err) {
    logger.error('Failed to update template', `/api/templates/${id}`, err);
    return NextResponse.json(
      { error: 'Failed to update template', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/** DELETE /api/templates/[id] — Delete a template */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await authenticateUser();
  if (authResult.error) return authResult.error;
  const { user } = authResult;

  const { id } = await params;

  try {
    // Verify ownership before deleting
    const existing = await prisma.messageTemplate.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    await prisma.messageTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete template', `/api/templates/${id}`, err);
    return NextResponse.json(
      { error: 'Failed to delete template', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
