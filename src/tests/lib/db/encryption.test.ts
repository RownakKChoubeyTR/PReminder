import { decrypt, encrypt } from '@/lib/db/encryption';
import { describe, expect, it, vi } from 'vitest';

// Mock the env module so encryption can access ENCRYPTION_KEY without Zod validation
vi.mock('@/lib/env', () => ({
    env: {
        // 64-char hex string = 32-byte key for AES-256
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    }
}));

describe('Encryption', () => {
    const plaintext = 'https://prod-123.westus.logic.azure.com/workflows/abc';

    it('encrypts and decrypts correctly', () => {
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext each time (random IV)', () => {
        const a = encrypt(plaintext);
        const b = encrypt(plaintext);
        expect(a).not.toBe(b);
    });

    it('throws on tampered ciphertext', () => {
        const encrypted = encrypt(plaintext);
        // Ensure we actually change the last character (avoid no-op if already "0")
        const lastChar = encrypted.at(-1);
        const tampered = encrypted.slice(0, -1) + (lastChar === '0' ? '1' : '0');
        expect(() => decrypt(tampered)).toThrow();
    });

    it('throws on malformed input', () => {
        expect(() => decrypt('not-valid')).toThrow('Invalid encrypted value format');
    });
});
