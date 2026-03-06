import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/settings/template-form', () => ({
  TemplateForm: ({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) => (
    <div data-testid="template-form">
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="button" onClick={onSaved}>Save</button>
    </div>
  ),
}));

vi.mock('@/components/settings/template-list', () => ({
  TemplateList: ({ onSelect, onCreateNew }: { onSelect: (t: unknown) => void; onCreateNew: () => void }) => (
    <div data-testid="template-list">
      <button type="button" onClick={onCreateNew}>New</button>
      <button type="button" onClick={() => onSelect({ id: 't1', name: 'T', type: 'TEAMS_DM', body: 'x', subject: '', isDefault: false })}>Select</button>
    </div>
  ),
}));

vi.mock('@/components/settings/template-preview', () => ({
  TemplatePreview: ({ body }: { body: string }) => (
    <div data-testid="template-preview">{body}</div>
  ),
}));

import TemplatesPage from '@/app/dashboard/templates/page';

describe('TemplatesPage', () => {
  it('renders heading', () => {
    render(<TemplatesPage />);
    expect(screen.getByText('Message Templates')).toBeInTheDocument();
  });

  it('shows TemplateList', () => {
    render(<TemplatesPage />);
    expect(screen.getByTestId('template-list')).toBeInTheDocument();
  });

  it('shows empty state initially', () => {
    render(<TemplatesPage />);
    expect(screen.getByText(/Select or create a template/)).toBeInTheDocument();
  });

  it('shows form when Create New clicked', () => {
    render(<TemplatesPage />);
    fireEvent.click(screen.getByText('New'));
    expect(screen.getByTestId('template-form')).toBeInTheDocument();
    expect(screen.getByTestId('template-preview')).toBeInTheDocument();
  });

  it('shows form and preview when selecting a template', () => {
    render(<TemplatesPage />);
    fireEvent.click(screen.getByText('Select'));
    expect(screen.getByTestId('template-form')).toBeInTheDocument();
    expect(screen.getByTestId('template-preview')).toBeInTheDocument();
  });

  it('hides form after Cancel', () => {
    render(<TemplatesPage />);
    fireEvent.click(screen.getByText('New'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('template-form')).not.toBeInTheDocument();
  });

  it('hides form after Save', () => {
    render(<TemplatesPage />);
    fireEvent.click(screen.getByText('New'));
    fireEvent.click(screen.getByText('Save'));
    expect(screen.queryByTestId('template-form')).not.toBeInTheDocument();
  });
});
