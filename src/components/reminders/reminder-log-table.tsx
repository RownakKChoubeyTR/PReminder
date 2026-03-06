'use client';

import { useReminderLogs } from '@/hooks/use-reminders';
import type { ReminderLogEntry } from '@/hooks/use-reminders';
import { useState } from 'react';
import styles from './reminder-log-table.module.scss';

// ─────────────────────────────────────────────────────────────
// Reminder Log Table — History of sent reminders
// ─────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  TEAMS_DM_POWER_AUTOMATE: 'Teams DM',
  TEAMS_DM_DEEPLINK: 'Deep Link',
  TEAMS_CHANNEL_WEBHOOK: 'Channel',
  EMAIL_GRAPH: 'Email',
  EMAIL_MAILTO: 'Email (mailto)',
};

const STATUS_STYLES: Record<string, string> = {
  SENT: 'statusSent',
  FAILED: 'statusFailed',
  OPENED: 'statusOpened',
  QUEUED: 'statusQueued',
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(dateStr: string): string {
  return dateFormatter.format(new Date(dateStr));
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelativeTime(dateStr: string): string {
  const seconds = Math.round((new Date(dateStr).getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) return rtf.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(seconds / 3600);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(seconds / 86400);
  return rtf.format(days, 'day');
}

export function ReminderLogTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch, isFetching } = useReminderLogs(page, 20);

  if (isLoading) {
    return (
      <div className={styles.loading} role="status">
        <div className={styles.spinner} />
        <span>Loading reminder history\u2026</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error} role="alert">
        <p>Failed to load reminder history.</p>
        <button type="button" className={styles.retryButton} onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const logs = data?.data ?? [];

  if (logs.length === 0) {
    return (
      <div className={styles.empty}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m22 2-7 20-4-9-9-4z" />
          <path d="M22 2 11 13" />
        </svg>
        <h2 className={styles.emptyTitle}>No reminders sent yet</h2>
        <p className={styles.emptyDescription}>
          Open a PR, select reviewers, and send your first reminder.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Reviewer</th>
              <th>PR</th>
              <th>Repository</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: ReminderLogEntry) => (
              <tr key={log.id}>
                <td>
                  <span className={styles.reviewer}>@{log.reviewerGithub}</span>
                </td>
                <td>
                  <span className={styles.prNumber}>#{log.prNumber}</span>
                  {log.prTitle && (
                    <span className={styles.prTitle}>{log.prTitle}</span>
                  )}
                </td>
                <td>
                  <span className={styles.repo}>{log.repo}</span>
                </td>
                <td>
                  <span className={styles.method}>
                    {METHOD_LABELS[log.method] ?? log.method}
                  </span>
                </td>
                <td>
                  <span className={`${styles.status} ${styles[STATUS_STYLES[log.status] ?? '']}`}>
                    {log.status}
                  </span>
                  {log.errorMessage && (
                    <span className={styles.errorMsg} title={log.errorMessage}>
                      {log.errorMessage.slice(0, 40)}
                    </span>
                  )}
                </td>
                <td>
                  <span className={styles.sentAt} title={formatDate(log.sentAt)}>
                    {formatRelativeTime(log.sentAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && (data.hasNextPage || page > 1) && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageButton}
            disabled={page <= 1 || isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>Page {page}</span>
          <button
            type="button"
            className={styles.pageButton}
            disabled={!data.hasNextPage || isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
