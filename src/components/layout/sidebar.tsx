'use client';

import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRepos } from '@/hooks/use-repos';
import type { GitHubRepo } from '@/types/github';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './sidebar.module.scss';

// ─────────────────────────────────────────────────────────────
// Sidebar — Navigation + Repository Browser
// ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
        )
    },
    {
        label: 'Templates',
        href: '/dashboard/templates',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
                <line x1="10" x2="8" y1="9" y2="9" />
            </svg>
        )
    },
    {
        label: 'Reminders',
        href: '/dashboard/reminders',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="m22 2-7 20-4-9-9-4z" />
                <path d="M22 2 11 13" />
            </svg>
        )
    },
    {
        label: 'My PRs',
        href: '/dashboard/my-prs',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                <path d="M6 9v12" />
            </svg>
        )
    },
    {
        label: 'Settings',
        href: '/dashboard/settings',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        )
    }
] as const;

interface SidebarProps {
    mobileOpen: boolean;
    onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { selectedRepo, selectRepo, sidebarCollapsed, repoSearch, setRepoSearch, repoPage, setRepoPage } =
        useDashboardStore();

    // Debounce search input — only triggers API call after 600ms of no typing.
    // Minimum 3 chars to activate server search (avoids noisy short queries).
    const debouncedSearch = useDebouncedValue(repoSearch, 600);
    const activeSearch = debouncedSearch.trim().length >= 3 ? debouncedSearch.trim() : '';

    const { data: reposData, isLoading, error, refetch, isFetching } = useRepos(repoPage, 30, activeSearch);

    // When searching, results come pre-ranked from GitHub Search API.
    // When browsing, sort by open issues count for relevance.
    const repos = reposData?.data
        ? activeSearch
            ? reposData.data
            : [...reposData.data].sort((a: GitHubRepo, b: GitHubRepo) => b.open_issues_count - a.open_issues_count)
        : [];

    // Show a typing indicator when user is typing but debounce hasn't fired yet
    const isTyping = repoSearch.trim().length >= 3 && repoSearch.trim() !== debouncedSearch.trim();

    const classNames = [styles.sidebar, sidebarCollapsed && styles.collapsed, mobileOpen && styles.mobileOpen]
        .filter(Boolean)
        .join(' ');

    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && <div className={styles.overlay} onClick={onCloseMobile} aria-hidden="true" />}

            <aside className={classNames} aria-label="Main navigation">
                {/* Logo */}
                <div className={styles.logo}>
                    <Image src="/logo.png" alt="PReminder" width={36} height={36} priority />
                    <span>PReminder</span>
                </div>

                {/* Search */}
                {!sidebarCollapsed && (
                    <div className={styles.searchWrapper}>
                        <div className={styles.searchInputWrapper}>
                            <svg
                                className={styles.searchIcon}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                                type="search"
                                className={styles.searchInput}
                                placeholder="Search repos\u2026"
                                value={repoSearch}
                                onChange={e => setRepoSearch(e.target.value)}
                                aria-label="Search repositories"
                            />
                            {(isTyping || (activeSearch && isFetching)) && (
                                <span className={styles.searchSpinner} aria-hidden="true" />
                            )}
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className={styles.navSection}>
                    <div className={styles.sectionLabel}>Navigation</div>
                    <ul className={styles.navList}>
                        {NAV_ITEMS.map(item => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                        onClick={onCloseMobile}
                                        aria-current={isActive ? 'page' : undefined}
                                    >
                                        {item.icon}
                                        <span className={styles.navLabel}>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Repositories */}
                    {!sidebarCollapsed && (
                        <>
                            <div className={styles.sectionLabel} style={{ marginTop: '1.5rem' }}>
                                {activeSearch ? `Results for "${activeSearch}"` : 'Repositories'}
                                {reposData?.total != null && reposData.total > 0 && (
                                    <span className={styles.totalCount}> ({reposData.total})</span>
                                )}
                            </div>

                            {isLoading && (
                                <div role="status" aria-label="Loading repositories">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className={styles.loadingItem} />
                                    ))}
                                </div>
                            )}

                            {error && (
                                <div className={styles.errorState} role="alert">
                                    <p>Failed to load repos</p>
                                    <button type="button" className={styles.retryButton} onClick={() => refetch()}>
                                        Retry
                                    </button>
                                </div>
                            )}

                            {!isLoading && !error && repos.length === 0 && (
                                <div className={styles.emptyState}>
                                    {activeSearch
                                        ? `No repos matching "${activeSearch}"`
                                        : repoSearch.trim().length === 1
                                          ? 'Type at least 2 characters to search'
                                          : 'No repositories found'}
                                </div>
                            )}

                            {!isLoading && !error && repos.length > 0 && (
                                <ul className={styles.repoList} role="listbox" aria-label="Repository list">
                                    {repos.map((repo: GitHubRepo) => (
                                        <li key={repo.id}>
                                            <button
                                                type="button"
                                                className={`${styles.repoItem} ${selectedRepo === repo.name ? styles.active : ''}`}
                                                onClick={() => {
                                                    selectRepo(repo.name);
                                                    if (pathname !== '/dashboard') {
                                                        router.push('/dashboard');
                                                    }
                                                    onCloseMobile();
                                                }}
                                                role="option"
                                                aria-selected={selectedRepo === repo.name}
                                            >
                                                <svg
                                                    className={styles.repoIcon}
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                                                    <path d="M9 18c-4.51 2-5-2-7-2" />
                                                </svg>
                                                <span className={styles.repoName}>{repo.name}</span>
                                                {repo.open_issues_count > 0 && (
                                                    <span className={styles.repoPrCount}>{repo.open_issues_count}</span>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Pagination controls */}
                            {!isLoading && !error && reposData && (
                                <div className={styles.pagination}>
                                    <button
                                        type="button"
                                        className={styles.pageButton}
                                        disabled={repoPage <= 1 || isFetching}
                                        onClick={() => setRepoPage(repoPage - 1)}
                                        aria-label="Previous page"
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
                                            <path d="m15 18-6-6 6-6" />
                                        </svg>
                                    </button>
                                    <span className={styles.pageInfo}>Page {repoPage}</span>
                                    <button
                                        type="button"
                                        className={styles.pageButton}
                                        disabled={!reposData.hasNextPage || isFetching}
                                        onClick={() => setRepoPage(repoPage + 1)}
                                        aria-label="Next page"
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
                                            <path d="m9 18 6-6-6-6" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </nav>
            </aside>
        </>
    );
}
