'use client';

import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import styles from './app-shell.module.scss';
import { Header } from './header';
import { Sidebar } from './sidebar';

// ─────────────────────────────────────────────────────────────
// App Shell — Sidebar + Header + Content
// ─────────────────────────────────────────────────────────────

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarCollapsed } = useDashboardStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleOpenMobile = useCallback(() => setMobileMenuOpen(true), []);
  const handleCloseMobile = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <SessionProvider
      refetchOnWindowFocus={false}
      refetchInterval={30 * 60}
      refetchWhenOffline={false}
    >
      <div className={styles.shell}>
        <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={handleCloseMobile} />
        <Header onMenuClick={handleOpenMobile} />
        <main className={`${styles.main} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
