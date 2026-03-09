import { encrypt } from '@/lib/db/encryption';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { Prisma, type TemplateType } from '@prisma/client';

import type { JWT } from 'next-auth/jwt';

// ─────────────────────────────────────────────────────────────
// Session Timing (seconds)
// ─────────────────────────────────────────────────────────────
// maxAge     — absolute session lifetime (cookie + JWT exp)
// updateAge  — refresh JWT if it was issued more than this ago
// tokenTTL   — internal "soft" access-token validity window;
//              once elapsed the jwt callback re-validates the
//              GitHub token via the /user API.
// ─────────────────────────────────────────────────────────────
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const SESSION_UPDATE_AGE = 60 * 60; // 1 hour — re-sign JWT
const TOKEN_REFRESH_INTERVAL = 30 * 60; // 30 min — re-validate GitHub token

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Check if the GitHub access token is still valid by calling /user. */
async function verifyGitHubToken(accessToken: string): Promise<boolean> {
    try {
        const res = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json'
            },
            signal: AbortSignal.timeout(5_000)
        });
        return res.ok;
    } catch {
        // Network error — don't invalidate the session; let the user retry.
        return true;
    }
}

// ─────────────────────────────────────────────────────────────
// New-user defaults
// ─────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Array<{
    name: string;
    type: TemplateType;
    subject?: string;
    body: string;
    isDefault: boolean;
}> = [
    {
        name: 'Friendly Reminder',
        type: 'TEAMS_DM',
        body: 'Hi {receiverName},\n\nCould you please review the following pull request when you get a chance?\n\nTitle: {prTitle}\nRepo: {repoName}\nLink: {prUrl}\n\nThanks!',
        isDefault: true
    },
    {
        name: 'Friendly Reminder',
        type: 'EMAIL',
        subject: 'PR Review Reminder: {prTitle} (#{prNumber})',
        body: 'Hi {receiverName},\n\nCould you please review the following pull request when you get a chance?\n\nTitle: {prTitle}\nRepo: {repoName}\nLink: {prUrl}\n\nThanks!',
        isDefault: true
    }
];

/**
 * Seed default templates and a placeholder Power Automate DM integration
 * for users who have none. Safe to call on every sign-in — only creates
 * records when the respective counts are zero.
 */
async function seedUserDefaults(userId: string): Promise<void> {
    const [templateCount, integrationCount] = await Promise.all([
        prisma.messageTemplate.count({ where: { userId } }),
        prisma.integrationConfig.count({ where: { userId, type: 'POWER_AUTOMATE_DM' } })
    ]);

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (templateCount === 0) {
        ops.push(
            prisma.messageTemplate.createMany({
                data: DEFAULT_TEMPLATES.map(t => ({ ...t, userId }))
            })
        );
    }

    if (integrationCount === 0) {
        const flowUrl = env.POWER_AUTOMATE_FLOW_URL;
        ops.push(
            prisma.integrationConfig.create({
                data: {
                    userId,
                    type: 'POWER_AUTOMATE_DM',
                    label: 'Power Automate – Teams DM',
                    encryptedValue: encrypt(flowUrl ?? 'https://make.powerautomate.com/your-flow-url-here'),
                    // Active only when a real URL is configured via env
                    isActive: !!flowUrl
                }
            })
        );
    }

    if (ops.length > 0) {
        await prisma.$transaction(ops);
        logger.info(
            `seeded defaults for user ${userId} (templates=${templateCount === 0}, integration=${integrationCount === 0})`,
            'auth'
        );
    }
}

// ─────────────────────────────────────────────────────────────
// NextAuth v5 Configuration
// ─────────────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        GitHub({
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: 'read:org repo read:user user:email'
                }
            }
        })
    ],

    // ─── Callbacks ───────────────────────────────────────────

    callbacks: {
        /**
         * `jwt` runs on every request (via middleware or getServerSession).
         * We use it to:
         *  1. Persist GitHub credentials on first sign-in.
         *  2. Periodically re-validate the GitHub access token.
         *  3. Mark the token with refresh timestamps.
         */
        async jwt({ token, account, profile }): Promise<JWT> {
            const now = Math.floor(Date.now() / 1000);

            // ── First sign-in: populate token from OAuth response ──
            if (account && profile) {
                return {
                    ...token,
                    accessToken: account.access_token ?? '',
                    refreshToken: account.refresh_token ?? undefined,
                    githubLogin: (profile as { login?: string }).login ?? '',
                    githubId: account.providerAccountId,
                    tokenIssuedAt: now,
                    lastVerifiedAt: now,
                    expiresAt: now + SESSION_MAX_AGE
                };
            }

            // ── Session expired — force re-auth ──
            if (token.expiresAt && now >= (token.expiresAt ?? 0)) {
                return { ...token, error: 'SessionExpired' as const };
            }

            // ── Periodic GitHub token verification ──
            const lastVerified = token.lastVerifiedAt ?? 0;
            if (now - lastVerified > TOKEN_REFRESH_INTERVAL) {
                const isValid = await verifyGitHubToken(token.accessToken ?? '');
                if (!isValid) {
                    return { ...token, error: 'TokenRevoked' as const };
                }
                token.lastVerifiedAt = now;
            }

            return token;
        },

        /**
         * `session` shapes the object returned to the client.
         * Never expose the raw access/refresh tokens to the browser.
         */
        async session({ session, token }) {
            // Propagate token errors so the client can react
            if (token.error) {
                session.error = token.error;
            }

            session.user = {
                ...session.user,
                githubLogin: token.githubLogin ?? '',
                githubId: token.githubId ?? ''
            };

            // Expose a server-only accessor for API routes
            session.accessToken = token.accessToken ?? '';
            session.expiresAt = new Date((token.expiresAt ?? 0) * 1000).toISOString();

            return session;
        },

        /** Restrict redirects to same origin to prevent open-redirect attacks. */
        async redirect({ url, baseUrl }) {
            // Relative paths are always safe
            if (url.startsWith('/')) return `${baseUrl}${url}`;
            // Same-origin absolute URLs are safe
            if (url.startsWith(baseUrl)) return url;
            // Default fallback
            return `${baseUrl}/dashboard`;
        }
    },

    // ─── Pages ───────────────────────────────────────────────

    pages: {
        signIn: '/login',
        error: '/login'
    },

    // ─── Session ─────────────────────────────────────────────

    session: {
        strategy: 'jwt',
        maxAge: SESSION_MAX_AGE,
        updateAge: SESSION_UPDATE_AGE
    },

    // ─── Events (server-side logging) ────────────────────────

    events: {
        async signIn({ account, profile }) {
            if (!account || !profile) return;

            const githubId = parseInt(account.providerAccountId, 10);
            const login = (profile as { login?: string }).login ?? '';
            const email = profile.email ?? null;
            const name = profile.name ?? null;
            const avatarUrl = (profile as { avatar_url?: string }).avatar_url ?? null;
            const accessToken = account.access_token ?? '';

            try {
                const user = await prisma.user.upsert({
                    where: { githubId },
                    create: {
                        githubId,
                        username: login,
                        email,
                        name,
                        avatarUrl,
                        accessToken: encrypt(accessToken)
                    },
                    update: {
                        username: login,
                        email,
                        name,
                        avatarUrl,
                        accessToken: encrypt(accessToken)
                    }
                });
                logger.info(`sign-in: upserted user ${login} (githubId=${githubId})`, 'auth');
                await seedUserDefaults(user.id);
            } catch (err) {
                logger.error(`sign-in: failed to upsert user ${login}: ${err}`, 'auth');
            }
        },
        async signOut() {
            logger.info('sign-out', 'auth');
        }
    },

    // ─── Debug ───────────────────────────────────────────────

    debug: false
});
