import { auth } from '@/lib/auth';
import { cacheKey, githubCache } from '@/lib/cache';
import {
    isSamlError,
    listOrgRepos,
    resolveToken,
    SAML_HELP_URL,
    SAML_NOTICE,
    searchOrgRepos,
    searchOrgReposByName
} from '@/lib/github/client';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const BROWSE_TTL = 5 * 60 * 1000; // 5 min
const SEARCH_TTL = 2 * 60 * 1000; // 2 min

// ─────────────────────────────────────────────────────────────
// GET /api/github/repos?page=1&per_page=30&search=<query>
// Returns: PaginatedResponse<GitHubRepo>
//
// When `search` is provided, uses GitHub Search API for
// server-side fuzzy matching across all org repos.
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.accessToken) {
        return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(params.get('per_page') ?? 30)));
    const search = params.get('search')?.trim() ?? '';

    try {
        const token = resolveToken(session.accessToken);

        // Search mode: use GitHub Search API for server-side matching
        if (search.length >= 3) {
            const key = cacheKey('repos:search', { page, perPage, q: search.toLowerCase() });
            const result = await githubCache.getOrSet(
                key,
                () => searchOrgReposByName(token, search, page, perPage),
                SEARCH_TTL
            );
            return NextResponse.json(result);
        }

        // Browse mode: paginated org repos
        const key = cacheKey('repos', { page, perPage });
        const result = await githubCache.getOrSet(key, () => listOrgRepos(token, page, perPage), BROWSE_TTL);
        return NextResponse.json(result);
    } catch (err) {
        if (isSamlError(err)) {
            logger.warn('SAML restriction — falling back to Search API', '/api/github/repos');
            try {
                const samlKey = cacheKey('repos:saml', {
                    page,
                    perPage,
                    ...(search.length >= 3 ? { q: search.toLowerCase() } : {})
                });
                const result = await githubCache.getOrSet(
                    samlKey,
                    () =>
                        search.length >= 3
                            ? searchOrgReposByName(resolveToken(session.accessToken), search, page, perPage)
                            : searchOrgRepos(resolveToken(session.accessToken), page, perPage),
                    search.length >= 3 ? SEARCH_TTL : BROWSE_TTL
                );
                return NextResponse.json({ ...result, notice: SAML_NOTICE, helpUrl: SAML_HELP_URL });
            } catch (searchErr) {
                logger.error('Search API fallback failed', '/api/github/repos', searchErr);
                return NextResponse.json(
                    {
                        error: 'SAML enforcement blocks repo access',
                        code: 'SAML_ENFORCEMENT',
                        notice: SAML_NOTICE,
                        helpUrl: SAML_HELP_URL
                    },
                    { status: 403 }
                );
            }
        }

        logger.error('Failed to fetch repositories', '/api/github/repos', err);
        return NextResponse.json({ error: 'Failed to fetch repositories', code: 'GITHUB_API_ERROR' }, { status: 502 });
    }
}
