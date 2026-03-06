import { AppShell } from '@/components/layout/app-shell';
import type { Metadata } from 'next';

// ─────────────────────────────────────────────────────────────
// Dashboard Layout (authenticated shell)
// ─────────────────────────────────────────────────────────────

export const metadata: Metadata = {
    title: 'Dashboard'
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <AppShell>{children}</AppShell>;
}
