import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-templates', () => ({
    useCreateTemplate: vi.fn(() => ({
        mutate: vi.fn(),
        isPending: false,
        error: null
    })),
    useUpdateTemplate: vi.fn(() => ({
        mutate: vi.fn(),
        isPending: false,
        error: null
    }))
}));

vi.mock('@/lib/templates/engine', () => ({
    extractVariables: vi.fn(() => []),
    validateTemplate: vi.fn(() => ({ valid: true, errors: [] }))
}));

import { TemplateForm } from '@/components/settings/template-form';
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/use-templates';
import { validateTemplate } from '@/lib/templates/engine';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
);

describe('TemplateForm', () => {
    const onSaved = vi.fn();
    const onCancel = vi.fn();

    beforeEach(() => {
        vi.mocked(validateTemplate).mockReturnValue({ valid: true, errors: [], unknownVariables: [] });
    });

    it('renders create form when template is null', () => {
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        expect(screen.getByText('New Template')).toBeInTheDocument();
    });

    it('renders edit form when template is provided', () => {
        const tmpl = {
            id: 't1',
            name: 'Test',
            type: 'TEAMS_DM' as const,
            body: 'Hi',
            subject: '',
            isDefault: false
        };
        render(<TemplateForm template={tmpl as never} onSaved={onSaved} onCancel={onCancel} />, {
            wrapper
        });
        expect(screen.getByText('Edit Template')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Hi')).toBeInTheDocument();
    });

    it('shows name and body fields', () => {
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.getByLabelText(/Body/)).toBeInTheDocument();
    });

    it('shows channel selector', () => {
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        expect(screen.getByLabelText('Channel')).toBeInTheDocument();
    });

    it('shows subject field for EMAIL type', () => {
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'EMAIL' } });
        expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    });

    it('shows validation errors when name is empty', () => {
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        fireEvent.click(screen.getByText('Create Template'));
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Template name is required/)).toBeInTheDocument();
    });

    it('shows validation errors when body is empty', () => {
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
        fireEvent.click(screen.getByText('Create Template'));
        expect(screen.getByText(/Template body is required/)).toBeInTheDocument();
    });

    it('calls createMutation on valid submit', () => {
        const mutate = vi.fn();
        vi.mocked(useCreateTemplate).mockReturnValue({
            mutate,
            isPending: false,
            error: null
        } as never);

        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Template' } });
        fireEvent.change(screen.getByLabelText(/Body/), { target: { value: 'Hello {receiverName}' } });
        fireEvent.click(screen.getByText('Create Template'));

        expect(mutate).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'My Template', body: 'Hello {receiverName}' }),
            expect.any(Object)
        );
    });

    it('calls updateMutation when editing', () => {
        const mutate = vi.fn();
        vi.mocked(useUpdateTemplate).mockReturnValue({
            mutate,
            isPending: false,
            error: null
        } as never);

        const tmpl = {
            id: 't1',
            name: 'Old',
            type: 'TEAMS_DM' as const,
            body: 'Old body',
            subject: '',
            isDefault: false
        };
        render(<TemplateForm template={tmpl as never} onSaved={onSaved} onCancel={onCancel} />, {
            wrapper
        });
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated' } });
        fireEvent.click(screen.getByText('Update Template'));

        expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), expect.any(Object));
    });

    it('calls onCancel when Cancel is clicked', () => {
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        fireEvent.click(screen.getByText('Cancel'));
        expect(onCancel).toHaveBeenCalled();
    });

    it('renders variable pills', () => {
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        expect(screen.getByText('{receiverName}')).toBeInTheDocument();
        expect(screen.getByText('{prTitle}')).toBeInTheDocument();
    });

    it('shows pending state', () => {
        vi.mocked(useCreateTemplate).mockReturnValue({
            mutate: vi.fn(),
            isPending: true,
            error: null
        } as never);
        render(<TemplateForm template={null} onSaved={onSaved} onCancel={onCancel} />, { wrapper });
        expect(screen.getByText('Saving\u2026')).toBeInTheDocument();
    });
});
