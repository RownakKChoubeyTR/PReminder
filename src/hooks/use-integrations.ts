'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// useIntegrations — CRUD hooks for integration configs
// ─────────────────────────────────────────────────────────────

export interface IntegrationConfig {
  id: string;
  type: 'POWER_AUTOMATE_DM' | 'TEAMS_WEBHOOK';
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationsResponse {
  data: IntegrationConfig[];
}

interface CreateIntegrationInput {
  type: IntegrationConfig['type'];
  label: string;
  value: string;
}

interface UpdateIntegrationInput {
  label?: string;
  value?: string;
  isActive?: boolean;
}

interface TestResult {
  success: boolean;
  statusCode: number;
  error?: string;
}

// ── Fetch functions ────────────────────────────────────────

async function fetchIntegrations(): Promise<IntegrationsResponse> {
  const res = await fetch('/api/integrations');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch integrations (${res.status})`);
  }
  return res.json();
}

async function createIntegration(input: CreateIntegrationInput): Promise<{ data: IntegrationConfig }> {
  const res = await fetch('/api/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to create integration (${res.status})`);
  }
  return res.json();
}

async function updateIntegration(id: string, input: UpdateIntegrationInput): Promise<{ data: IntegrationConfig }> {
  const res = await fetch(`/api/integrations?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to update integration (${res.status})`);
  }
  return res.json();
}

async function deleteIntegration(id: string): Promise<void> {
  const res = await fetch(`/api/integrations?id=${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to delete integration (${res.status})`);
  }
}

async function testIntegration(id: string): Promise<TestResult> {
  const res = await fetch(`/api/integrations?id=${id}`, { method: 'PATCH' });
  return res.json();
}

// ── Hooks ──────────────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: fetchIntegrations,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIntegrationInput }) =>
      updateIntegration(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: testIntegration,
  });
}
