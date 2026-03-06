import { authenticateUser } from '@/lib/auth-utils';
import { cacheKey, reviewersCache } from '@/lib/cache';
import { prisma } from '@/lib/db/prisma';
import {
  getPullRequest,
  isSamlError,
  listReviews,
  resolveToken,
  SAML_HELP_URL,
  SAML_NOTICE,
} from '@/lib/github/client';
import { logger } from '@/lib/logger';
import type { GitHubReview, GitHubUser, ReviewerInfo, ReviewerStatus } from '@/types/github';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const REVIEWERS_TTL = 60 * 1000; // 1 min

// ─────────────────────────────────────────────────────────────
// GET /api/github/reviewers?repo=<name>&pr=<number>
// Returns enriched reviewer breakdown for a PR
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser();
  if (authResult.error) return authResult.error;
  const { user } = authResult;

  const repo = request.nextUrl.searchParams.get('repo');
  const prParam = request.nextUrl.searchParams.get('pr');

  if (!repo || !prParam) {
    return NextResponse.json(
      { error: 'Missing required query parameters: repo, pr', code: 'MISSING_PARAM' },
      { status: 400 },
    );
  }

  const prNumber = parseInt(prParam, 10);
  if (Number.isNaN(prNumber)) {
    return NextResponse.json(
      { error: 'Query parameter "pr" must be a number', code: 'INVALID_PARAM' },
      { status: 400 },
    );
  }

  try {
    const token = resolveToken(user.accessToken);
    // Cache key includes userId so different users get their own email annotations
    const key = cacheKey('reviewers', { pr: prNumber, repo, userId: user.id });
    const result = await reviewersCache.getOrSet(
      key,
      async () => {
        // Fetch both in parallel: full PR (for requested_reviewers) + submitted reviews
        const [pr, reviews] = await Promise.all([
          getPullRequest(token, repo, prNumber),
          listReviews(token, repo, prNumber),
        ]);

        const requestedReviewers: GitHubUser[] = pr?.requested_reviewers ?? [];
        const reviewers = computeReviewerStatuses(requestedReviewers, reviews);

        // Attach emails from EmailMapping (fast DB lookup — no GitHub API calls)
        const logins = reviewers.map((r) => r.user.login);
        const mappings = await prisma.emailMapping.findMany({
          where: { userId: user.id, githubUsername: { in: logins } },
          select: { githubUsername: true, email: true },
        });
        const emailByLogin = new Map(mappings.map((m) => [m.githubUsername, m.email]));

        const enriched: ReviewerInfo[] = reviewers.map((r) => ({
          ...r,
          email: emailByLogin.get(r.user.login) ?? null,
        }));

        return { data: enriched };
      },
      REVIEWERS_TTL,
    );

    return NextResponse.json(result);
  } catch (err) {
    if (isSamlError(err)) {
      logger.warn(
        `SAML restriction for reviewers repo=${repo} pr=${prNumber}`,
        '/api/github/reviewers',
      );
      return NextResponse.json({
        data: [],
        mode: 'restricted',
        notice: SAML_NOTICE,
        helpUrl: SAML_HELP_URL,
      });
    }

    logger.error(
      `Failed to fetch reviewers for repo=${repo} pr=${prNumber}`,
      '/api/github/reviewers',
      err,
    );
    return NextResponse.json(
      { error: 'Failed to fetch reviewers', code: 'GITHUB_API_ERROR' },
      { status: 502 },
    );
  }
}

/**
 * Merge requested reviewers (from the PR object) with submitted reviews.
 * - Requested reviewers who haven't submitted a review get status 'awaiting'.
 * - For those who reviewed: latest non-comment review wins; comment-only → 'commented'.
 * - The PR author is excluded from the reviewer list.
 */
function computeReviewerStatuses(
  requestedReviewers: GitHubUser[],
  reviews: GitHubReview[],
): Omit<ReviewerInfo, 'email'>[] {
  // Build a map of all users who have a review activity
  const byUser = new Map<string, { reviews: GitHubReview[]; user: GitHubUser }>();

  for (const review of reviews) {
    const login = review.user.login;
    if (!byUser.has(login)) {
      byUser.set(login, { reviews: [], user: review.user });
    }
    byUser.get(login)!.reviews.push(review);
  }

  const result: Omit<ReviewerInfo, 'email'>[] = [];
  const seen = new Set<string>();

  // Process those who submitted reviews (with computed status)
  for (const [login, { reviews: userReviews, user }] of byUser) {
    seen.add(login);
    const sorted = [...userReviews].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
    );

    const actionable = sorted.find((r) => r.state !== 'COMMENTED' && r.state !== 'PENDING');

    let status: ReviewerStatus;
    if (actionable) {
      status = mapGitHubState(actionable.state);
    } else if (sorted.some((r) => r.state === 'COMMENTED')) {
      status = 'commented';
    } else {
      status = 'pending';
    }

    result.push({ user, status, lastReviewedAt: sorted[0]?.submitted_at ?? null });
  }

  // Add requested reviewers who haven't submitted any review yet
  for (const user of requestedReviewers) {
    if (!seen.has(user.login)) {
      result.push({ user, status: 'awaiting', lastReviewedAt: null });
    }
  }

  return result;
}

function mapGitHubState(state: GitHubReview['state']): ReviewerStatus {
  switch (state) {
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changes_requested';
    case 'DISMISSED':
      return 'pending';
    default:
      return 'pending';
  }
}
