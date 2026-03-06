'use client';

import type { GitHubRepo, PaginatedResponse } from '@/types/github';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// useRepos — Fetch org repositories (paginated + server search)
//
// When `search` is provided (3+ chars), the API uses GitHub
// Search API for server-side fuzzy matching across all org repos.
// Otherwise returns the paginated browse view.
// ─────────────────────────────────────────────────────────────

async function fetchRepos(
  page: number,
  perPage: number,
  search: string,
): Promise<PaginatedResponse<GitHubRepo>> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (search) params.set('search', search);

  const res = await fetch(`/api/github/repos?${params}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch repos (${res.status})`);
  }

  return res.json();
}

export function useRepos(page = 1, perPage = 30, search = '') {
  return useQuery({
    queryKey: ['repos', page, perPage, search],
    queryFn: () => fetchRepos(page, perPage, search),
    staleTime: search ? 30 * 1000 : 5 * 60 * 1000, // search results stale faster
    placeholderData: keepPreviousData,
  });
}
