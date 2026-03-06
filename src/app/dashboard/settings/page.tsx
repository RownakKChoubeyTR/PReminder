import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './page.module.scss';

// ─────────────────────────────────────────────────────────────
// Settings Page — Hub for all settings sub-pages
// ─────────────────────────────────────────────────────────────

export const metadata: Metadata = {
    title: 'Settings'
};

const SETTINGS_ITEMS = [
    {
        title: 'Integrations',
        description: 'Configure Teams webhooks, Power Automate flows, and email mappings.',
        href: '/dashboard/settings/integrations',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
        )
    }
] as const;

export default function SettingsPage() {
    return (
        <div className={styles.page}>
            <h1 className={styles.pageTitle}>Settings</h1>
            <p className={styles.pageDescription}>Manage integrations, notification preferences, and email mappings.</p>
            <div className={styles.grid}>
                {SETTINGS_ITEMS.map(item => (
                    <Link key={item.href} href={item.href} className={styles.card}>
                        <div className={styles.cardIcon}>{item.icon}</div>
                        <div>
                            <h2 className={styles.cardTitle}>{item.title}</h2>
                            <p className={styles.cardDescription}>{item.description}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
