import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// GitHub Client Unit Tests
// ─────────────────────────────────────────────────────────────

// Mock env module before importing client
vi.mock('@/lib/env', () => ({
  env: {
    GITHUB_ORG: 'test-org',
  },
}));

// Suppress logger output in tests
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks
const {
  listOrgRepos,
  listOpenPulls,
  listReviews,
  listTeamMembers,
  getAuthenticatedUser,
  searchOrgReposByName,
  GitHubApiError,
} = await import('@/lib/github/client');

beforeEach(() => {
  mockFetch.mockReset();
});

describe('GitHubApiError', () => {
  it('should include status, message, and path', () => {
    const error = new GitHubApiError(404, 'Not Found', '/repos');
    expect(error.status).toBe(404);
    expect(error.message).toContain('404');
    expect(error.message).toContain('Not Found');
    expect(error.path).toBe('/repos');
    expect(error.name).toBe('GitHubApiError');
  });
});

describe('listOrgRepos', () => {
  it('should fetch a single page and filter out archived repos', async () => {
    const repos = [
      { id: 1, name: 'active-repo', archived: false, open_issues_count: 5 },
      { id: 2, name: 'old-repo', archived: true, open_issues_count: 0 },
      { id: 3, name: 'another-repo', archived: false, open_issues_count: 2 },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(repos),
      headers: new Headers(),
    });

    const result = await listOrgRepos('test-token');

    expect(result.data).toHaveLength(2);
    expect(result.data[0]!.name).toBe('active-repo');
    expect(result.data[1]!.name).toBe('another-repo');
    expect(result.page).toBe(1);
    expect(result.hasNextPage).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/orgs/test-org/repos'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('should report hasNextPage when Link header contains rel="next"', async () => {
    const repos = [{ id: 1, name: 'repo-1', archived: false }];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(repos),
      headers: new Headers({
        Link: '<https://api.github.com/next?page=2>; rel="next"',
      }),
    });

    const result = await listOrgRepos('test-token');

    expect(result.data).toHaveLength(1);
    expect(result.hasNextPage).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should pass page and perPage params to the API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers(),
    });

    await listOrgRepos('test-token', 3, 50);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/per_page=50&page=3/),
      expect.anything(),
    );
  });

  it('should throw GitHubApiError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ message: 'rate limit exceeded' }),
      headers: new Headers(),
    });

    await expect(listOrgRepos('bad-token')).rejects.toThrow('rate limit exceeded');
  });
});

describe('listOpenPulls', () => {
  it('should fetch a single page of open pulls for a repo', async () => {
    const pulls = [
      { id: 10, number: 1, title: 'Fix bug', state: 'open' },
      { id: 11, number: 2, title: 'Add feature', state: 'open' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(pulls),
      headers: new Headers(),
    });

    const result = await listOpenPulls('test-token', 'my-repo');

    expect(result.data).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/test-org/my-repo/pulls'),
      expect.anything(),
    );
  });
});

describe('listReviews', () => {
  it('should fetch all reviews for a PR', async () => {
    const reviews = [
      { id: 1, user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-01' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(reviews),
      headers: new Headers(),
    });

    const result = await listReviews('test-token', 'my-repo', 42);

    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/test-org/my-repo/pulls/42/reviews'),
      expect.anything(),
    );
  });
});

describe('listTeamMembers', () => {
  it('should fetch team members', async () => {
    const members = [{ id: 1, login: 'member1', avatar_url: 'https://example.com/1.png' }];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(members),
      headers: new Headers(),
    });

    const result = await listTeamMembers('test-token', 'frontend-team');

    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/orgs/test-org/teams/frontend-team/members'),
      expect.anything(),
    );
  });
});

describe('getAuthenticatedUser', () => {
  it('should fetch authenticated user profile', async () => {
    const user = { id: 123, login: 'testuser', avatar_url: 'https://example.com/avatar.png' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(user),
      headers: new Headers(),
    });

    const result = await getAuthenticatedUser('test-token');

    expect(result.login).toBe('testuser');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/user'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('should throw on failed request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Bad credentials' }),
      headers: new Headers(),
    });

    await expect(getAuthenticatedUser('bad-token')).rejects.toThrow('Bad credentials');
  });
});

describe('searchOrgReposByName', () => {
  it('should search repos via GitHub Search API with org scoped query', async () => {
    const searchResult = {
      total_count: 2,
      incomplete_results: false,
      items: [
        { id: 1, name: 'react-app', archived: false },
        { id: 2, name: 'react-lib', archived: false },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(searchResult),
      headers: new Headers(),
    });

    const result = await searchOrgReposByName('test-token', 'react');

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.hasNextPage).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/repositories'),
      expect.anything(),
    );
    // Verify org scoping is in the query
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('org%3Atest-org');
    expect(url).toContain('in%3Aname');
  });

  it('should report hasNextPage when results exceed page size', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          total_count: 50,
          incomplete_results: false,
          items: Array.from({ length: 10 }, (_, i) => ({ id: i, name: `repo-${i}` })),
        }),
      headers: new Headers(),
    });

    const result = await searchOrgReposByName('test-token', 'repo', 1, 10);

    expect(result.hasNextPage).toBe(true);
    expect(result.total).toBe(50);
  });
});
