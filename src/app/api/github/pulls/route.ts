import { auth } from '@/lib/auth';
import { cacheKey, githubCache } from '@/lib/cache';
import {
  isSamlError,
  listOpenPulls,
  resolveToken,
  SAML_HELP_URL,
  SAML_NOTICE,
  searchRepoPulls,
  searchRepoPullsByQuery,
} from '@/lib/github/client';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PULLS_TTL = 2 * 60 * 1000; // 2 min
const SEARCH_TTL = 30 * 1000; // 30 sec

// ─────────────────────────────────────────────────────────────
// GET /api/github/pulls?repo=<name>&page=1&per_page=30&search=<query>
// Returns: PaginatedResponse<GitHubPullRequest>
//
// When `search` is provided (≥2 chars), uses GitHub Search API
// for server-side matching across PR titles.
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const repo = params.get('repo');

  if (!repo) {
    return NextResponse.json(
      { error: 'Missing required query parameter: repo', code: 'MISSING_PARAM' },
      { status: 400 },
    );
  }

  const page = Math.max(1, Number(params.get('page') ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get('per_page') ?? 30)));
  const search = params.get('search')?.trim() ?? '';

  try {
    const token = resolveToken(session.accessToken);

    // Search mode: use GitHub Search API for server-side matching
    if (search.length >= 3) {
      const key = cacheKey('pulls:search', { page, perPage, q: search.toLowerCase(), repo });
      const result = await githubCache.getOrSet(
        key,
        () => searchRepoPullsByQuery(token, repo, search, page, perPage),
        SEARCH_TTL,
      );
      return NextResponse.json(result);
    }

    // Browse mode: paginated list
    const key = cacheKey('pulls', { page, perPage, repo });
    const result = await githubCache.getOrSet(
      key,
      () => listOpenPulls(token, repo, page, perPage),
      PULLS_TTL,
    );

    return NextResponse.json(result);
  } catch (err) {
    if (isSamlError(err)) {
      logger.warn(`SAML restriction for repo=${repo} — Search API fallback`, '/api/github/pulls');
      try {
        const samlKey = cacheKey('pulls:saml', {
          page,
          perPage,
          repo,
          ...(search.length >= 3 ? { q: search.toLowerCase() } : {}),
        });
        const result = await githubCache.getOrSet(
          samlKey,
          () =>
            search.length >= 3
              ? searchRepoPullsByQuery(
                  resolveToken(session.accessToken),
                  repo,
                  search,
                  page,
                  perPage,
                )
              : searchRepoPulls(resolveToken(session.accessToken), repo, page, perPage),
          search.length >= 3 ? SEARCH_TTL : PULLS_TTL,
        );
        return NextResponse.json({ ...result, notice: SAML_NOTICE, helpUrl: SAML_HELP_URL });
      } catch (searchErr) {
        logger.error('Search API fallback failed', '/api/github/pulls', searchErr);
      }
    }

    logger.error(`Failed to fetch PRs for repo=${repo}`, '/api/github/pulls', err);
    return NextResponse.json(
      { error: 'Failed to fetch pull requests', code: 'GITHUB_API_ERROR' },
      { status: 502 },
    );
  }
}
