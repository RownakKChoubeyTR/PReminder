import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock env and logger
vi.mock('@/lib/env', () => ({
    env: {
        GITHUB_ORG: 'test-org',
        GITHUB_PAT: undefined,
        GITHUB_CLIENT_ID: 'client-id'
    }
}));

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }))
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const {
    resolveToken,
    isSamlError,
    searchOrgRepos,
    searchRepoPulls,
    searchRepoPullsByQuery,
    getUserProfile,
    listOpenPulls,
    listReviews,
    listUserPRs,
    getPullRequest,
    getCommitEmailForUser,
    getAuthenticatedUser,
    GitHubApiError,
    SAML_NOTICE,
    SAML_HELP_URL
} = await import('@/lib/github/client');

beforeEach(() => {
    mockFetch.mockReset();
});

describe('resolveToken', () => {
    it('returns OAuth token when no PAT configured', () => {
        expect(resolveToken('oauth-123')).toBe('oauth-123');
    });
});

describe('isSamlError', () => {
    it('returns true for 403 SAML error', () => {
        const err = new GitHubApiError(403, 'Resource protected by SAML enforcement', '/orgs/test');
        expect(isSamlError(err)).toBe(true);
    });

    it('returns false for non-403 errors', () => {
        const err = new GitHubApiError(404, 'Not Found', '/orgs/test');
        expect(isSamlError(err)).toBe(false);
    });

    it('returns false for 403 without SAML message', () => {
        const err = new GitHubApiError(403, 'rate limit exceeded', '/orgs/test');
        expect(isSamlError(err)).toBe(false);
    });

    it('returns false for non-GitHubApiError', () => {
        expect(isSamlError(new Error('generic error'))).toBe(false);
    });
});

describe('searchOrgRepos', () => {
    it('returns paginated repos from Search API', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    total_count: 1,
                    incomplete_results: false,
                    items: [{ id: 1, name: 'search-repo' }]
                }),
            headers: new Headers()
        });

        const result = await searchOrgRepos('token', 1, 10);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]!.name).toBe('search-repo');
        expect(result.total).toBe(1);
        expect(result.hasNextPage).toBe(false);
    });

    it('reports hasNextPage when more results exist', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    total_count: 50,
                    items: [{ id: 1, name: 'repo' }]
                }),
            headers: new Headers()
        });

        const result = await searchOrgRepos('token', 1, 10);
        expect(result.hasNextPage).toBe(true);
    });
});

describe('searchRepoPulls', () => {
    it('returns paginated PRs from Search API', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    total_count: 1,
                    items: [
                        {
                            id: 1,
                            number: 10,
                            title: 'PR via search',
                            body: null,
                            html_url: 'https://github.com/org/repo/pull/10',
                            state: 'open',
                            user: { id: 1, login: 'alice' },
                            labels: [],
                            created_at: '2025-01-01T00:00:00Z',
                            updated_at: '2025-01-02T00:00:00Z',
                            pull_request: {
                                url: '',
                                html_url: 'https://github.com/pr/10',
                                diff_url: '',
                                patch_url: ''
                            }
                        }
                    ]
                }),
            headers: new Headers()
        });

        const result = await searchRepoPulls('token', 'my-repo');
        expect(result.data).toHaveLength(1);
        expect(result.data[0]!.number).toBe(10);
        expect(result.data[0]!.html_url).toBe('https://github.com/pr/10');
        // Verify search API items that lack full PR data get defaults
        expect(result.data[0]!.requested_reviewers).toEqual([]);
        expect(result.data[0]!.head.ref).toBe('');
    });

    it('filters out non-PR items', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    total_count: 2,
                    items: [
                        {
                            id: 1,
                            number: 10,
                            title: 'Issue',
                            body: null,
                            html_url: '#',
                            state: 'open',
                            user: { id: 1, login: 'a' },
                            labels: [],
                            created_at: '',
                            updated_at: ''
                            // No pull_request → should be filtered
                        },
                        {
                            id: 2,
                            number: 11,
                            title: 'PR',
                            body: null,
                            html_url: '#',
                            state: 'open',
                            user: { id: 2, login: 'b' },
                            labels: [],
                            created_at: '',
                            updated_at: '',
                            pull_request: { url: '', html_url: '#', diff_url: '', patch_url: '' }
                        }
                    ]
                }),
            headers: new Headers()
        });

        const result = await searchRepoPulls('token', 'my-repo');
        expect(result.data).toHaveLength(1);
    });
});

describe('searchRepoPullsByQuery', () => {
    it('searches PRs by query text', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    total_count: 1,
                    items: [
                        {
                            id: 1,
                            number: 42,
                            title: 'Login fix',
                            body: null,
                            html_url: '#',
                            state: 'open',
                            user: { id: 1, login: 'alice' },
                            labels: [],
                            created_at: '',
                            updated_at: '',
                            pull_request: { url: '', html_url: '#', diff_url: '', patch_url: '' }
                        }
                    ]
                }),
            headers: new Headers()
        });

        const result = await searchRepoPullsByQuery('token', 'my-repo', 'login');
        expect(result.data).toHaveLength(1);
        expect(result.data[0]!.title).toBe('Login fix');
        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('login');
    });
});

describe('timeout handling', () => {
    it('throws 408 on fetch timeout', async () => {
        mockFetch.mockImplementation(() => {
            return new Promise((_, reject) => {
                const err = new Error('aborted');
                err.name = 'AbortError';
                reject(err);
            });
        });

        await expect(listOpenPulls('token', 'repo')).rejects.toThrow('timed out');
    });
});

describe('pagination (getAll)', () => {
    it('fetches multiple pages for reviews', async () => {
        // Page 1: has next
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ id: 1, state: 'APPROVED' }]),
            headers: new Headers({ Link: '<url>; rel="next"' })
        });
        // Page 2: no next
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ id: 2, state: 'CHANGES_REQUESTED' }]),
            headers: new Headers()
        });

        const result = await listReviews('token', 'repo', 42);
        expect(result).toHaveLength(2);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});

describe('constants', () => {
    it('SAML_NOTICE is a string', () => {
        expect(typeof SAML_NOTICE).toBe('string');
        expect(SAML_NOTICE).toContain('SAML');
    });

    it('SAML_HELP_URL contains client id', () => {
        expect(SAML_HELP_URL).toContain('client-id');
    });
});

describe('rate limit logging', () => {
    it('logs rate limit when headers present', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([]),
            headers: new Headers({
                'x-ratelimit-remaining': '4999',
                'x-ratelimit-limit': '5000'
            })
        });

        await listOpenPulls('token', 'repo');
        // No assertion needed — just ensure it doesn't error
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

describe('getUserProfile', () => {
    it('returns full user profile with email', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    id: 123,
                    login: 'alice',
                    avatar_url: '',
                    html_url: '',
                    type: 'User',
                    name: 'Alice',
                    email: 'alice@corp.com',
                    company: 'Acme',
                    bio: 'Dev'
                }),
            headers: new Headers()
        });

        const profile = await getUserProfile('token', 'alice');
        expect(profile).not.toBeNull();
        expect(profile!.email).toBe('alice@corp.com');
        expect(profile!.name).toBe('Alice');
    });

    it('returns null for 404 user not found', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: () => Promise.resolve({ message: 'Not Found' }),
            headers: new Headers()
        });

        const profile = await getUserProfile('token', 'ghost');
        expect(profile).toBeNull();
    });

    it('returns null on non-404 error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.resolve({ message: 'Server Error' }),
            headers: new Headers()
        });

        const profile = await getUserProfile('token', 'alice');
        expect(profile).toBeNull();
    });
});

describe('listUserPRs', () => {
    const makeItem = (overrides: Record<string, unknown> = {}) => ({
        id: 1,
        number: 10,
        title: 'My PR',
        body: null,
        html_url: 'https://github.com/org/repo/pull/10',
        state: 'open',
        draft: false,
        user: { id: 1, login: 'alice', avatar_url: '', type: 'User' },
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        pull_request: { url: '', html_url: 'https://github.com/pr/10', diff_url: '', patch_url: '' },
        repository_url: 'https://api.github.com/repos/test-org/my-repo',
        ...overrides
    });

    it('constructs search query with author and org', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ total_count: 1, items: [makeItem()] }),
            headers: new Headers()
        });

        await listUserPRs('oauth-token', 'alice', 1, 30);

        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('author%3Aalice');
        expect(url).toContain('test-org');
    });

    it('maps repository_url to repo_name', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ total_count: 1, items: [makeItem()] }),
            headers: new Headers()
        });

        const result = await listUserPRs('oauth-token', 'alice', 1, 30);
        expect(result.data[0]!.repo_name).toBe('my-repo');
    });

    it('filters out non-PR search items', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    total_count: 2,
                    items: [
                        { ...makeItem({ id: 1 }), pull_request: undefined }, // issue — filtered
                        makeItem({ id: 2, number: 11 })
                    ]
                }),
            headers: new Headers()
        });

        const result = await listUserPRs('oauth-token', 'alice', 1, 30);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]!.number).toBe(11);
    });

    it('reports total and hasNextPage from total_count', async () => {
        const items = Array.from({ length: 10 }, (_, i) => makeItem({ id: i + 1, number: i + 1 }));
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ total_count: 50, items }),
            headers: new Headers()
        });

        const result = await listUserPRs('oauth-token', 'alice', 1, 10);
        expect(result.total).toBe(50);
        expect(result.hasNextPage).toBe(true);
    });

    it('hasNextPage is false when on last page', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ total_count: 1, items: [makeItem()] }),
            headers: new Headers()
        });

        const result = await listUserPRs('oauth-token', 'alice', 1, 30);
        expect(result.hasNextPage).toBe(false);
    });
});

// ─── getPullRequest ──────────────────────────────────────────

describe('getPullRequest', () => {
    const prPayload = { id: 1, number: 42, title: 'Fix bug', state: 'open' };

    it('returns a PR when found', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(prPayload),
            headers: new Headers()
        });

        const result = await getPullRequest('token', 'my-repo', 42);
        expect(result).toMatchObject({ number: 42, title: 'Fix bug' });
    });

    it('returns null on 404', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ message: 'Not Found' }),
            headers: new Headers()
        });

        const result = await getPullRequest('token', 'my-repo', 999);
        expect(result).toBeNull();
    });

    it('returns null on 410 (gone)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 410,
            json: () => Promise.resolve({ message: 'Gone' }),
            headers: new Headers()
        });

        const result = await getPullRequest('token', 'my-repo', 5);
        expect(result).toBeNull();
    });

    it('returns null and logs on unexpected error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network failure'));

        const result = await getPullRequest('token', 'my-repo', 1);
        expect(result).toBeNull();
    });
});

// ─── getCommitEmailForUser ───────────────────────────────────

describe('getCommitEmailForUser', () => {
    const makeCommitItem = (email: string, name = 'Dev') => ({
        commit: { author: { email, name } }
    });

    it('returns email and name from the first valid commit', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    items: [makeCommitItem('dev@example.com', 'Dev User')]
                }),
            headers: new Headers()
        });

        const result = await getCommitEmailForUser('token', 'dev');
        expect(result).toEqual({ email: 'dev@example.com', name: 'Dev User' });
    });

    it('skips noreply GitHub emails', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                Promise.resolve({
                    items: [
                        makeCommitItem('123+dev@users.noreply.github.com'),
                        makeCommitItem('dev@example.com', 'Dev')
                    ]
                }),
            headers: new Headers()
        });

        const result = await getCommitEmailForUser('token', 'dev');
        expect(result?.email).toBe('dev@example.com');
    });

    it('returns null when no valid email is found', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ items: [makeCommitItem('123+dev@users.noreply.github.com')] }),
            headers: new Headers()
        });

        const result = await getCommitEmailForUser('token', 'dev');
        expect(result).toBeNull();
    });

    it('returns null and logs on fetch error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('timeout'));

        const result = await getCommitEmailForUser('token', 'dev');
        expect(result).toBeNull();
    });
});

// ─── getAuthenticatedUser ────────────────────────────────────

describe('getAuthenticatedUser', () => {
    it('returns user profile', async () => {
        const userPayload = { id: 1, login: 'octocat', name: 'Octocat', email: null };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(userPayload),
            headers: new Headers()
        });

        const result = await getAuthenticatedUser('token');
        expect(result).toMatchObject({ login: 'octocat' });
    });
});
