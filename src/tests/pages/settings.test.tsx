import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>
}));

import SettingsPage from '@/app/dashboard/settings/page';

describe('SettingsPage', () => {
    it('renders heading', () => {
        render(<SettingsPage />);
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders Integrations link', () => {
        render(<SettingsPage />);
        expect(screen.getByText('Integrations')).toBeInTheDocument();
    });

    it('shows integration description', () => {
        render(<SettingsPage />);
        expect(screen.getByText(/Configure Teams webhooks/)).toBeInTheDocument();
    });
});
