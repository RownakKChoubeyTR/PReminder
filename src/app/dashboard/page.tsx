'use client';

import { PRDetailModal } from '@/components/pr/pr-detail-modal';
import { PRTable } from '@/components/pr/pr-table';
import { useDashboardStore } from '@/hooks/use-dashboard-store';
import styles from './page.module.scss';

// ─────────────────────────────────────────────────────────────
// Dashboard Home — Open PRs Overview
// ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { selectedRepo } = useDashboardStore();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{selectedRepo ? selectedRepo : 'Open Pull Requests'}</h1>
        <p className={styles.pageDescription}>
          {selectedRepo
            ? `Viewing open pull requests for ${selectedRepo}`
            : 'Select a repository from the sidebar to view open PRs and their reviewer status.'}
        </p>
      </div>

      <PRTable />
      <PRDetailModal />
    </div>
  );
}
