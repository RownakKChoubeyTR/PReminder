import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('Card components', () => {
    it('renders Card with children', () => {
        render(<Card data-testid="card">Card content</Card>);
        expect(screen.getByTestId('card')).toHaveTextContent('Card content');
    });

    it('Card applies custom className', () => {
        render(<Card className="custom" data-testid="card" />);
        expect(screen.getByTestId('card').className).toContain('custom');
    });

    it('CardHeader renders', () => {
        render(<CardHeader data-testid="hdr">Header</CardHeader>);
        expect(screen.getByTestId('hdr')).toHaveTextContent('Header');
    });

    it('CardTitle renders as h3', () => {
        render(<CardTitle>Title</CardTitle>);
        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title');
    });

    it('CardDescription renders as p', () => {
        render(<CardDescription>Desc</CardDescription>);
        expect(screen.getByText('Desc').tagName).toBe('P');
    });

    it('CardContent renders', () => {
        render(<CardContent data-testid="cnt">Content</CardContent>);
        expect(screen.getByTestId('cnt')).toHaveTextContent('Content');
    });

    it('CardFooter renders', () => {
        render(<CardFooter data-testid="ftr">Footer</CardFooter>);
        expect(screen.getByTestId('ftr')).toHaveTextContent('Footer');
    });

    it('Card forwards ref', () => {
        const ref = { current: null as HTMLDivElement | null };
        render(<Card ref={ref} />);
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
});
