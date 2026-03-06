import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-dashboard-store', () => ({
    useDashboardStore: vi.fn(() => ({ sidebarCollapsed: false }))
}));

vi.mock('next-auth/react', () => ({
    SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@/components/layout/header', () => ({
    Header: ({ onMenuClick }: { onMenuClick: () => void }) => <header data-testid="header" onClick={onMenuClick} />
}));

vi.mock('@/components/layout/sidebar', () => ({
    Sidebar: ({ mobileOpen }: { mobileOpen: boolean }) => <aside data-testid="sidebar" data-mobile={mobileOpen} />
}));

import { AppShell } from '@/components/layout/app-shell';

describe('AppShell', () => {
    it('renders sidebar, header, and children', () => {
        render(
            <AppShell>
                <div data-testid="content">Child</div>
            </AppShell>
        );
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders main content area', () => {
        render(
            <AppShell>
                <span>Hello</span>
            </AppShell>
        );
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });
});
