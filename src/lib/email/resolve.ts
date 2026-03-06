import { prisma } from '@/lib/db/prisma';
import { getCommitEmailForUser, getUserProfile, resolveToken } from '@/lib/github/client';
import { createLogger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────
// Email Resolver — Three-strategy email lookup for GitHub users
// ─────────────────────────────────────────────────────────────
// Tries in order:
//   1. EmailMapping table (DB — manual or auto-cached from prior lookups)
//   2. GitHub user profile public email (/users/{login})
//   3. Commit Search API — org-wide search (skips noreply)
//   4. Structured failure — prompts user to add a manual mapping
// ─────────────────────────────────────────────────────────────

const log = createLogger('email-resolve');

export interface ResolvedRecipient {
  email: string;
  displayName: string | null;
  source: 'email_mapping' | 'github_profile' | 'github_commit';
}

export interface ResolutionFailure {
  email: null;
  displayName: string | null;
  source: null;
  reason: string;
}

export type RecipientResolution = ResolvedRecipient | ResolutionFailure;

/** True only for real, deliverable addresses — rejects noreply and empty values. */
function isRealEmail(email: string | null | undefined): email is string {
  return !!email && email.includes('@') && !email.includes('@users.noreply.github.com');
}

async function cacheAndReturn(
  userId: string,
  githubLogin: string,
  email: string,
  displayName: string | null,
  source: string,
): Promise<ResolvedRecipient> {
  await prisma.emailMapping.upsert({
    where: { userId_githubUsername: { userId, githubUsername: githubLogin } },
    update: { email, displayName, source },
    create: { userId, githubUsername: githubLogin, email, displayName, source },
  });
  const resolvedSource: ResolvedRecipient['source'] =
    source === 'email_mapping'
      ? 'email_mapping'
      : source === 'github-profile'
        ? 'github_profile'
        : 'github_commit';
  return { email, displayName, source: resolvedSource };
}

/**
 * Resolve a GitHub username to a deliverable email address.
 *
 * 1. EmailMapping table — free cache hit for manual/auto-saved entries.
 * 2. GitHub user profile — public email from /users/{login}.
 * 3. Commit Search API — searches org commits for a real author email.
 * 4. Structured failure — caller should prompt the user to enter the email manually.
 */
export async function resolveRecipientEmail(
  userId: string,
  githubLogin: string,
  accessToken: string,
): Promise<RecipientResolution> {
  const token = resolveToken(accessToken);

  // ── Strategy 1: EmailMapping table ────────────────────────
  const mapping = await prisma.emailMapping.findFirst({
    where: { userId, githubUsername: githubLogin },
  });
  if (mapping) {
    log.info('Email resolved from mapping', {
      githubLogin,
      email: mapping.email,
      source: mapping.source,
    });
    return { email: mapping.email, displayName: mapping.displayName, source: 'email_mapping' };
  }

  // ── Strategy 2: GitHub user profile ─────────────────────────
  // Fast single REST call. Some users have a public email even with a
  // private profile (e.g. set via GitHub settings but not shown on profile page).
  log.debug('Trying GitHub profile email', { githubLogin });
  let profile: Awaited<ReturnType<typeof getUserProfile>> = null;
  try {
    profile = await getUserProfile(token, githubLogin);
  } catch (err) {
    log.warn('GitHub profile lookup failed', { githubLogin, err });
  }
  if (profile?.email && isRealEmail(profile.email)) {
    log.info('Email resolved from GitHub profile', { githubLogin, email: profile.email });
    return cacheAndReturn(
      userId,
      githubLogin,
      profile.email,
      profile.name ?? profile.login,
      'github-profile',
    );
  }

  // ── Strategy 3: Commit Search API ─────────────────────────
  // Searches commits across all org repos; noreply addresses are filtered.
  log.debug('Trying commit search', { githubLogin });
  let commitResult: Awaited<ReturnType<typeof getCommitEmailForUser>> = null;
  try {
    commitResult = await getCommitEmailForUser(token, githubLogin);
  } catch (err) {
    log.warn('Commit search failed', { githubLogin, err });
  }
  if (commitResult && isRealEmail(commitResult.email)) {
    log.info('Email resolved from commit search', { githubLogin, email: commitResult.email });
    return cacheAndReturn(
      userId,
      githubLogin,
      commitResult.email,
      commitResult.name,
      'github-commit',
    );
  }

  // ── All strategies exhausted ───────────────────────────────
  log.warn('All email strategies exhausted', { githubLogin });
  return {
    email: null,
    displayName: profile?.name ?? profile?.login ?? githubLogin,
    source: null,
    reason: `Could not find a deliverable email for "${githubLogin}". Their GitHub profile has no public email and all org commits use a noreply address. Add a manual mapping below.`,
  };
}
