import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  useSession: vi.fn(() => ({ data: null })),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { useSearchParams } from 'next/navigation';
import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('renders sign-in form', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign in to PReminder')).toBeInTheDocument();
  });

  it('shows continue with GitHub button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /Continue with GitHub/i })).toBeInTheDocument();
  });

  it('shows error message from URL param', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('error=AccessDenied') as never);
    render(<LoginPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Access denied/);
  });

  it('shows default error for unknown error code', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('error=Unknown') as never);
    render(<LoginPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Authentication failed/);
  });
});
