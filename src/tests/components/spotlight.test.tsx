import { Spotlight } from '@/components/ui/spotlight';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('Spotlight', () => {
    it('renders an SVG element', () => {
        const { container } = render(<Spotlight />);
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('applies custom className', () => {
        const { container } = render(<Spotlight className="extra" />);
        const svg = container.querySelector('svg');
        expect(svg?.className.baseVal).toContain('extra');
    });

    it('uses custom fill color', () => {
        const { container } = render(<Spotlight fill="red" />);
        const ellipse = container.querySelector('ellipse');
        expect(ellipse?.getAttribute('fill')).toBe('red');
    });

    it('defaults to white fill', () => {
        const { container } = render(<Spotlight />);
        const ellipse = container.querySelector('ellipse');
        expect(ellipse?.getAttribute('fill')).toBe('white');
    });
});
