'use client';

import { useReminderStore } from '@/hooks/use-reminder-store';
import styles from './bulk-action-bar.module.scss';

// ─────────────────────────────────────────────────────────────
// Bulk Action Bar — Sticky bar when reviewers are selected
// ─────────────────────────────────────────────────────────────

export function BulkActionBar() {
  const { selectedReviewers, clearReviewers, openFlow } = useReminderStore();

  if (selectedReviewers.length === 0) return null;

  return (
    <div className={styles.bar} role="toolbar" aria-label="Reviewer actions">
      <div className={styles.info}>
        <span className={styles.count}>
          {selectedReviewers.length}
        </span>
        <span className={styles.label}>
          {selectedReviewers.length === 1 ? 'reviewer' : 'reviewers'} selected
        </span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.clearButton}
          onClick={clearReviewers}
        >
          Clear
        </button>
        <button
          type="button"
          className={styles.sendButton}
          onClick={openFlow}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m22 2-7 20-4-9-9-4z" />
            <path d="M22 2 11 13" />
          </svg>
          Send Reminder
        </button>
      </div>
    </div>
  );
}
