import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { getAuthenticatedUser, GitHubApiError, resolveToken } from '@/lib/github/client';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// GET /api/github/debug — Quick PAT / token diagnostic
//
// Returns:
//   • Which token type is active (PAT vs OAuth)
//   • GitHub user info for that token
//   • A single-page fetch of org repos (page 1 only)
//   • Rate limit status
//
// This route is for development only.
// ─────────────────────────────────────────────────────────────

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated. Sign in first.', code: 'AUTH_REQUIRED' },
      { status: 401 },
    );
  }

  const token = resolveToken(session.accessToken);
  const tokenType = env.GITHUB_PAT ? 'PAT' : 'OAuth';
  const org = env.GITHUB_ORG;

  const results: Record<string, unknown> = {
    tokenType,
    org,
    timestamp: new Date().toISOString(),
  };

  // 1. Verify token with /user
  try {
    const user = await getAuthenticatedUser(token);
    results.user = { login: user.login, id: user.id, type: user.type };
    logger.info(`Debug: token valid, user=${user.login}`, '/api/github/debug');
  } catch (err) {
    results.user = {
      error: err instanceof GitHubApiError ? err.message : 'Unknown error',
    };
    logger.error('Debug: /user failed', '/api/github/debug', err);
  }

  // 2. Try fetching first page of org repos (single request, not all pages)
  const orgEncoded = encodeURIComponent(org);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(
      `https://api.github.com/orgs/${orgEncoded}/repos?type=all&sort=updated&per_page=5`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    const rateRemaining = res.headers.get('x-ratelimit-remaining');
    const rateLimit = res.headers.get('x-ratelimit-limit');
    results.rateLimit = { remaining: rateRemaining, limit: rateLimit };

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      results.orgRepos = {
        error: true,
        status: res.status,
        message: body.message ?? res.statusText,
        hint: res.status === 403
          ? 'SAML enforcement is blocking this request. The PAT may not be SSO-authorized.'
          : undefined,
      };
    } else {
      const repos = (await res.json()) as Array<{ name: string; full_name: string; private: boolean; updated_at: string }>;
      results.orgRepos = {
        count: repos.length,
        sample: repos.map((r) => ({
          name: r.name,
          full_name: r.full_name,
          private: r.private,
          updated_at: r.updated_at,
        })),
      };
    }
  } catch (err) {
    results.orgRepos = {
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  // 3. Try Search API as additional check
  try {
    const q = encodeURIComponent(`org:${org} fork:true`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(
      `https://api.github.com/search/repositories?q=${q}&sort=updated&per_page=5`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      results.searchRepos = {
        error: true,
        status: res.status,
        message: body.message ?? res.statusText,
      };
    } else {
      const data = (await res.json()) as { total_count: number; items: Array<{ name: string; full_name: string; private: boolean }> };
      results.searchRepos = {
        totalCount: data.total_count,
        sample: data.items.map((r) => ({
          name: r.name,
          full_name: r.full_name,
          private: r.private,
        })),
      };
    }
  } catch (err) {
    results.searchRepos = {
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  return NextResponse.json(results);
}
