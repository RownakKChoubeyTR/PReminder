'use client';

import { useReminderStore } from '@/hooks/use-reminder-store';
import { useReviewers } from '@/hooks/use-reviewers';
import type { ReviewerInfo } from '@/types/github';
import styles from './reviewer-list.module.scss';
import { StatusBadge } from './status-badge';

// ─────────────────────────────────────────────────────────────
// Reviewer List — Shows reviewer breakdown with statuses
//   + Checkbox selection for bulk reminders (Phase 3)
// ─────────────────────────────────────────────────────────────

interface ReviewerListProps {
  repo: string;
  prNumber: number;
  selectable?: boolean;
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

export function ReviewerList({ repo, prNumber, selectable = false }: ReviewerListProps) {
  const { data, isLoading, error } = useReviewers(repo, prNumber);
  const { selectedReviewers, toggleReviewer, selectAllReviewers, deselectReviewers } =
    useReminderStore();

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading reviewers">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.empty} role="alert">
        Failed to load reviewers
      </div>
    );
  }

  const reviewers = data?.data ?? [];

  if (reviewers.length === 0) {
    return <div className={styles.empty}>No reviewers requested for this PR.</div>;
  }

  const allLogins = reviewers.map((r: ReviewerInfo) => r.user.login);
  const allSelected =
    allLogins.length > 0 && allLogins.every((l: string) => selectedReviewers.includes(l));
  const someSelected = allLogins.some((l: string) => selectedReviewers.includes(l));

  const handleSelectAll = () => {
    if (allSelected) {
      deselectReviewers(allLogins);
    } else {
      selectAllReviewers(allLogins);
    }
  };

  return (
    <div>
      {/* Select all header */}
      {selectable && reviewers.length > 0 && (
        <div className={styles.selectAllRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={handleSelectAll}
              aria-label={allSelected ? 'Deselect all reviewers' : 'Select all reviewers'}
            />
            <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
          </label>
        </div>
      )}

      <div className={styles.list} role="list" aria-label="Reviewer statuses">
        {reviewers.map((reviewer: ReviewerInfo) => {
          const isSelected = selectedReviewers.includes(reviewer.user.login);

          return (
            <div
              key={reviewer.user.login}
              className={`${styles.reviewer} ${selectable && isSelected ? styles.selected : ''}`}
              role="listitem"
            >
              {selectable && (
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={isSelected}
                  onChange={() => toggleReviewer(reviewer.user.login)}
                  aria-label={`Select ${reviewer.user.login}`}
                />
              )}
              <img className={styles.avatar} src={reviewer.user.avatar_url} alt="" loading="lazy" />
              <div className={styles.info}>
                <div className={styles.login}>{reviewer.user.login}</div>
                {reviewer.email && <div className={styles.email}>{reviewer.email}</div>}
                {reviewer.lastReviewedAt && (
                  <div className={styles.reviewedAt}>
                    Reviewed {formatRelativeTime(reviewer.lastReviewedAt)}
                  </div>
                )}
              </div>
              <StatusBadge status={reviewer.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
