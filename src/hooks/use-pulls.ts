'use client';

import type { GitHubPullRequest, PaginatedResponse } from '@/types/github';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// usePulls — Fetch open PRs for a repository (paginated + search)
//
// When `search` ≥ 3 chars: server-side search via GitHub Search API
// Otherwise: standard paginated list
// ─────────────────────────────────────────────────────────────

async function fetchPulls(
  repo: string,
  page: number,
  perPage: number,
  search: string,
): Promise<PaginatedResponse<GitHubPullRequest>> {
  const params = new URLSearchParams({
    repo,
    page: String(page),
    per_page: String(perPage),
  });
  if (search.length >= 3) {
    params.set('search', search);
  }

  const res = await fetch(`/api/github/pulls?${params.toString()}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch PRs (${res.status})`);
  }

  return res.json();
}

export function usePulls(repo: string | null, page = 1, perPage = 30, search = '') {
  const isSearching = search.length >= 3;

  return useQuery({
    queryKey: ['pulls', repo, page, perPage, search],
    queryFn: () => fetchPulls(repo!, page, perPage, search),
    enabled: !!repo,
    staleTime: isSearching ? 30 * 1000 : 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
