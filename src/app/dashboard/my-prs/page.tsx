'use client';

import { MyPRsTable } from '@/components/pr/my-prs-table';
import { PRDetailModal } from '@/components/pr/pr-detail-modal';
import styles from './page.module.scss';

// ─────────────────────────────────────────────────────────────
// My PRs Page — All PRs the signed-in user is involved in
// ─────────────────────────────────────────────────────────────

export default function MyPRsPage() {
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>My PRs</h1>
                <p className={styles.pageDescription}>
                    All pull requests across the organisation where you are the author, reviewer, assignee, or have been
                    mentioned.
                </p>
            </div>

            <MyPRsTable />
            <PRDetailModal />
        </div>
    );
}
