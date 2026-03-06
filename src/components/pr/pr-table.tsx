'use client';

import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePulls } from '@/hooks/use-pulls';
import type { GitHubPullRequest } from '@/types/github';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './pr-table.module.scss';
import { StatusBadge } from './status-badge';

// ─────────────────────────────────────────────────────────────
// PR Table — Sortable list of open pull requests
// ─────────────────────────────────────────────────────────────

type SortField = 'number' | 'title' | 'author' | 'age' | 'reviewers';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
    { value: 'number', label: '#' },
    { value: 'title', label: 'Title' },
    { value: 'author', label: 'Author' },
    { value: 'age', label: 'Age' },
    { value: 'reviewers', label: 'Reviewers' }
];

function formatAge(createdAt: string): { text: string; days: number } {
    const ms = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (days === 0) return { text: `${hours}h`, days: 0 };
    if (days === 1) return { text: '1 day', days: 1 };
    return { text: `${days} days`, days };
}

function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function PRTable() {
    const { selectedRepo, selectedPR, selectPR, prSearch, setPrSearch, prPage, setPrPage } = useDashboardStore();

    const debouncedSearch = useDebouncedValue(prSearch, 600);
    const isTyping = prSearch.length >= 3 && prSearch !== debouncedSearch;
    const isServerSearch = debouncedSearch.length >= 3;

    const { data, isLoading, error, refetch, isFetching } = usePulls(selectedRepo, prPage, 30, debouncedSearch);

    const [sortField, setSortField] = useState<SortField>('age');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [sortOpen, setSortOpen] = useState(false);
    const sortRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
                setSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSort = useCallback(
        (field: SortField) => {
            if (sortField === field) {
                setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortField(field);
                setSortDir('desc');
            }
            setSortOpen(false);
        },
        [sortField]
    );

    const pulls = useMemo(() => {
        if (!data?.data) return [];

        const sorted = [...data.data].sort((a: GitHubPullRequest, b: GitHubPullRequest) => {
            let cmp = 0;
            switch (sortField) {
                case 'number':
                    cmp = a.number - b.number;
                    break;
                case 'title':
                    cmp = a.title.localeCompare(b.title);
                    break;
                case 'author':
                    cmp = a.user.login.localeCompare(b.user.login);
                    break;
                case 'age':
                    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    break;
                case 'reviewers':
                    cmp = a.requested_reviewers.length - b.requested_reviewers.length;
                    break;
                default:
                    cmp = 0;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return sorted;
    }, [data?.data, sortField, sortDir]);

    // ── No repo selected ──
    if (!selectedRepo) {
        return (
            <div className={styles.empty}>
                <svg
                    className={styles.emptyIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                <h2 className={styles.emptyTitle}>Select a repository</h2>
                <p className={styles.emptyDescription}>
                    Choose a repository from the sidebar to view its open pull requests.
                </p>
            </div>
        );
    }

    // ── Loading ──
    if (isLoading) {
        return (
            <div className={styles.loading} role="status">
                <div className={styles.loadingSpinner} />
                <span className={styles.loadingText}>Loading pull requests\u2026</span>
            </div>
        );
    }

    // ── Error ──
    if (error) {
        return (
            <div className={styles.error} role="alert">
                <p>Failed to load pull requests.</p>
                <button type="button" className={styles.retryButton} onClick={() => refetch()}>
                    Retry
                </button>
            </div>
        );
    }

    // ── Empty ──
    if (pulls.length === 0 && !isServerSearch) {
        return (
            <div className={styles.empty}>
                <svg
                    className={styles.emptyIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                </svg>
                <h2 className={styles.emptyTitle}>No open pull requests</h2>
                <p className={styles.emptyDescription}>
                    This repository has no open PRs. Check back later or select another repo.
                </p>
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchWrapper}>
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
                        placeholder="Search PRs by title\u2026"
                        value={prSearch}
                        onChange={e => setPrSearch(e.target.value)}
                        aria-label="Search pull requests"
                    />
                    {(isTyping || (isFetching && isServerSearch)) && (
                        <div className={styles.searchSpinner} aria-label="Searching\u2026" />
                    )}
                </div>

                <div className={styles.toolbarRight}>
                    {/* Sort dropdown */}
                    <div className={styles.sortDropdown} ref={sortRef}>
                        <button
                            type="button"
                            className={styles.sortButton}
                            onClick={() => setSortOpen(o => !o)}
                            aria-expanded={sortOpen}
                            aria-haspopup="listbox"
                            aria-label="Sort pull requests"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="m3 16 4 4 4-4" />
                                <path d="M7 20V4" />
                                <path d="m21 8-4-4-4 4" />
                                <path d="M17 4v16" />
                            </svg>
                            <span className={styles.sortLabel}>
                                {SORT_OPTIONS.find(o => o.value === sortField)?.label}
                            </span>
                            <span className={styles.sortDirLabel}>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                        </button>
                        {sortOpen && (
                            <ul className={styles.sortMenu} role="listbox" aria-label="Sort options">
                                {SORT_OPTIONS.map(opt => (
                                    <li key={opt.value} role="option" aria-selected={sortField === opt.value}>
                                        <button
                                            type="button"
                                            className={`${styles.sortOption} ${sortField === opt.value ? styles.sortOptionActive : ''}`}
                                            onClick={() => handleSort(opt.value)}
                                        >
                                            <span>{opt.label}</span>
                                            {sortField === opt.value && (
                                                <span className={styles.sortDirIndicator}>
                                                    {sortDir === 'asc' ? '\u2191 Asc' : '\u2193 Desc'}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <span className={styles.count}>
                        {isServerSearch && data?.total != null && data.total >= 0
                            ? `${data.total} result${data.total === 1 ? '' : 's'}`
                            : `${pulls.length} ${pulls.length === 1 ? 'PR' : 'PRs'}${data?.total && data.total > 0 && data.total !== pulls.length ? ` of ${data.total}` : ''}`}
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className={styles.tableScroll}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Title</th>
                            <th>Author</th>
                            <th>Status</th>
                            <th>Labels</th>
                            <th>Reviewers</th>
                            <th>Age</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pulls.map((pr: GitHubPullRequest) => {
                            const age = formatAge(pr.created_at);
                            const isSelected = selectedPR === pr.number;

                            return (
                                <tr
                                    key={pr.id}
                                    className={isSelected ? styles.selected : ''}
                                    onClick={() => selectPR(isSelected ? null : pr.number)}
                                    tabIndex={0}
                                    onKeyDown={(e: React.KeyboardEvent) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            selectPR(isSelected ? null : pr.number);
                                        }
                                    }}
                                >
                                    <td data-label="#">
                                        <span className={styles.prNumber}>#{pr.number}</span>
                                    </td>
                                    <td data-label="Title">
                                        <span className={styles.prTitle}>{pr.title}</span>
                                    </td>
                                    <td data-label="Author">
                                        <div className={styles.prAuthor}>
                                            <img
                                                className={styles.authorAvatar}
                                                src={pr.user.avatar_url}
                                                alt=""
                                                loading="lazy"
                                            />
                                            <span className={styles.authorName}>{pr.user.login}</span>
                                        </div>
                                    </td>
                                    <td data-label="Status">
                                        <StatusBadge status={pr.draft ? 'draft' : 'open'} />
                                    </td>
                                    <td data-label="Labels">
                                        <div className={styles.labelList}>
                                            {pr.labels.slice(0, 3).map(label => (
                                                <span
                                                    key={label.id}
                                                    className={styles.label}
                                                    style={{
                                                        backgroundColor: `#${label.color}`,
                                                        color: getContrastColor(label.color)
                                                    }}
                                                >
                                                    {label.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td data-label="Reviewers">
                                        <div className={styles.reviewerAvatars}>
                                            {pr.requested_reviewers.slice(0, 4).map(reviewer => (
                                                <img
                                                    key={reviewer.id}
                                                    src={reviewer.avatar_url}
                                                    alt={reviewer.login}
                                                    title={reviewer.login}
                                                    loading="lazy"
                                                />
                                            ))}
                                            {pr.requested_reviewers.length > 4 && (
                                                <span className={styles.reviewerCount}>
                                                    +{pr.requested_reviewers.length - 4}
                                                </span>
                                            )}
                                            {pr.requested_reviewers.length === 0 && (
                                                <span className={styles.reviewerCount}>None</span>
                                            )}
                                        </div>
                                    </td>
                                    <td data-label="Age">
                                        <span className={`${styles.ageCell} ${age.days >= 7 ? styles.stale : ''}`}>
                                            {age.text}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* No results after searching */}
            {pulls.length === 0 && isServerSearch && (
                <div className={styles.empty}>
                    <h2 className={styles.emptyTitle}>No matching PRs</h2>
                    <p className={styles.emptyDescription}>Try adjusting your search term or clear the filter.</p>
                </div>
            )}

            {/* Pagination */}
            {data && (data.hasNextPage || prPage > 1) && (
                <div className={styles.pagination}>
                    <button
                        type="button"
                        className={styles.pageButton}
                        disabled={prPage <= 1 || isFetching}
                        onClick={() => setPrPage(prPage - 1)}
                    >
                        Previous
                    </button>
                    <span className={styles.pageInfo}>Page {prPage}</span>
                    <button
                        type="button"
                        className={styles.pageButton}
                        disabled={!data.hasNextPage || isFetching}
                        onClick={() => setPrPage(prPage + 1)}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
