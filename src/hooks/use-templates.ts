'use client';

import type { MessageTemplate, TemplateInput } from '@/types/templates';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// useTemplates — CRUD hooks for message templates
// ─────────────────────────────────────────────────────────────

interface TemplatesResponse {
  data: MessageTemplate[];
}

interface TemplateResponse {
  data: MessageTemplate;
}

async function fetchTemplates(): Promise<TemplatesResponse> {
  const res = await fetch('/api/templates');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch templates (${res.status})`);
  }
  return res.json();
}

async function createTemplate(input: TemplateInput): Promise<TemplateResponse> {
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to create template (${res.status})`);
  }
  return res.json();
}

async function updateTemplate(id: string, input: TemplateInput): Promise<TemplateResponse> {
  const res = await fetch(`/api/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to update template (${res.status})`);
  }
  return res.json();
}

async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/templates/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to delete template (${res.status})`);
  }
}

/** Fetch all user templates. */
export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
    staleTime: 5 * 60 * 1000,
  });
}

/** Create a new template. */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

/** Update an existing template. */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TemplateInput }) => updateTemplate(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

/** Delete a template. */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
