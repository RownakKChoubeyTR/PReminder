import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@splinetool/react-spline', () => ({
    __esModule: true,
    default: ({ scene, className }: { scene: string; className?: string }) => (
        <div data-testid="spline-canvas" data-scene={scene} className={className} />
    )
}));

import { SplineScene } from '@/components/ui/spline-scene';

describe('SplineScene', () => {
    it('renders fallback then the scene', async () => {
        render(<SplineScene scene="https://example.com/scene.splinecode" />);
        // lazy-loaded: the mock resolves synchronously so it shows the mocked spline
        const spline = await screen.findByTestId('spline-canvas');
        expect(spline).toHaveAttribute('data-scene', 'https://example.com/scene.splinecode');
    });

    it('passes className to Spline', async () => {
        render(<SplineScene scene="https://test.com/s" className="my-class" />);
        const spline = await screen.findByTestId('spline-canvas');
        expect(spline.className).toContain('my-class');
    });
});
