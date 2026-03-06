'use client';

import { BulkActionBar } from '@/components/reminders/bulk-action-bar';
import { ReminderFlowModal } from '@/components/reminders/reminder-flow-modal';
import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePulls } from '@/hooks/use-pulls';
import { useReminderStore } from '@/hooks/use-reminder-store';
import type { GitHubPullRequest } from '@/types/github';
import { useCallback, useEffect, useRef } from 'react';
import styles from './pr-detail-modal.module.scss';
import { ReviewerList } from './reviewer-list';
import { StatusBadge } from './status-badge';

// ─────────────────────────────────────────────────────────────
// PR Detail Modal — Overlay with comprehensive PR information
// ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(dateStr));
}

function calculateAge(createdAt: string): string {
    const ms = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;

    if (days === 0) return `${hours}h`;
    if (days === 1) return '1 day';
    return `${days} days`;
}

function getContrastColor(hex: string): string {
    // Strip leading '#' and handle 3-char shorthand
    const clean = hex.replace(/^#/, '');
    const full =
        clean.length === 3
            ? clean
                  .split('')
                  .map(c => c + c)
                  .join('')
            : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#000000';

    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function PRDetailModal() {
    const { selectedRepo, selectedPR, selectPR, prSearch, prPage, myPrSelected, setMyPrSelected } = useDashboardStore();
    const { setPrContext, clearReviewers } = useReminderStore();
    const debouncedSearch = useDebouncedValue(prSearch, 600);
    const { data } = usePulls(selectedRepo, prPage, 30, debouncedSearch);
    const modalRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // My PRs path: PR object stored directly in the store (no re-fetch needed)
    const isMyPr = myPrSelected != null;
    const repo: string | null = isMyPr ? myPrSelected.repo_name : selectedRepo;

    const isOpen = isMyPr || !!(selectedRepo && selectedPR && data?.data);

    const pr: GitHubPullRequest | null = isMyPr
        ? myPrSelected
        : isOpen
          ? (data!.data.find((p: GitHubPullRequest) => p.number === selectedPR) ?? null)
          : null;

    const handleClose = useCallback(() => {
        if (isMyPr) {
            setMyPrSelected(null);
        } else {
            selectPR(null);
        }
        clearReviewers();
    }, [isMyPr, setMyPrSelected, selectPR, clearReviewers]);

    // Set PR context for reminder flow when PR is selected
    useEffect(() => {
        if (pr && repo) {
            const ms = Date.now() - new Date(pr.created_at).getTime();
            const days = Math.floor(ms / (1000 * 60 * 60 * 24));
            setPrContext({
                number: pr.number,
                title: pr.title,
                url: pr.html_url,
                repo: repo,
                branch: pr.head.ref,
                targetBranch: pr.base.ref,
                age: days,
                labels: pr.labels.map(l => l.name),
                description: pr.body ?? pr.title
            });
        }
    }, [pr, repo, setPrContext]);

    // Trap focus & close on Escape
    useEffect(() => {
        if (!isOpen || !pr) return;

        previousFocusRef.current = document.activeElement as HTMLElement;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
                return;
            }

            // Focus trap
            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                    'button, a[href], input, [tabindex]:not([tabindex="-1"])'
                );
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };

        // Lock body scroll
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        // Auto-focus close button
        requestAnimationFrame(() => {
            modalRef.current?.querySelector<HTMLElement>('button')?.focus();
        });

        return () => {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleKeyDown);
            previousFocusRef.current?.focus();
        };
    }, [isOpen, pr, handleClose]);

    if (!isOpen || !pr) return null;

    return (
        <>
            {/* Backdrop */}
            <div className={styles.backdrop} onClick={handleClose} aria-hidden="true" />

            {/* Modal */}
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pr-modal-title"
                onClick={e => {
                    if (e.target === e.currentTarget) handleClose();
                }}
            >
                <div className={styles.modalContent} ref={modalRef}>
                    {/* ── Header ── */}
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <h2 id="pr-modal-title" className={styles.title}>
                                {pr.title}
                            </h2>
                            <div className={styles.meta}>
                                <span className={styles.metaItem}>
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <circle cx="18" cy="18" r="3" />
                                        <circle cx="6" cy="6" r="3" />
                                        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                                        <path d="M6 9v12" />
                                    </svg>
                                    #{pr.number}
                                </span>
                                <span className={styles.metaDivider} />
                                <span className={styles.metaItem}>by {pr.user.login}</span>
                                <span className={styles.metaDivider} />
                                <span className={styles.metaItem}>
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    {calculateAge(pr.created_at)} old
                                </span>
                                <span className={styles.metaDivider} />
                                <StatusBadge status={pr.draft ? 'draft' : 'open'} />
                            </div>
                        </div>

                        <button
                            type="button"
                            className={styles.closeButton}
                            onClick={handleClose}
                            aria-label="Close modal"
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
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* ── Body ── */}
                    <div className={styles.body}>
                        {/* Author */}
                        <div>
                            <h3 className={styles.sectionTitle}>Author</h3>
                            <div className={styles.author}>
                                <img className={styles.authorAvatar} src={pr.user.avatar_url} alt="" loading="lazy" />
                                <div className={styles.authorInfo}>
                                    <div className={styles.authorName}>{pr.user.login}</div>
                                    <div className={styles.authorRole}>
                                        {pr.user.type === 'Bot' ? 'Bot' : 'Contributor'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Two-column layout */}
                        <div className={styles.columns}>
                            {/* Left column — Details */}
                            <div className={styles.column}>
                                <div>
                                    <h3 className={styles.sectionTitle}>Details</h3>

                                    {/* Branch */}
                                    <div className={styles.branchInfo}>
                                        <span className={styles.branchName}>{pr.head.ref}</span>
                                        <span className={styles.branchArrow}>
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="M5 12h14" />
                                                <path d="m12 5 7 7-7 7" />
                                            </svg>
                                        </span>
                                        <span className={styles.branchName}>{pr.base.ref}</span>
                                    </div>
                                </div>

                                <div className={styles.infoGrid}>
                                    {repo && (
                                        <div className={styles.infoRow}>
                                            <span className={styles.infoLabel}>Repository</span>
                                            <span className={styles.infoValue}>{repo}</span>
                                        </div>
                                    )}
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Created</span>
                                        <span className={styles.infoValue}>{formatDate(pr.created_at)}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Updated</span>
                                        <span className={styles.infoValue}>{formatDate(pr.updated_at)}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Reviewers requested</span>
                                        <span className={styles.infoValue}>{pr.requested_reviewers.length}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Teams requested</span>
                                        <span className={styles.infoValue}>{pr.requested_teams.length}</span>
                                    </div>
                                </div>

                                {/* Labels */}
                                {pr.labels.length > 0 && (
                                    <div>
                                        <h3 className={styles.sectionTitle}>Labels</h3>
                                        <div className={styles.labelList}>
                                            {pr.labels.map(label => (
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
                                    </div>
                                )}

                                {/* Requested Reviewers (pending) */}
                                {pr.requested_reviewers.length > 0 && (
                                    <div>
                                        <h3 className={styles.sectionTitle}>Awaiting Review</h3>
                                        <div className={styles.requestedReviewers}>
                                            {pr.requested_reviewers.map(reviewer => (
                                                <div key={reviewer.id} className={styles.requestedReviewer}>
                                                    <img src={reviewer.avatar_url} alt="" loading="lazy" />
                                                    <span>{reviewer.login}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Teams */}
                                {pr.requested_teams.length > 0 && (
                                    <div>
                                        <h3 className={styles.sectionTitle}>Requested Teams</h3>
                                        <div className={styles.teamList}>
                                            {pr.requested_teams.map(team => (
                                                <div key={team.id} className={styles.teamItem}>
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        aria-hidden="true"
                                                    >
                                                        <path d="M18 21a8 8 0 0 0-16 0" />
                                                        <circle cx="10" cy="8" r="5" />
                                                        <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
                                                    </svg>
                                                    {team.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right column — Reviewer Status */}
                            <div className={styles.column}>
                                <h3 className={styles.sectionTitle}>Reviewer Status</h3>
                                <ReviewerList repo={repo ?? ''} prNumber={pr.number} selectable />
                            </div>
                        </div>
                    </div>

                    {/* ── Bulk Action Bar ── */}
                    <BulkActionBar />

                    {/* ── Footer ── */}
                    <div className={styles.footer}>
                        <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className={styles.githubLink}>
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" x2="21" y1="14" y2="3" />
                            </svg>
                            View on GitHub
                        </a>
                    </div>
                </div>
            </div>

            {/* Reminder Flow Modal */}
            <ReminderFlowModal />
        </>
    );
}
