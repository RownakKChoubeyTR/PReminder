import { authenticateUser } from '@/lib/auth-utils';
import { cacheKey, githubCache } from '@/lib/cache';
import { isSamlError, listUserPRs, SAML_HELP_URL, SAML_NOTICE } from '@/lib/github/client';
import { createLogger } from '@/lib/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createLogger('api/my-prs');

// Cache for 5 minutes — no need to refetch when switching tabs
const MY_PRS_TTL = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// GET /api/github/my-prs?page=1&per_page=30
// Returns: PaginatedResponse<GitHubMyPR>
//
// Returns all PRs (open + closed) authored by the signed-in user
// in the org. State filtering is done client-side.
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser();
  if (authResult.error) return authResult.error;
  const { user } = authResult;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get('per_page') ?? 30)));

  const key = cacheKey('my-prs', { login: user.githubLogin, page, perPage });

  try {
    const data = await githubCache.getOrSet(
      key,
      () => listUserPRs(user.accessToken, user.githubLogin, page, perPage),
      MY_PRS_TTL,
    );
    return NextResponse.json(data);
  } catch (err) {
    if (isSamlError(err)) {
      log.warn('SAML SSO required for my-prs', { login: user.githubLogin });
      return NextResponse.json(
        {
          error: 'SAML SSO authorization required',
          code: 'SAML_REQUIRED',
          helpUrl: SAML_HELP_URL,
          notice: SAML_NOTICE,
        },
        { status: 403 },
      );
    }
    log.error('Failed to fetch my PRs', err, { login: user.githubLogin, page });
    return NextResponse.json(
      { error: 'Failed to fetch your PRs', code: 'GITHUB_ERROR' },
      { status: 500 },
    );
  }
}
