'use client';

import type { GitHubMyPR, PaginatedResponse } from '@/types/github';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// useMyPRs — Fetch all PRs authored by the signed-in user (open + closed)
//
// Fetches all states in one call; status filtering / sorting is done
// client-side so switching the status column sort never triggers a refetch.
// ─────────────────────────────────────────────────────────────

async function fetchMyPRs(page: number, perPage: number): Promise<PaginatedResponse<GitHubMyPR>> {
    const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage)
    });

    const res = await fetch(`/api/github/my-prs?${params.toString()}`);

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch your PRs (${res.status})`);
    }

    return res.json();
}

export function useMyPRs(page = 1, perPage = 30) {
    return useQuery({
        queryKey: ['my-prs', page, perPage],
        queryFn: () => fetchMyPRs(page, perPage),
        // 5-minute staleTime — no refetch when revisiting the tab
        staleTime: 5 * 60 * 1000,
        // Keep data in memory for 10 min after unmount
        gcTime: 10 * 60 * 1000,
        placeholderData: keepPreviousData
    });
}
