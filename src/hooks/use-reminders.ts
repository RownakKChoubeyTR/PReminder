'use client';

import type { SendReminderPayload, SendReminderResult } from '@/types/reminders';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// useReminders — Hooks for sending reminders and viewing history
// ─────────────────────────────────────────────────────────────

/** Reminder log entry returned by the API. */
export interface ReminderLogEntry {
  id: string;
  prNumber: number;
  repo: string;
  owner: string;
  prTitle: string | null;
  reviewerGithub: string;
  reviewerEmail: string | null;
  method: string;
  templateId: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

interface ReminderLogResponse {
  data: ReminderLogEntry[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
}

interface CooldownResponse {
  data: Array<{
    login: string;
    allowed: boolean;
    remainingSeconds: number;
  }>;
}

// ── Fetch functions ────────────────────────────────────────

async function fetchReminderLogs(
  page: number,
  perPage: number,
): Promise<ReminderLogResponse> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const res = await fetch(`/api/reminders?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch reminders (${res.status})`);
  }
  return res.json();
}

async function sendReminders(
  payload: SendReminderPayload,
): Promise<SendReminderResult> {
  const res = await fetch('/api/reminders/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to send reminders (${res.status})`);
  }
  return res.json();
}

async function checkCooldowns(
  recipients: string[],
  prNumber: number,
  repo: string,
): Promise<CooldownResponse> {
  const params = new URLSearchParams({
    recipients: recipients.join(','),
    prNumber: String(prNumber),
    repo,
  });
  const res = await fetch(`/api/reminders/cooldown?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to check cooldowns (${res.status})`);
  }
  return res.json();
}

// ── Hooks ──────────────────────────────────────────────────

/** Fetch paginated reminder history. */
export function useReminderLogs(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['reminder-logs', page, perPage],
    queryFn: () => fetchReminderLogs(page, perPage),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

/** Send reminders mutation. */
export function useSendReminders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendReminders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-logs'] });
    },
  });
}

/** Check cooldown status for recipients. */
export function useCooldownCheck(
  recipients: string[],
  prNumber: number | null,
  repo: string | null,
) {
  return useQuery({
    queryKey: ['cooldown', [...recipients].sort(), prNumber, repo],
    queryFn: () => checkCooldowns(recipients, prNumber!, repo!),
    enabled: recipients.length > 0 && !!prNumber && !!repo,
    staleTime: 30 * 1000,
  });
}
