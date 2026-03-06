import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Auth Utilities — Resolve authenticated user from DB session
// ─────────────────────────────────────────────────────────────
// Centralises the session → DB user resolution so every API
// route uses the correct `User.id` (cuid) instead of email.

interface AuthenticatedUser {
    id: string;
    githubLogin: string;
    email: string | null;
    accessToken: string;
}

type AuthResult = { user: AuthenticatedUser; error?: never } | { user?: never; error: NextResponse };

/**
 * Authenticate the request and resolve the DB user.
 *
 * Returns `{ user }` on success or `{ error: NextResponse }` on failure.
 * Callers should check `result.error` and return it directly if present.
 *
 * @example
 * ```ts
 * const result = await authenticateUser();
 * if (result.error) return result.error;
 * const { user } = result;
 * // use user.id for DB queries
 * ```
 */
export async function authenticateUser(): Promise<AuthResult> {
    const session = await auth();

    if (!session?.user) {
        return {
            error: NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
        };
    }

    const { githubLogin, githubId } = session.user;
    const accessToken = session.accessToken ?? '';

    // Resolve via githubId first (Int, unique, always present), fall back to username
    const dbUser = await prisma.user.findFirst({
        where: githubId ? { githubId: parseInt(githubId, 10) } : { username: githubLogin },
        select: { id: true, username: true, email: true }
    });

    if (!dbUser) {
        logger.error(`DB user not found for session: githubId=${githubId}, login=${githubLogin}`, 'auth-utils');
        return {
            error: NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 })
        };
    }

    return {
        user: {
            id: dbUser.id,
            githubLogin: dbUser.username,
            email: dbUser.email,
            accessToken
        }
    };
}
