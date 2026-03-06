'use client';

import type { Theme } from '@/context/theme-provider';
import { useTheme } from '@/hooks/use-theme';
import type React from 'react';
import styles from './theme-toggle.module.scss';

// ─────────────────────────────────────────────────────────────
// Theme Toggle — Cycles light → dark → system
// ─────────────────────────────────────────────────────────────

const CYCLE: Theme[] = ['light', 'dark', 'system'];

const LABELS: Record<Theme, string> = {
  light: 'Switch to dark mode',
  dark: 'Switch to system mode',
  system: 'Switch to light mode',
};

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

const ICONS: Record<Theme, () => React.JSX.Element> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();

  const handleClick = () => {
    const currentIndex = CYCLE.indexOf(theme);
    const nextTheme = CYCLE[(currentIndex + 1) % CYCLE.length]!;
    setTheme(nextTheme);
  };

  const Icon = ICONS[theme];

  // Render a placeholder with fixed dimensions until the client has
  // hydrated with the real theme from localStorage. This avoids a
  // server/client mismatch on aria-label and icon content.
  if (!mounted) {
    return (
      <button
        type="button"
        className={styles.toggle}
        aria-hidden
        tabIndex={-1}
      />
    );
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={handleClick}
      aria-label={LABELS[theme]}
      title={LABELS[theme]}
    >
      <Icon />
    </button>
  );
}
