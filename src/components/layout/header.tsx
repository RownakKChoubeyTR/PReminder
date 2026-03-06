'use client';

import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { getQueryClient } from '@/lib/query-client';
import { useState } from 'react';
import styles from './header.module.scss';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

// ─────────────────────────────────────────────────────────────
// Header — Top bar with breadcrumbs, actions, user menu
// ─────────────────────────────────────────────────────────────

interface HeaderProps {
    onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    const { selectedRepo, sidebarCollapsed, toggleSidebar } = useDashboardStore();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        const queryClient = getQueryClient();
        await queryClient.invalidateQueries({ queryKey: ['repos'] });
        if (selectedRepo) {
            await queryClient.invalidateQueries({ queryKey: ['pulls', selectedRepo] });
        }
        // Small delay so the user can see the animation
        setTimeout(() => setIsRefreshing(false), 600);
    };

    return (
        <header className={`${styles.header} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
            <div className={styles.left}>
                {/* Mobile hamburger */}
                <button
                    type="button"
                    className={styles.menuButton}
                    onClick={onMenuClick}
                    aria-label="Open navigation menu"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <line x1="4" x2="20" y1="12" y2="12" />
                        <line x1="4" x2="20" y1="6" y2="6" />
                        <line x1="4" x2="20" y1="18" y2="18" />
                    </svg>
                </button>

                {/* Desktop collapse toggle */}
                <button
                    type="button"
                    className={`${styles.collapseButton} ${sidebarCollapsed ? styles.collapsed : ''}`}
                    onClick={toggleSidebar}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M9 3v18" />
                        <path d="m14 9 3 3-3 3" />
                    </svg>
                </button>

                {/* Breadcrumb */}
                <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                    <span>Dashboard</span>
                    {selectedRepo && (
                        <>
                            <span className={styles.breadcrumbSep} aria-hidden="true">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="m9 18 6-6-6-6" />
                                </svg>
                            </span>
                            <span className={styles.breadcrumbCurrent}>{selectedRepo}</span>
                        </>
                    )}
                </nav>
            </div>

            <div className={styles.right}>
                {/* Refresh button */}
                <button
                    type="button"
                    className={`${styles.refreshButton} ${isRefreshing ? styles.spinning : ''}`}
                    onClick={handleRefresh}
                    aria-label="Refresh data"
                    disabled={isRefreshing}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M8 16H3v5" />
                    </svg>
                </button>

                <ThemeToggle />
                <UserMenu />
            </div>
        </header>
    );
}
