import { env } from '@/lib/env';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ─────────────────────────────────────────────────────────────
// AES-256-GCM Encryption Layer
// ─────────────────────────────────────────────────────────────
// Used to encrypt sensitive integration configs stored in the DB
// (e.g., Power Automate webhook URLs, API keys).

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'hex' as const;

/**
 * Derive the 32-byte key buffer from the hex-encoded ENCRYPTION_KEY env var.
 */
function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt a plaintext string.
 *
 * Output format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);

  const authTag = cipher.getAuthTag().toString(ENCODING);

  return `${iv.toString(ENCODING)}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a previously encrypted string.
 *
 * Expects the `iv:authTag:ciphertext` format produced by {@link encrypt}.
 *
 * @throws {Error} If the value is malformed or tampered with.
 */
export function decrypt(encryptedValue: string): string {
  const parts = encryptedValue.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];

  const iv = Buffer.from(ivHex, ENCODING);
  const authTag = Buffer.from(authTagHex, ENCODING);

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted: string = decipher.update(ciphertext, ENCODING, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
