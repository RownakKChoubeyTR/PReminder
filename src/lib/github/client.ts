import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import type {
    GitHubLabel,
    GitHubMyPR,
    GitHubPullRequest,
    GitHubRepo,
    GitHubReview,
    GitHubTeamMember,
    GitHubUser,
    GitHubUserProfile,
    PaginatedResponse
} from '@/types/github';

// ─────────────────────────────────────────────────────────────
// GitHub REST API Client — Paginated, with SAML fallback
// ─────────────────────────────────────────────────────────────

const API = 'https://api.github.com';
const TIMEOUT = 15_000;
const DEFAULT_PER_PAGE = 30;

const log = createLogger('github-client');

/** URL-encoded org — handles spaces and special characters. */
const ORG = encodeURIComponent(env.GITHUB_ORG);

// ─── Token Resolution ────────────────────────────────────────

/** PAT takes precedence over OAuth when configured (for SAML SSO orgs). */
export function resolveToken(oauthToken: string): string {
    return env.GITHUB_PAT ?? oauthToken;
}

// ─── Core Fetch ──────────────────────────────────────────────

interface RequestOptions {
    token: string;
    method?: string;
    body?: unknown;
}

/** Low-level GitHub fetch with timeout, logging, and error mapping. */
async function request<T>(
    path: string,
    { token, method = 'GET', body }: RequestOptions,
    acceptHeader = 'application/vnd.github+json'
): Promise<{ data: T; headers: Headers }> {
    const url = path.startsWith('http') ? path : `${API}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    try {
        const res = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: acceptHeader,
                'X-GitHub-Api-Version': '2022-11-28',
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
            signal: controller.signal
        });

        logRateLimit(res.headers);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new GitHubApiError(res.status, err.message ?? res.statusText, path);
        }

        const data = (await res.json()) as T;
        return { data, headers: res.headers };
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new GitHubApiError(408, `Request timed out after ${TIMEOUT}ms`, path);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/** Convenience: fetch a single resource (no pagination). */
async function get<T>(path: string, token: string, accept?: string): Promise<T> {
    const { data } = await request<T>(path, { token }, accept);
    return data;
}

/** Fetch a single page and derive `hasNextPage` from Link header. */
async function getPage<T>(path: string, token: string, page: number, perPage: number): Promise<PaginatedResponse<T>> {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${path}${sep}per_page=${perPage}&page=${page}`;

    log.debug('GitHub GET', { page, url: url.substring(0, 140) });

    const { data, headers } = await request<T[]>(url, { token });
    const hasNextPage = (headers.get('link') ?? '').includes('rel="next"');

    return { data, page, perPage, hasNextPage, total: -1 };
}

/** Fetch ALL pages (for small, bounded datasets like reviews). */
async function getAll<T>(path: string, token: string, maxPages = 5): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
        const result = await getPage<T>(path, token, page, 100);
        items.push(...result.data);
        hasMore = result.hasNextPage;
        page++;
    }

    return items;
}

// ─── Public API ──────────────────────────────────────────────

/** List org repos — single page, sorted by recently updated. */
export async function listOrgRepos(
    token: string,
    page = 1,
    perPage = DEFAULT_PER_PAGE
): Promise<PaginatedResponse<GitHubRepo>> {
    const result = await getPage<GitHubRepo>(`/orgs/${ORG}/repos?type=all&sort=updated`, token, page, perPage);
    result.data = result.data.filter(r => !r.archived);
    return result;
}

/** List open PRs for a repo — single page, most recent first. */
export async function listOpenPulls(
    token: string,
    repo: string,
    page = 1,
    perPage = DEFAULT_PER_PAGE
): Promise<PaginatedResponse<GitHubPullRequest>> {
    return getPage<GitHubPullRequest>(
        `/repos/${ORG}/${encodeURIComponent(repo)}/pulls?state=open&sort=updated&direction=desc`,
        token,
        page,
        perPage
    );
}

/** Get all reviews for a PR (small dataset — fetches all pages). */
export async function listReviews(token: string, repo: string, prNumber: number): Promise<GitHubReview[]> {
    return getAll<GitHubReview>(`/repos/${ORG}/${encodeURIComponent(repo)}/pulls/${prNumber}/reviews`, token);
}

/**
 * Get a single open PR by number.
 * Returns full PR object including requested_reviewers and requested_teams.
 */
export async function getPullRequest(token: string, repo: string, prNumber: number): Promise<GitHubPullRequest | null> {
    try {
        return await get<GitHubPullRequest>(`/repos/${ORG}/${encodeURIComponent(repo)}/pulls/${prNumber}`, token);
    } catch (err) {
        if (err instanceof GitHubApiError && (err.status === 404 || err.status === 410)) return null;
        log.error('Failed to fetch PR', err, { prNumber, repo });
        return null;
    }
}

/** Resolve a team slug to its members (small dataset). */
export async function listTeamMembers(token: string, teamSlug: string): Promise<GitHubTeamMember[]> {
    return getAll<GitHubTeamMember>(`/orgs/${ORG}/teams/${encodeURIComponent(teamSlug)}/members`, token);
}

/**
 * Try to find a user's real email from their recent commit history.
 * Uses the Commit Search API (searches across all org repos).
 * Skips GitHub noreply addresses (e.g. 12345+login@users.noreply.github.com).
 *
 * Returns null if no usable email is found or the request fails.
 */
export async function getCommitEmailForUser(
    token: string,
    login: string
): Promise<{ email: string; name: string | null } | null> {
    try {
        const q = encodeURIComponent(`author:${login} org:${env.GITHUB_ORG}`);
        const result = await get<SearchCommitsResponse>(
            `/search/commits?q=${q}&sort=author-date&order=desc&per_page=10`,
            token
        );

        for (const item of result.items) {
            const email = item.commit.author?.email ?? null;
            const name = item.commit.author?.name ?? null;
            if (isUsableEmail(email)) return { email: email!, name };
        }
        return null;
    } catch (err) {
        log.error('Failed to fetch commit email', err, { login });
        return null;
    }
}

/** Shared email validity check — rejects empty and noreply addresses. */
function isUsableEmail(email: string | null | undefined): boolean {
    return !!email && email.includes('@') && !email.includes('@users.noreply.github.com');
}

/** Get the authenticated user's profile. */
export async function getAuthenticatedUser(token: string): Promise<GitHubUser> {
    return get<GitHubUser>('/user', token);
}

/**
 * Get a user's full public profile (includes email, name, bio).
 * Returns `null` if the user is not found (404) or the request fails.
 */
export async function getUserProfile(token: string, login: string): Promise<GitHubUserProfile | null> {
    try {
        return await get<GitHubUserProfile>(`/users/${encodeURIComponent(login)}`, token);
    } catch (err) {
        if (err instanceof GitHubApiError && err.status === 404) return null;
        log.error('Failed to fetch user profile', err, { login });
        return null;
    }
}

// ─── SAML SSO Fallback ──────────────────────────────────────

interface SearchResponse<T> {
    total_count: number;
    incomplete_results: boolean;
    items: T[];
}

/** Detect SAML enforcement 403. */
export function isSamlError(err: unknown): boolean {
    return err instanceof GitHubApiError && err.status === 403 && err.message.toLowerCase().includes('saml');
}

/** Fallback: repos via Search API (paginated). */
export async function searchOrgRepos(
    token: string,
    page = 1,
    perPage = DEFAULT_PER_PAGE
): Promise<PaginatedResponse<GitHubRepo>> {
    const q = encodeURIComponent(`org:${env.GITHUB_ORG} fork:true archived:false`);
    const result = await get<SearchResponse<GitHubRepo>>(
        `/search/repositories?q=${q}&sort=updated&order=desc&per_page=${perPage}&page=${page}`,
        token
    );
    return {
        data: result.items,
        page,
        perPage,
        total: result.total_count,
        hasNextPage: page * perPage < result.total_count
    };
}

/** Fallback: PRs via Search API (paginated, partial data). */
export async function searchRepoPulls(
    token: string,
    repo: string,
    page = 1,
    perPage = DEFAULT_PER_PAGE
): Promise<PaginatedResponse<GitHubPullRequest>> {
    const q = encodeURIComponent(`is:pr is:open repo:${env.GITHUB_ORG}/${repo}`);
    const result = await get<SearchResponse<SearchIssueItem>>(
        `/search/issues?q=${q}&sort=updated&order=desc&per_page=${perPage}&page=${page}`,
        token
    );
    return {
        data: result.items.filter(i => i.pull_request).map(toGitHubPR),
        page,
        perPage,
        total: result.total_count,
        hasNextPage: page * perPage < result.total_count
    };
}

/**
 * Search open PRs in a repo by title/body — uses GitHub Search Issues API.
 * Used for the PR table search-as-you-type feature.
 */
export async function searchRepoPullsByQuery(
    token: string,
    repo: string,
    query: string,
    page = 1,
    perPage = DEFAULT_PER_PAGE
): Promise<PaginatedResponse<GitHubPullRequest>> {
    const q = encodeURIComponent(`${query} is:pr is:open repo:${env.GITHUB_ORG}/${repo} in:title`);
    const result = await get<SearchResponse<SearchIssueItem>>(
        `/search/issues?q=${q}&sort=updated&order=desc&per_page=${perPage}&page=${page}`,
        token
    );
    return {
        data: result.items.filter(i => i.pull_request).map(toGitHubPR),
        page,
        perPage,
        total: result.total_count,
        hasNextPage: page * perPage < result.total_count
    };
}

/**
 * Search PRs in the org authored by the given user (open + closed).
 * Uses the resolved token (PAT when configured) for SAML SSO access.
 * Results are sorted by most-recently-updated; state filtering is done client-side.
 */
export async function listUserPRs(
    oauthToken: string,
    login: string,
    page = 1,
    perPage = DEFAULT_PER_PAGE
): Promise<PaginatedResponse<GitHubMyPR>> {
    const token = resolveToken(oauthToken);
    const q = encodeURIComponent(`is:pr author:${login} org:${env.GITHUB_ORG}`);
    const result = await get<SearchResponse<SearchIssueItem>>(
        `/search/issues?q=${q}&sort=updated&order=desc&per_page=${perPage}&page=${page}`,
        token
    );
    return {
        data: result.items.filter(i => i.pull_request).map(toGitHubMyPR),
        page,
        perPage,
        total: result.total_count,
        hasNextPage: page * perPage < result.total_count
    };
}

/**
 * Search org repos by name — uses GitHub Search API.
 * Used for the sidebar search-as-you-type feature.
 * GitHub Search API provides fuzzy matching across repo names and descriptions.
 */
export async function searchOrgReposByName(
    token: string,
    query: string,
    page = 1,
    perPage = DEFAULT_PER_PAGE
): Promise<PaginatedResponse<GitHubRepo>> {
    const q = encodeURIComponent(`${query} org:${env.GITHUB_ORG} fork:true archived:false in:name`);
    const result = await get<SearchResponse<GitHubRepo>>(
        `/search/repositories?q=${q}&sort=best-match&order=desc&per_page=${perPage}&page=${page}`,
        token
    );
    return {
        data: result.items,
        page,
        perPage,
        total: result.total_count,
        hasNextPage: page * perPage < result.total_count
    };
}

// ─── Helpers ─────────────────────────────────────────────────

function logRateLimit(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining');
    const limit = headers.get('x-ratelimit-limit');
    if (remaining && limit) {
        log.debug('GitHub rate limit', {
            remaining: parseInt(remaining, 10),
            limit: parseInt(limit, 10)
        });
    }
}

/** Custom error for GitHub API failures. */
export class GitHubApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly path: string
    ) {
        super(`GitHub API ${status}: ${message} (${path})`);
        this.name = 'GitHubApiError';
    }
}

export const SAML_HELP_URL = `https://github.com/settings/connections/applications/${env.GITHUB_CLIENT_ID}`;

export const SAML_NOTICE =
    'Your org requires SAML SSO authorization for this app. ' +
    'Results may be limited. Ask an org admin to approve PReminder.';

// ─── Internal Types ──────────────────────────────────────────

interface SearchCommitsResponse {
    total_count: number;
    items: {
        sha: string;
        commit: {
            author: { name: string; email: string; date: string } | null;
        };
    }[];
}

interface SearchIssueItem {
    id: number;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    draft?: boolean;
    user: GitHubUser;
    labels: GitHubLabel[];
    created_at: string;
    updated_at: string;
    /** e.g. "https://api.github.com/repos/org/repo-name" */
    repository_url?: string;
    pull_request?: { url: string; html_url: string; diff_url: string; patch_url: string };
}

/** Extract short repo name from GitHub repository_url (last path segment). */
function repoNameFromUrl(url: string | undefined): string {
    if (!url) return '';
    return url.split('/').pop() ?? '';
}

/** Map a SearchIssueItem to a GitHubMyPR (includes repo_name). */
function toGitHubMyPR(item: SearchIssueItem): GitHubMyPR {
    return {
        ...toGitHubPR(item),
        repo_name: repoNameFromUrl(item.repository_url)
    };
}

function toGitHubPR(item: SearchIssueItem): GitHubPullRequest {
    return {
        id: item.id,
        number: item.number,
        title: item.title,
        body: item.body ?? null,
        html_url: item.pull_request?.html_url ?? item.html_url,
        state: item.state as 'open' | 'closed',
        draft: item.draft ?? false,
        created_at: item.created_at,
        updated_at: item.updated_at,
        user: item.user,
        requested_reviewers: [],
        requested_teams: [],
        labels: item.labels,
        head: { ref: '', sha: '' },
        base: { ref: '' }
    };
}
