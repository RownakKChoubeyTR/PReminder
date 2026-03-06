'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// useEmailMappings — CRUD hooks for GitHub → email mappings
// ─────────────────────────────────────────────────────────────

export interface EmailMapping {
    id: string;
    githubUsername: string;
    email: string;
    displayName: string | null;
    source: string;
    createdAt: string;
}

interface EmailMappingsResponse {
    data: EmailMapping[];
}

interface CreateMappingInput {
    githubUsername: string;
    email: string;
    displayName?: string;
}

// ── Fetch functions ────────────────────────────────────────

async function fetchMappings(): Promise<EmailMappingsResponse> {
    const res = await fetch('/api/email-mappings');
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch mappings (${res.status})`);
    }
    return res.json();
}

async function createMapping(input: CreateMappingInput): Promise<{ data: EmailMapping }> {
    const res = await fetch('/api/email-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to create mapping (${res.status})`);
    }
    return res.json();
}

async function deleteMapping(id: string): Promise<void> {
    const res = await fetch(`/api/email-mappings/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to delete mapping (${res.status})`);
    }
}

// ── Hooks ──────────────────────────────────────────────────

export function useEmailMappings() {
    return useQuery({
        queryKey: ['email-mappings'],
        queryFn: fetchMappings,
        staleTime: 5 * 60 * 1000
    });
}

export function useCreateEmailMapping() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createMapping,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-mappings'] });
        }
    });
}

export function useDeleteEmailMapping() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteMapping,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-mappings'] });
        }
    });
}
