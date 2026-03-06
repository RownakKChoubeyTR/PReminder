import type { Config } from 'tailwindcss';

// ─────────────────────────────────────────────────────────────
// PReminder — Tailwind Configuration
// ─────────────────────────────────────────────────────────────
// Bridges Tailwind utility classes with the existing CSS Custom
// Property theme system (see src/styles/themes/).
//
// SCSS Modules remain the primary styling approach for app
// components. Tailwind is used for shadcn/ui primitives and
// the landing page Spline integration.
// ─────────────────────────────────────────────────────────────

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],

  theme: {
    extend: {
      // Map Tailwind color names → CSS Custom Properties
      colors: {
        border: 'var(--color-border)',
        ring: 'var(--color-border-focus)',
        background: 'var(--color-bg-primary)',
        foreground: 'var(--color-text-primary)',
        card: {
          DEFAULT: 'var(--color-bg-elevated)',
          foreground: 'var(--color-text-primary)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-contrast)',
          hover: 'var(--color-primary-hover)',
          subtle: 'var(--color-primary-subtle)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--color-primary-contrast)',
          hover: 'var(--color-secondary-hover)',
        },
        muted: {
          DEFAULT: 'var(--color-bg-tertiary)',
          foreground: 'var(--color-text-muted)',
        },
        accent: {
          DEFAULT: 'var(--color-bg-secondary)',
          foreground: 'var(--color-text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--color-danger)',
          foreground: 'var(--color-danger-contrast)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          foreground: 'var(--color-success-contrast)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          foreground: 'var(--color-warning-contrast)',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Cascadia Code',
          'Consolas',
          'Courier New',
          'monospace',
        ],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      animation: {
        spotlight: 'spotlight 2s ease 0.75s 1 forwards',
      },
      keyframes: {
        spotlight: {
          '0%': {
            opacity: '0',
            transform: 'translate(-72%, -62%) scale(0.5)',
          },
          '100%': {
            opacity: '1',
            transform: 'translate(-50%, -40%) scale(1)',
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
