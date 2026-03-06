'use client';

import type { ReviewerInfo } from '@/types/github';
import { useQuery } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// useReviewers — Fetch reviewer breakdown for a PR
// ─────────────────────────────────────────────────────────────

interface ReviewersResponse {
  data: ReviewerInfo[];
}

async function fetchReviewers(repo: string, prNumber: number): Promise<ReviewersResponse> {
  const res = await fetch(
    `/api/github/reviewers?repo=${encodeURIComponent(repo)}&pr=${prNumber}`,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch reviewers (${res.status})`);
  }

  return res.json();
}

export function useReviewers(repo: string | null, prNumber: number | null) {
  return useQuery({
    queryKey: ['reviewers', repo, prNumber],
    queryFn: () => fetchReviewers(repo!, prNumber!),
    enabled: !!repo && !!prNumber,
    staleTime: 1 * 60 * 1000, // reviewer status changes more frequently
  });
}
