import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Validated environment variables.
 *
 * Server-side vars are only accessible in API routes / server components.
 * Client-side vars must be prefixed with NEXT_PUBLIC_ and are safe to expose.
 *
 * @see https://env.t3.gg/docs/nextjs
 */
export const env = createEnv({
  // ─── Server ────────────────────────────────────────────────
  server: {
    // Auth
    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32),

    // GitHub OAuth
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_ORG: z.string().min(1),

    // Optional: Personal Access Token for orgs with SAML SSO enforcement.
    // When set, used for GitHub API calls instead of the OAuth token.
    // The user can authorize a PAT for SSO without needing org admin approval.
    // Create at: https://github.com/settings/tokens (classic, scopes: repo, read:org)
    GITHUB_PAT: z.string().optional(),

    // Database — individual credentials (enterprise pattern)
    // The full URL is composed at runtime in src/lib/db/connection.ts.
    // Prisma CLI gets its DATABASE_URL from scripts/prisma-cli.mjs.
    DB_HOST: z.string().min(1),
    DB_PORT: z.string().regex(/^\d+$/, 'Must be a numeric port'),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),
    DB_SCHEMA: z.string().optional(),
    DB_SSL_MODE: z.enum(['require', 'prefer', 'disable']).optional(),

    // Encryption (hex-encoded 32-byte key)
    ENCRYPTION_KEY: z
      .string()
      .length(64)
      .regex(/^[0-9a-fA-F]+$/, 'Must be a 64-char hex string'),

    // Azure AD (optional — for Graph API email & Teams)
    AZURE_AD_CLIENT_ID: z.string().optional(),
    AZURE_AD_CLIENT_SECRET: z.string().optional(),
    AZURE_AD_TENANT_ID: z.string().optional(),

    // Power Automate (optional — default Flow URL for Teams DM)
    // Can be overridden per-user via Settings → Integrations (stored encrypted in DB).
    POWER_AUTOMATE_FLOW_URL: z.string().url().optional(),

    // Feature flags
    ENABLE_TEAMS_DM: z.enum(['true', 'false']).default('false'),
    ENABLE_EMAIL: z.enum(['true', 'false']).default('false'),
    ENABLE_DESKTOP_NOTIFICATIONS: z.enum(['true', 'false']).default('true'),
  },

  // ─── Client (NEXT_PUBLIC_*) ────────────────────────────────
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },

  // ─── Runtime values ────────────────────────────────────────
  runtimeEnv: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,

    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GITHUB_ORG: process.env.GITHUB_ORG,
    GITHUB_PAT: process.env.GITHUB_PAT,

    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_SCHEMA: process.env.DB_SCHEMA,
    DB_SSL_MODE: process.env.DB_SSL_MODE,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,

    POWER_AUTOMATE_FLOW_URL: process.env.POWER_AUTOMATE_FLOW_URL,

    ENABLE_TEAMS_DM: process.env.ENABLE_TEAMS_DM,
    ENABLE_EMAIL: process.env.ENABLE_EMAIL,
    ENABLE_DESKTOP_NOTIFICATIONS: process.env.ENABLE_DESKTOP_NOTIFICATIONS,

    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  /**
   * Skip validation when building in Docker (env vars not available at build time).
   * They will be validated at runtime instead.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Treat empty strings as undefined so optional() works correctly.
   */
  emptyStringAsUndefined: true,
});

// ─── Helper booleans (avoid repeated comparisons) ───────────
export const isTeamsDMEnabled = env.ENABLE_TEAMS_DM === 'true';
export const isEmailEnabled = env.ENABLE_EMAIL === 'true';
export const isDesktopNotificationsEnabled = env.ENABLE_DESKTOP_NOTIFICATIONS === 'true';
