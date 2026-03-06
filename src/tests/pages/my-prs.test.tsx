import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: My PRs page
// ─────────────────────────────────────────────────────────────

vi.mock('@/components/pr/my-prs-table', () => ({
    MyPRsTable: () => <div data-testid="my-prs-table" />
}));

vi.mock('@/components/pr/pr-detail-modal', () => ({
    PRDetailModal: () => <div data-testid="pr-detail-modal" />
}));

import MyPRsPage from '@/app/dashboard/my-prs/page';

describe('MyPRsPage', () => {
    it('renders the page heading', () => {
        render(<MyPRsPage />);
        expect(screen.getByRole('heading', { name: 'My PRs' })).toBeInTheDocument();
    });

    it('renders MyPRsTable', () => {
        render(<MyPRsPage />);
        expect(screen.getByTestId('my-prs-table')).toBeInTheDocument();
    });

    it('renders PRDetailModal', () => {
        render(<MyPRsPage />);
        expect(screen.getByTestId('pr-detail-modal')).toBeInTheDocument();
    });

    it('renders a description paragraph', () => {
        render(<MyPRsPage />);
        expect(screen.getByText(/pull requests across the organisation/i)).toBeInTheDocument();
    });
});
