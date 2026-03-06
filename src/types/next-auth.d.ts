import 'next-auth';
import 'next-auth/jwt';

// ─────────────────────────────────────────────────────────────
// NextAuth Type Augmentation
// ─────────────────────────────────────────────────────────────
// Extends the default Session and JWT types to include our
// custom properties: GitHub identity, token lifecycle, and
// error signalling for client-side session recovery.

declare module 'next-auth' {
  interface Session {
    /** GitHub personal access token (server-side only). */
    accessToken: string;
    /** ISO timestamp when the session expires. */
    expiresAt: string;
    /** Error code when the session is degraded (e.g. token revoked). */
    error?: string;
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** GitHub username (e.g. "octocat"). */
      githubLogin: string;
      /** GitHub numeric user ID. */
      githubId: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    githubLogin?: string;
    githubId?: string;
    /** Unix epoch (seconds) when the JWT was first created. */
    tokenIssuedAt?: number;
    /** Unix epoch (seconds) when GitHub token was last verified. */
    lastVerifiedAt?: number;
    /** Unix epoch (seconds) — absolute session expiry. */
    expiresAt?: number;
    /** Set when the token is degraded — client should re-authenticate. */
    error?: string;
  }
}
