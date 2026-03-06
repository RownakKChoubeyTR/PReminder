'use client';

import { ReminderLogTable } from '@/components/reminders/reminder-log-table';
import styles from './page.module.scss';

// ─────────────────────────────────────────────────────────────
// Reminders Page — View reminder history
// ─────────────────────────────────────────────────────────────

export default function RemindersPage() {
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Reminder History</h1>
                <p className={styles.pageDescription}>
                    View all reminders sent to reviewers. Track delivery status and retry failed messages.
                </p>
            </div>

            <ReminderLogTable />
        </div>
    );
}
