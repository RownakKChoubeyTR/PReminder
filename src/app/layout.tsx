import { QueryProvider } from '@/context/query-provider';
import { ThemeProvider } from '@/context/theme-provider';
import '@/styles/tailwind.css';
import '@/styles/globals.scss';
import type { Metadata } from 'next';

// ─────────────────────────────────────────────────────────────
// Root Layout
// ─────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'PReminder — PR Review Reminder',
    template: '%s | PReminder',
  },
  description:
    'Track open pull requests, nudge reviewers on Teams & email, and keep your code reviews moving.',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to prevent FOUC — sets data-theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('preminder-theme') || 'system';
                  var resolved = theme;
                  if (theme === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', resolved);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
