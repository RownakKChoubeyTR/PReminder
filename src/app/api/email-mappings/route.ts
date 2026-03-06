import { authenticateUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/db/prisma';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// /api/email-mappings — CRUD for GitHub → corporate email maps
// ─────────────────────────────────────────────────────────────

const createSchema = z.object({
  githubUsername: z.string().trim().min(1, 'GitHub username is required'),
  email: z.string().trim().email('Invalid email address'),
  displayName: z.string().trim().optional(),
});

/** GET — list all email mappings for the current user. */
export async function GET() {
  const auth = await authenticateUser();
  if (auth.error) return auth.error;

  const mappings = await prisma.emailMapping.findMany({
    where: { userId: auth.user.id },
    orderBy: { githubUsername: 'asc' },
    select: {
      id: true,
      githubUsername: true,
      email: true,
      displayName: true,
      source: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: mappings });
}

/** POST — create a new email mapping. */
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
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { githubUsername, email, displayName } = parsed.data;

  // Upsert: if mapping exists for this user+github, update it
  const mapping = await prisma.emailMapping.upsert({
    where: {
      userId_githubUsername: {
        userId: auth.user.id,
        githubUsername,
      },
    },
    create: {
      userId: auth.user.id,
      githubUsername,
      email,
      displayName: displayName ?? null,
      source: 'manual',
    },
    update: {
      email,
      displayName: displayName ?? undefined,
      source: 'manual',
    },
  });

  return NextResponse.json({ data: mapping }, { status: 201 });
}
