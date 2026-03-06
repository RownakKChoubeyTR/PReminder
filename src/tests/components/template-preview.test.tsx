import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/templates/engine', () => ({
  renderTemplate: vi.fn((tpl: string) => tpl.replace(/\{(\w+)\}/g, 'SAMPLE')),
  getSampleContext: vi.fn(() => ({})),
}));

import { TemplatePreview } from '@/components/settings/template-preview';

describe('TemplatePreview', () => {
  it('shows empty state when body is empty', () => {
    render(<TemplatePreview body="" type="TEAMS_DM" />);
    expect(screen.getByText(/Start typing to see a live preview/)).toBeInTheDocument();
  });

  it('renders preview body', () => {
    render(<TemplatePreview body="Hello {receiverName}" type="TEAMS_DM" />);
    expect(screen.getByText(/Hello SAMPLE/)).toBeInTheDocument();
  });

  it('shows type label for Teams DM', () => {
    render(<TemplatePreview body="test" type="TEAMS_DM" />);
    expect(screen.getByText(/Teams Direct Message/)).toBeInTheDocument();
  });

  it('shows type label for Teams Channel', () => {
    render(<TemplatePreview body="test" type="TEAMS_CHANNEL" />);
    expect(screen.getByText(/Teams Channel Message/)).toBeInTheDocument();
  });

  it('shows subject line for EMAIL type', () => {
    render(<TemplatePreview body="Body" subject="Subject {prTitle}" type="EMAIL" />);
    expect(screen.getByText(/Subject:/)).toBeInTheDocument();
    expect(screen.getByText(/Subject SAMPLE/)).toBeInTheDocument();
  });

  it('does not show subject for non-email types', () => {
    render(<TemplatePreview body="Body" subject="Subject" type="TEAMS_DM" />);
    expect(screen.queryByText(/Subject:/)).not.toBeInTheDocument();
  });

  it('shows sample data note', () => {
    render(<TemplatePreview body="test" type="TEAMS_DM" />);
    expect(screen.getByText(/Rendered with sample data/)).toBeInTheDocument();
  });
});
