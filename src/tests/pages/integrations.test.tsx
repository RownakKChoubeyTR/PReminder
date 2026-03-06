import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────

vi.mock('@/hooks/use-integrations', () => ({
    useIntegrations: vi.fn(),
    useCreateIntegration: vi.fn(),
    useDeleteIntegration: vi.fn(),
    useUpdateIntegration: vi.fn(),
    useTestIntegration: vi.fn()
}));

vi.mock('@/hooks/use-email-mappings', () => ({
    useEmailMappings: vi.fn(),
    useCreateEmailMapping: vi.fn(),
    useDeleteEmailMapping: vi.fn()
}));

import IntegrationsPage from '@/app/dashboard/settings/integrations/page';
import { useCreateEmailMapping, useDeleteEmailMapping, useEmailMappings } from '@/hooks/use-email-mappings';
import {
    useCreateIntegration,
    useDeleteIntegration,
    useIntegrations,
    useTestIntegration,
    useUpdateIntegration
} from '@/hooks/use-integrations';

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('IntegrationsPage', () => {
    const createMutateAsync = vi.fn();
    const deleteMutate = vi.fn();
    const updateMutate = vi.fn();
    const testMutateAsync = vi.fn();
    const createMappingAsync = vi.fn();
    const deleteMappingMutate = vi.fn();

    beforeEach(() => {
        vi.mocked(useIntegrations).mockReturnValue({
            data: { data: [] },
            isLoading: false,
            error: null
        } as never);
        vi.mocked(useCreateIntegration).mockReturnValue({
            mutateAsync: createMutateAsync,
            isPending: false,
            error: null
        } as never);
        vi.mocked(useDeleteIntegration).mockReturnValue({
            mutate: deleteMutate
        } as never);
        vi.mocked(useUpdateIntegration).mockReturnValue({
            mutate: updateMutate
        } as never);
        vi.mocked(useTestIntegration).mockReturnValue({
            mutateAsync: testMutateAsync,
            isPending: false
        } as never);
        vi.mocked(useEmailMappings).mockReturnValue({
            data: { data: [] },
            isLoading: false,
            error: null
        } as never);
        vi.mocked(useCreateEmailMapping).mockReturnValue({
            mutateAsync: createMappingAsync,
            isPending: false,
            error: null
        } as never);
        vi.mocked(useDeleteEmailMapping).mockReturnValue({
            mutate: deleteMappingMutate
        } as never);
    });

    it('renders page title', () => {
        render(<IntegrationsPage />, { wrapper });
        expect(screen.getByText('Integrations')).toBeInTheDocument();
    });

    it('shows Webhooks and Email Mappings tabs', () => {
        render(<IntegrationsPage />, { wrapper });
        expect(screen.getByRole('tab', { name: 'Webhooks' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Email Mappings' })).toBeInTheDocument();
    });

    it('shows integrations section by default', () => {
        render(<IntegrationsPage />, { wrapper });
        expect(screen.getByText('Webhook Configurations')).toBeInTheDocument();
    });

    it('switches to email mappings tab', () => {
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('tab', { name: 'Email Mappings' }));
        expect(screen.getByText('Email Mappings', { selector: 'h2' })).toBeInTheDocument();
    });

    // ── Integrations Section ──────────────────────────────────

    it('shows empty state when no integrations', () => {
        render(<IntegrationsPage />, { wrapper });
        expect(screen.getByText('No integrations configured yet.')).toBeInTheDocument();
    });

    it('shows loading state', () => {
        vi.mocked(useIntegrations).mockReturnValue({
            data: null,
            isLoading: true,
            error: null
        } as never);
        render(<IntegrationsPage />, { wrapper });
        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('shows error alert', () => {
        vi.mocked(useIntegrations).mockReturnValue({
            data: null,
            isLoading: false,
            error: new Error('Network error')
        } as never);
        render(<IntegrationsPage />, { wrapper });
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });

    it('shows integration configs in table', () => {
        vi.mocked(useIntegrations).mockReturnValue({
            data: {
                data: [
                    {
                        id: 'i1',
                        type: 'POWER_AUTOMATE_DM',
                        label: 'My Flow',
                        isActive: true,
                        updatedAt: '2024-01-15T10:00:00.000Z'
                    },
                    {
                        id: 'i2',
                        type: 'TEAMS_WEBHOOK',
                        label: 'Channel Hook',
                        isActive: false,
                        updatedAt: '2024-01-15T10:00:00.000Z'
                    }
                ]
            },
            isLoading: false,
            error: null
        } as never);
        render(<IntegrationsPage />, { wrapper });
        expect(screen.getByText('My Flow')).toBeInTheDocument();
        expect(screen.getByText('Channel Hook')).toBeInTheDocument();
        // 'Power Automate DM' appears in <select> option AND in the table row
        expect(screen.getAllByText('Power Automate DM').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Teams Channel Webhook')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('adds an integration via form', async () => {
        createMutateAsync.mockResolvedValue({});
        render(<IntegrationsPage />, { wrapper });

        fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'New Flow' } });
        fireEvent.change(screen.getByLabelText('Webhook URL'), {
            target: { value: 'https://prod.logic.azure.com/test' }
        });
        fireEvent.submit(screen.getByText('Add').closest('form')!);

        await waitFor(() => {
            expect(createMutateAsync).toHaveBeenCalledWith({
                type: 'POWER_AUTOMATE_DM',
                label: 'New Flow',
                value: 'https://prod.logic.azure.com/test'
            });
        });
    });

    it('deletes an integration', () => {
        vi.mocked(useIntegrations).mockReturnValue({
            data: {
                data: [
                    {
                        id: 'i1',
                        type: 'POWER_AUTOMATE_DM',
                        label: 'My Flow',
                        isActive: true,
                        updatedAt: '2024-01-15T10:00:00.000Z'
                    }
                ]
            },
            isLoading: false,
            error: null
        } as never);
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Delete My Flow' }));
        expect(deleteMutate).toHaveBeenCalledWith('i1');
    });

    it('toggles integration active status', () => {
        vi.mocked(useIntegrations).mockReturnValue({
            data: {
                data: [
                    {
                        id: 'i1',
                        type: 'POWER_AUTOMATE_DM',
                        label: 'My Flow',
                        isActive: true,
                        updatedAt: '2024-01-15T10:00:00.000Z'
                    }
                ]
            },
            isLoading: false,
            error: null
        } as never);
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
        expect(updateMutate).toHaveBeenCalledWith({ id: 'i1', input: { isActive: false } });
    });

    it('tests an integration', async () => {
        testMutateAsync.mockResolvedValue({ success: true });
        vi.mocked(useIntegrations).mockReturnValue({
            data: {
                data: [
                    {
                        id: 'i1',
                        type: 'POWER_AUTOMATE_DM',
                        label: 'My Flow',
                        isActive: true,
                        updatedAt: '2024-01-15T10:00:00.000Z'
                    }
                ]
            },
            isLoading: false,
            error: null
        } as never);
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
        await waitFor(() => {
            expect(testMutateAsync).toHaveBeenCalledWith('i1');
        });
    });

    // ── Email Mappings Section ────────────────────────────────

    it('shows empty email mappings state', () => {
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('tab', { name: 'Email Mappings' }));
        expect(screen.getByText(/No email mappings yet/)).toBeInTheDocument();
    });

    it('shows email mappings in table', () => {
        vi.mocked(useEmailMappings).mockReturnValue({
            data: {
                data: [
                    {
                        id: 'm1',
                        githubUsername: 'alice',
                        email: 'alice@corp.com',
                        displayName: 'Alice',
                        source: 'MANUAL'
                    }
                ]
            },
            isLoading: false,
            error: null
        } as never);
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('tab', { name: 'Email Mappings' }));
        expect(screen.getByText('@alice')).toBeInTheDocument();
        expect(screen.getByText('alice@corp.com')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('MANUAL')).toBeInTheDocument();
    });

    it('adds an email mapping', async () => {
        createMappingAsync.mockResolvedValue({});
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('tab', { name: 'Email Mappings' }));

        fireEvent.change(screen.getByLabelText('GitHub Username'), { target: { value: 'bob' } });
        fireEvent.change(screen.getByLabelText('Corporate Email'), {
            target: { value: 'bob@corp.com' }
        });
        fireEvent.submit(screen.getByText('Add Mapping').closest('form')!);

        await waitFor(() => {
            expect(createMappingAsync).toHaveBeenCalledWith({
                githubUsername: 'bob',
                email: 'bob@corp.com',
                displayName: undefined
            });
        });
    });

    it('deletes an email mapping', () => {
        vi.mocked(useEmailMappings).mockReturnValue({
            data: {
                data: [
                    {
                        id: 'm1',
                        githubUsername: 'alice',
                        email: 'alice@corp.com',
                        displayName: null,
                        source: 'MANUAL'
                    }
                ]
            },
            isLoading: false,
            error: null
        } as never);
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('tab', { name: 'Email Mappings' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete mapping for alice' }));
        expect(deleteMappingMutate).toHaveBeenCalledWith('m1');
    });

    it('shows dash for missing display name', () => {
        vi.mocked(useEmailMappings).mockReturnValue({
            data: {
                data: [
                    {
                        id: 'm1',
                        githubUsername: 'alice',
                        email: 'alice@corp.com',
                        displayName: null,
                        source: 'GITHUB_PROFILE'
                    }
                ]
            },
            isLoading: false,
            error: null
        } as never);
        render(<IntegrationsPage />, { wrapper });
        fireEvent.click(screen.getByRole('tab', { name: 'Email Mappings' }));
        expect(screen.getByText('—')).toBeInTheDocument();
    });
});
