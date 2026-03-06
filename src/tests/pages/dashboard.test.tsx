import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/pr/pr-table', () => ({
    PRTable: () => <div data-testid="pr-table" />
}));

vi.mock('@/components/pr/pr-detail-modal', () => ({
    PRDetailModal: () => <div data-testid="pr-detail-modal" />
}));

vi.mock('@/hooks/use-dashboard-store', () => ({
    useDashboardStore: vi.fn(() => ({ selectedRepo: null }))
}));

import DashboardPage from '@/app/dashboard/page';
import { useDashboardStore } from '@/hooks/use-dashboard-store';

describe('DashboardPage', () => {
    it('renders PR table and detail modal', () => {
        render(<DashboardPage />);
        expect(screen.getByTestId('pr-table')).toBeInTheDocument();
        expect(screen.getByTestId('pr-detail-modal')).toBeInTheDocument();
    });

    it('shows default heading when no repo selected', () => {
        render(<DashboardPage />);
        expect(screen.getByText('Open Pull Requests')).toBeInTheDocument();
    });

    it('shows repo name when selected', () => {
        vi.mocked(useDashboardStore).mockReturnValue({ selectedRepo: 'my-repo' } as never);
        render(<DashboardPage />);
        expect(screen.getByText('my-repo')).toBeInTheDocument();
    });
});
