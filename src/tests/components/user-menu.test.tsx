import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('next-auth/react', () => ({
    useSession: vi.fn(() => ({
        data: {
            user: {
                name: 'Test User',
                githubLogin: 'testuser',
                email: 'test@corp.com',
                image: 'https://avatar.com/test.png'
            }
        }
    })),
    signOut: vi.fn()
}));

import { UserMenu } from '@/components/layout/user-menu';
import { signOut, useSession } from 'next-auth/react';

describe('UserMenu', () => {
    beforeEach(() => {
        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    name: 'Test User',
                    githubLogin: 'testuser',
                    email: 'test@corp.com',
                    image: 'https://avatar.com/test.png'
                }
            }
        } as never);
    });

    it('renders the user trigger button', () => {
        render(<UserMenu />);
        expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
    });

    it('shows username in trigger', () => {
        render(<UserMenu />);
        expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('renders nothing when no session', () => {
        vi.mocked(useSession).mockReturnValue({ data: null } as never);
        const { container } = render(<UserMenu />);
        expect(container.innerHTML).toBe('');
    });

    it('opens dropdown on click', () => {
        render(<UserMenu />);
        fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('shows user details in menu', () => {
        render(<UserMenu />);
        fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@corp.com')).toBeInTheDocument();
    });

    it('shows GitHub Profile and Sign out items', () => {
        render(<UserMenu />);
        fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
        expect(screen.getByRole('menuitem', { name: /GitHub Profile/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /Sign out/i })).toBeInTheDocument();
    });

    it('calls signOut when clicking Sign out', () => {
        render(<UserMenu />);
        fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: /Sign out/i }));
        expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
    });

    it('closes menu on Escape', () => {
        render(<UserMenu />);
        fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes menu on outside click', () => {
        render(
            <div>
                <UserMenu />
                <button type="button">outside</button>
            </div>
        );
        fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows initials fallback when no image', () => {
        vi.mocked(useSession).mockReturnValue({
            data: {
                user: { name: 'Test User', githubLogin: 'testuser' }
            }
        } as never);
        render(<UserMenu />);
        expect(screen.getByText('TU')).toBeInTheDocument();
    });

    it('renders avatar when image is available', () => {
        const { container } = render(<UserMenu />);
        const img = container.querySelector('img') as HTMLImageElement;
        expect(img).toBeTruthy();
        expect(img.src).toContain('avatar.com');
    });
});
