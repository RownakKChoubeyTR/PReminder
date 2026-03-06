import { StatusBadge } from '@/components/pr/status-badge';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────
// StatusBadge Component Tests
// ─────────────────────────────────────────────────────────────

describe('StatusBadge', () => {
    it('should render Approved badge', () => {
        render(<StatusBadge status="approved" />);
        expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('should render Changes Requested badge', () => {
        render(<StatusBadge status="changes_requested" />);
        expect(screen.getByText('Changes Requested')).toBeInTheDocument();
    });

    it('should render Commented badge', () => {
        render(<StatusBadge status="commented" />);
        expect(screen.getByText('Commented')).toBeInTheDocument();
    });

    it('should render Pending badge', () => {
        render(<StatusBadge status="pending" />);
        expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render Awaiting badge', () => {
        render(<StatusBadge status="awaiting" />);
        expect(screen.getByText('Awaiting')).toBeInTheDocument();
    });

    it('should render Draft badge', () => {
        render(<StatusBadge status="draft" />);
        expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('should render Open badge', () => {
        render(<StatusBadge status="open" />);
        expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('should include a decorative dot', () => {
        const { container } = render(<StatusBadge status="approved" />);
        const dot = container.querySelector('[aria-hidden="true"]');
        expect(dot).toBeInTheDocument();
    });

    it('should apply custom className', () => {
        const { container } = render(<StatusBadge status="approved" className="custom-class" />);
        const badge = container.firstElementChild;
        expect(badge?.className).toContain('custom-class');
    });

    it('should render Closed badge', () => {
        render(<StatusBadge status="closed" />);
        expect(screen.getByText('Closed')).toBeInTheDocument();
    });
});
