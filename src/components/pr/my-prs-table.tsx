'use client';

import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { useMyPRs } from '@/hooks/use-my-prs';
import { useReviewers } from '@/hooks/use-reviewers';
import type { GitHubMyPR, ReviewerInfo } from '@/types/github';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './pr-table.module.scss';
import { StatusBadge } from './status-badge';

// ─── ReviewerCell ─────────────────────────────────────────────

function ReviewerCell({ repo, prNumber }: { repo: string; prNumber: number }) {
  const { data, isLoading } = useReviewers(repo, prNumber);

  if (isLoading) {
    return <span className={styles.reviewerCount}>\u2026</span>;
  }

  const reviewers = data?.data ?? [];

  if (reviewers.length === 0) {
    return <span className={styles.reviewerCount}>None</span>;
  }

  return (
    <div className={styles.reviewerAvatars}>
      {reviewers.slice(0, 4).map((r: ReviewerInfo) => (
        <img
          key={r.user.id}
          src={r.user.avatar_url}
          alt={r.user.login}
          title={`${r.user.login} \u2014 ${r.status}`}
          loading="lazy"
        />
      ))}
      {reviewers.length > 4 && (
        <span className={styles.reviewerCount}>+{reviewers.length - 4}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MyPRsTable — Signed-in user's authored PRs across the org
// ─────────────────────────────────────────────────────────────

type SortField = 'number' | 'title' | 'repo' | 'status' | 'age' | 'reviewers';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'number', label: '#' },
  { value: 'title', label: 'Title' },
  { value: 'repo', label: 'Repository' },
  { value: 'status', label: 'Status' },
  { value: 'age', label: 'Age' },
  { value: 'reviewers', label: 'Reviewers' },
];

const STATUS_ORDER: Record<string, number> = { draft: 0, open: 1, closed: 2 };

function prStatusKey(pr: GitHubMyPR): 'draft' | 'open' | 'closed' {
  if (pr.draft) return 'draft';
  return pr.state === 'closed' ? 'closed' : 'open';
}

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

export function MyPRsTable() {
  const { myPrSelected, setMyPrSelected } = useDashboardStore();
  const [page, setPage] = useState(1);
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

  const { data, isLoading, error, refetch, isFetching } = useMyPRs(page, 30);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
      setSortOpen(false);
    },
    [sortField],
  );

  const pulls = useMemo(() => {
    if (!data?.data) return [];
    return [...data.data].sort((a: GitHubMyPR, b: GitHubMyPR) => {
      let cmp = 0;
      switch (sortField) {
        case 'number':
          cmp = a.number - b.number;
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'repo':
          cmp = a.repo_name.localeCompare(b.repo_name);
          break;
        case 'status':
          cmp = (STATUS_ORDER[prStatusKey(a)] ?? 9) - (STATUS_ORDER[prStatusKey(b)] ?? 9);
          break;
        case 'reviewers':
          cmp = a.requested_reviewers.length - b.requested_reviewers.length;
          break;
        case 'age':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data?.data, sortField, sortDir]);

  if (isLoading) {
    return (
      <div className={styles.loading} role="status">
        <div className={styles.loadingSpinner} />
        <span className={styles.loadingText}>Loading your pull requests\u2026</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error} role="alert">
        <p>{(error as Error).message}</p>
        <button type="button" className={styles.retryButton} onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (pulls.length === 0) {
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
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <path d="M13 6h3a2 2 0 0 1 2 2v7" />
          <path d="M6 9v12" />
        </svg>
        <h2 className={styles.emptyTitle}>No pull requests found</h2>
        <p className={styles.emptyDescription}>
          You don&apos;t have any authored PRs in this organisation yet.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {pulls.length} {pulls.length === 1 ? 'PR' : 'PRs'}
          {data?.total && data.total > pulls.length ? ` of ${data.total}` : ''}
        </span>

        <div className={styles.toolbarRight}>
          {/* Sort dropdown */}
          <div className={styles.sortDropdown} ref={sortRef}>
            <button
              type="button"
              className={styles.sortButton}
              onClick={() => setSortOpen((o) => !o)}
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
                {SORT_OPTIONS.find((o) => o.value === sortField)?.label}
              </span>
              <span className={styles.sortDirLabel}>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
            </button>
            {sortOpen && (
              <ul className={styles.sortMenu} role="listbox" aria-label="Sort options">
                {SORT_OPTIONS.map((opt) => (
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

          {isFetching && !isLoading && <span className={styles.count}>Refreshing\u2026</span>}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableScroll}>
        <table className={styles.table} aria-label="My pull requests">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Repository</th>
              <th>Status</th>
              <th>Labels</th>
              <th>Reviewers</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {pulls.map((pr: GitHubMyPR) => {
              const age = formatAge(pr.created_at);
              const isSelected = myPrSelected?.id === pr.id;
              return (
                <tr
                  key={pr.id}
                  className={isSelected ? styles.selected : ''}
                  onClick={() => setMyPrSelected(isSelected ? null : pr)}
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMyPrSelected(isSelected ? null : pr);
                    }
                  }}
                >
                  <td data-label="#">
                    <span className={styles.prNumber}>#{pr.number}</span>
                  </td>
                  <td data-label="Title">
                    <span className={styles.prTitle}>{pr.title}</span>
                  </td>
                  <td data-label="Repository">
                    <span className={styles.prNumber}>{pr.repo_name}</span>
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={prStatusKey(pr)} />
                  </td>
                  <td data-label="Labels">
                    <div className={styles.labelList}>
                      {pr.labels.slice(0, 3).map((label) => (
                        <span
                          key={label.id}
                          className={styles.label}
                          style={{
                            backgroundColor: `#${label.color}`,
                            color: getContrastColor(label.color),
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Reviewers">
                    <ReviewerCell repo={pr.repo_name} prNumber={pr.number} />
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

      {/* Pagination */}
      {data && (data.hasNextPage || page > 1) && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageButton}
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>Page {page}</span>
          <button
            type="button"
            className={styles.pageButton}
            disabled={!data.hasNextPage || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
