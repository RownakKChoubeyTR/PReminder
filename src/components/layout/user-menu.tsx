'use client';

import { signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './user-menu.module.scss';

// ─────────────────────────────────────────────────────────────
// User Menu — Avatar dropdown with sign out
// ─────────────────────────────────────────────────────────────

export function UserMenu() {
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const user = session?.user;

    // Close menu when clicking outside
    useEffect(() => {
        if (!open) return;

        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close menu on Escape
    useEffect(() => {
        if (!open) return;

        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const handleSignOut = useCallback(() => {
        setOpen(false);
        signOut({ callbackUrl: '/login' });
    }, []);

    if (!user) return null;

    const initials = (user.name ?? user.githubLogin ?? '?')
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className={styles.wrapper} ref={ref}>
            <button
                type="button"
                className={`${styles.trigger} ${open ? styles.open : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-haspopup="true"
                aria-label="User menu"
            >
                {user.image ? (
                    <img src={user.image} alt="" className={styles.avatar} referrerPolicy="no-referrer" />
                ) : (
                    <span className={styles.avatarFallback}>{initials}</span>
                )}
                <span className={styles.userName}>{user.githubLogin || user.name}</span>
                <svg
                    className={styles.chevron}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {open && (
                <div className={styles.menu} role="menu" aria-label="User menu">
                    <div className={styles.menuHeader}>
                        <div className={styles.menuHeaderName}>{user.name ?? user.githubLogin}</div>
                        {user.email && <div className={styles.menuHeaderEmail}>{user.email}</div>}
                    </div>

                    <button
                        type="button"
                        className={styles.menuItem}
                        role="menuitem"
                        onClick={() => {
                            setOpen(false);
                            window.open(`https://github.com/${user.githubLogin}`, '_blank');
                        }}
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
                            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                            <path d="M9 18c-4.51 2-5-2-7-2" />
                        </svg>
                        GitHub Profile
                    </button>

                    <div className={styles.menuDivider} />

                    <button
                        type="button"
                        className={`${styles.menuItem} ${styles.danger}`}
                        role="menuitem"
                        onClick={handleSignOut}
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
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" x2="9" y1="12" y2="12" />
                        </svg>
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
