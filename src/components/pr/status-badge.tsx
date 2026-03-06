import type { ReviewerStatus } from '@/types/github';
import styles from './status-badge.module.scss';

// ─────────────────────────────────────────────────────────────
// Status Badge — Visual indicator for PR/review status
// ─────────────────────────────────────────────────────────────

type BadgeVariant = ReviewerStatus | 'draft' | 'open' | 'closed';

const LABELS: Record<BadgeVariant, string> = {
  approved: 'Approved',
  changes_requested: 'Changes Requested',
  commented: 'Commented',
  pending: 'Pending',
  awaiting: 'Awaiting',
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
};

interface StatusBadgeProps {
  status: BadgeVariant;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variantClass = styles[status] ?? styles.pending;

  return (
    <span className={`${styles.badge} ${variantClass} ${className ?? ''}`}>
      <span className={styles.dot} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
