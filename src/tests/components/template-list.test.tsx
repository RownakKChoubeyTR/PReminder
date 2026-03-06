import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-templates', () => ({
    useTemplates: vi.fn(),
    useDeleteTemplate: vi.fn(() => ({
        mutate: vi.fn(),
        isPending: false,
        error: null
    }))
}));

import { TemplateList } from '@/components/settings/template-list';
import { useDeleteTemplate, useTemplates } from '@/hooks/use-templates';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
);

describe('TemplateList', () => {
    const onSelect = vi.fn();
    const onCreateNew = vi.fn();

    beforeEach(() => {
        vi.mocked(useTemplates).mockReturnValue({
            data: {
                data: [
                    { id: 't1', name: 'Friendly', type: 'TEAMS_DM', isDefault: true, body: '', subject: '' },
                    { id: 't2', name: 'Formal', type: 'EMAIL', isDefault: false, body: '', subject: '' }
                ]
            },
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as never);
    });

    it('renders template cards', () => {
        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        expect(screen.getByText('Friendly')).toBeInTheDocument();
        expect(screen.getByText('Formal')).toBeInTheDocument();
    });

    it('shows default badge', () => {
        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('shows type labels', () => {
        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        expect(screen.getByText('Teams DM')).toBeInTheDocument();
        expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('renders New Template button', () => {
        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        fireEvent.click(screen.getByText('New Template'));
        expect(onCreateNew).toHaveBeenCalled();
    });

    it('calls onSelect when clicking a template', () => {
        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        fireEvent.click(screen.getByText('Friendly'));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
    });

    it('shows loading skeletons', () => {
        vi.mocked(useTemplates).mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
            refetch: vi.fn()
        } as never);
        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('shows error state with retry', () => {
        const refetch = vi.fn();
        vi.mocked(useTemplates).mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('fail'),
            refetch
        } as never);
        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        expect(screen.getByRole('alert')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Retry'));
        expect(refetch).toHaveBeenCalled();
    });

    it('shows empty state', () => {
        vi.mocked(useTemplates).mockReturnValue({
            data: { data: [] },
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as never);
        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        expect(screen.getByText(/No templates yet/)).toBeInTheDocument();
    });

    it('calls delete with confirmation', () => {
        const mutateFn = vi.fn();
        vi.mocked(useDeleteTemplate).mockReturnValue({
            mutate: mutateFn,
            isPending: false,
            error: null
        } as never);
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(<TemplateList selectedId={null} onSelect={onSelect} onCreateNew={onCreateNew} />, {
            wrapper
        });
        const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
        fireEvent.click(deleteButtons[0]!);
        expect(mutateFn).toHaveBeenCalledWith('t1');
    });
});
