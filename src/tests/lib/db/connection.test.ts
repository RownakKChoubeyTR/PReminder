import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to avoid file I/O during tests
vi.mock('@/lib/db/logger', () => ({
    dbLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        separator: vi.fn()
    }
}));

import { composeDatabaseUrl, maskDatabaseUrl } from '@/lib/db/connection';

describe('composeDatabaseUrl', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Clear all DB-related env vars
        delete process.env.DB_HOST;
        delete process.env.DB_PORT;
        delete process.env.DB_USER;
        delete process.env.DB_PASSWORD;
        delete process.env.DB_NAME;
        delete process.env.DB_SCHEMA;
        delete process.env.DB_SSL_MODE;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('composes URL from individual env vars', () => {
        process.env.DB_HOST = 'myhost';
        process.env.DB_PORT = '5432';
        process.env.DB_USER = 'myuser';
        process.env.DB_PASSWORD = 'secret123';
        process.env.DB_NAME = 'mydb';

        const url = composeDatabaseUrl();

        expect(url).toBe('postgresql://myuser:secret123@myhost:5432/mydb?schema=public');
    });

    it('uses custom schema when DB_SCHEMA is set', () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_USER = 'user';
        process.env.DB_PASSWORD = 'pass';
        process.env.DB_NAME = 'db';
        process.env.DB_SCHEMA = 'custom_schema';

        const url = composeDatabaseUrl();

        expect(url).toContain('schema=custom_schema');
    });

    it('appends sslmode when DB_SSL_MODE is set', () => {
        process.env.DB_HOST = 'remote.host.com';
        process.env.DB_PORT = '5432';
        process.env.DB_USER = 'user';
        process.env.DB_PASSWORD = 'pass';
        process.env.DB_NAME = 'db';
        process.env.DB_SSL_MODE = 'require';

        const url = composeDatabaseUrl();

        expect(url).toContain('sslmode=require');
    });

    it('URL-encodes special characters in user/password', () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_USER = 'user@org';
        process.env.DB_PASSWORD = 'p@ss:w0rd/special';
        process.env.DB_NAME = 'db';

        const url = composeDatabaseUrl();

        expect(url).toContain('user%40org');
        expect(url).toContain('p%40ss%3Aw0rd%2Fspecial');
    });

    it('throws when required env vars are missing', () => {
        expect(() => composeDatabaseUrl()).toThrow('Missing required env vars');
    });

    it('lists which env vars are missing in the error', () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        // DB_USER, DB_PASSWORD, DB_NAME are missing

        expect(() => composeDatabaseUrl()).toThrow('DB_USER');
        expect(() => composeDatabaseUrl()).toThrow('DB_PASSWORD');
        expect(() => composeDatabaseUrl()).toThrow('DB_NAME');
    });
});

describe('maskDatabaseUrl', () => {
    it('masks the password in a standard PostgreSQL URL', () => {
        const url = 'postgresql://myuser:mysecret@localhost:5432/mydb';
        const masked = maskDatabaseUrl(url);

        expect(masked).toBe('postgresql://myuser:****@localhost:5432/mydb');
        expect(masked).not.toContain('mysecret');
    });

    it('handles special characters in username', () => {
        const url = 'postgresql://user%40org:secret@host:5432/db';
        const masked = maskDatabaseUrl(url);

        expect(masked).toContain('user%40org:****@');
        expect(masked).not.toContain('secret');
    });

    it('returns safe fallback for unparseable input', () => {
        const result = maskDatabaseUrl('not-a-url');
        // Should still return something (the regex just won't match)
        expect(typeof result).toBe('string');
    });
});
