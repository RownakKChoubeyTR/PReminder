// ─────────────────────────────────────────────────────────────
// Universal Logger
// ─────────────────────────────────────────────────────────────
// Factory-based structured logger with two output channels:
//
//   Console — dev only (NODE_ENV === 'development'), ANSI-colorized
//             box-border format, one blank line between each entry.
//
//   File    — dev only (server-side), JSON Lines appended to:
//               • logs/dbLog.txt          — when logFile: 'dbLog.txt'
//               • logs/log_YYYY-MM-DD.txt — default (daily rotation)
//
// Usage:
//   const log = createLogger('my-module');
//   const dbLog = createLogger('db', { logFile: 'dbLog.txt' });
//
//   log.info('Server started', { port: 3000 });
//   log.warn('Slow query', { ms: 450, query: '...' });
//   log.error('Fetch failed', err, { url, attempt: 2 });
//   log.debug('Cache miss', { key });
//
// Levels (ascending severity): debug < info < warn < error
//
// Console format (dev):
//   ╭─ INFO  [ctx]  HH:mm:ss.mmm ──────────────────────────────╮
//   │  Message text
//   │  › key: value
//   │  ↳ Error message
//   ╰──────────────────────────────────────────────────────────╯
//
// File format (JSON Lines, one object per line):
//   { "ts":"ISO", "level":"INFO", "ctx":"my-module", "msg":"...",
//     "data":{}, "err":"...", "stack":"..." }
// ─────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
    ts: string;
    level: LogLevel;
    ctx: string;
    msg: string;
    caller?: string; // file:line  fn  — captured from call stack
    data?: Record<string, unknown>;
    err?: string;
    stack?: string;
}

export interface Logger {
    debug(msg: string, data?: Record<string, unknown>): void;
    info(msg: string, data?: Record<string, unknown>): void;
    warn(msg: string, data?: Record<string, unknown>): void;
    error(msg: string, err?: unknown, data?: Record<string, unknown>): void;
}

export interface LoggerOptions {
    /**
     * Override the log file name (relative to logs/ directory).
     * Defaults to `log_YYYY-MM-DD.txt` (daily rotation).
     * Example: 'dbLog.txt'
     */
    logFile?: string;
}

// ── Environment flags ─────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === 'development';
const IS_SERVER = typeof window === 'undefined';

// ── ANSI colour helpers (console output, dev only) ────────────

const ANSI = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    grey: '\x1b[90m'
} as const;

const LEVEL_COLOUR: Record<LogLevel, string> = {
    DEBUG: ANSI.magenta,
    INFO: ANSI.cyan,
    WARN: ANSI.yellow,
    ERROR: ANSI.red
};

const LEVEL_CONSOLE: Record<LogLevel, (...args: unknown[]) => void> = {
    DEBUG: (...a) => console.debug(...a),
    INFO: (...a) => console.info(...a),
    WARN: (...a) => console.warn(...a),
    ERROR: (...a) => console.error(...a)
};

// ── Caller capture ───────────────────────────────────────────
// Walks the Error stack to find the first frame outside logger.ts.
// Returns a compact "file:line  fnName" string for the box footer.

function captureCallerInfo(): string | undefined {
    const raw = new Error().stack;
    if (!raw) return undefined;

    const lines = raw.split('\n');
    const cwd = (typeof process !== 'undefined' ? process.cwd() : '').replace(/\\/g, '/');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('at ')) continue;

        // Skip internal logger frames and third-party code
        if (
            trimmed.includes('logger.ts') ||
            trimmed.includes('node_modules') ||
            trimmed.includes('node:') ||
            trimmed.includes('webpack-internal') ||
            trimmed.includes('<anonymous>')
        )
            continue;

        // Parse:  at FnName (file:line:col)  OR  at file:line:col
        const withParens = /^at (.+?) \((.+?):(\d+):\d+\)/.exec(trimmed);
        const withoutParens = /^at (.+?):(\d+):\d+$/.exec(trimmed);

        let fnName = '';
        let filePath = '';
        let lineNum = '';

        if (withParens) {
            fnName = withParens[1] ?? '';
            filePath = withParens[2] ?? '';
            lineNum = withParens[3] ?? '';
        } else if (withoutParens) {
            filePath = withoutParens[1] ?? '';
            lineNum = withoutParens[2] ?? '';
        } else {
            continue;
        }

        // Make path relative and normalise separators
        filePath = filePath.replace(/\\/g, '/');
        if (filePath.startsWith(cwd + '/')) {
            filePath = filePath.slice(cwd.length + 1);
        }
        // Strip common Next.js noise prefixes
        filePath = filePath.replace(/^.*webpack-internal:\/+/, '').replace(/^.*\.next\/server\//, '');

        // Clean up function name (drop Object. prefix, async prefix)
        fnName = fnName
            .replace(/^async /, '')
            .replace(/^Object\./, '')
            .replace(/^Module\./, '')
            .trim();

        const location = `${filePath}:${lineNum}`;
        return fnName && fnName !== 'eval' ? `${location}  ${fnName}` : location;
    }

    return undefined;
}

/** Total console width for box borders. */
const BOX_WIDTH = 72;

function prettyConsole(entry: LogEntry): void {
    const colour = LEVEL_COLOUR[entry.level];
    const c = colour;
    const R = ANSI.reset;

    // ── Header line ─────────────────────────────────────────────
    const time = entry.ts.slice(11, 23); // HH:mm:ss.mmm
    const ctxStr = entry.ctx ? ` [${entry.ctx}]` : '';
    const badge = ` ${entry.level.padEnd(5)}${ctxStr}  ${time} `;
    const fillLen = Math.max(2, BOX_WIDTH - badge.length - 3); // 3 = '╭─' + '╮'
    const top = `╭─${badge}${'─'.repeat(fillLen)}╮`;
    const bar = `${c}│${R}`;

    // ── Body lines ───────────────────────────────────────────────
    const body: string[] = [];

    body.push(`${bar}  ${ANSI.bold}${entry.msg}${R}`);

    if (entry.data && Object.keys(entry.data).length) {
        for (const [k, v] of Object.entries(entry.data)) {
            const val = typeof v === 'string' ? v : JSON.stringify(v);
            body.push(`${bar}  ${ANSI.grey}› ${ANSI.bold}${k}${R}${ANSI.grey}: ${val}${R}`);
        }
    }

    if (entry.err) {
        body.push(`${bar}  ${ANSI.red}↳ ${entry.err}${R}`);
    }

    if (entry.stack) {
        for (const frame of entry.stack.split(' | ')) {
            body.push(`${bar}  ${ANSI.dim}  ${frame.trim()}${R}`);
        }
    }

    // ── Footer line (caller info) ─────────────────────────────
    // Shows  file:line  fnName  aligned right inside the bottom border.
    let bottom: string;
    if (entry.caller) {
        const callerLabel = ` ${entry.caller} `;
        const innerWidth = BOX_WIDTH - 2; // between ╰ and ╯
        const dashLen = Math.max(0, innerWidth - callerLabel.length);
        bottom = `${c}╰${'─'.repeat(dashLen)}${ANSI.dim}${callerLabel}${R}${c}╯${R}`;
    } else {
        bottom = `${c}╰${'─'.repeat(BOX_WIDTH - 1)}╯${R}`;
    }

    const lines = [`${c}${ANSI.bold}${top}${R}`, ...body, bottom].join('\n');

    LEVEL_CONSOLE[entry.level](lines);
}

// ── File writer (server-side only) ───────────────────────────
// Uses dynamic require so the module still loads in Edge/browser environments
// (where the import would be tree-shaken or mocked) without errors.

let _writeFileLine: ((filePath: string, line: string) => void) | null = null;

function getFileWriter(): ((filePath: string, line: string) => void) | null {
    if (!IS_SERVER) return null;
    if (_writeFileLine) return _writeFileLine;

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fsModule = require('node:fs') as typeof import('node:fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pathModule = require('node:path') as typeof import('node:path');
        _writeFileLine = (filePath: string, line: string) => {
            fsModule.mkdirSync(pathModule.dirname(filePath), { recursive: true });
            fsModule.appendFileSync(filePath, line + '\n', 'utf8');
        };
    } catch {
        // node:fs not available (Edge runtime) — silently degrade
        _writeFileLine = null;
    }

    return _writeFileLine;
}

function defaultLogFilePath(): string {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('node:path') as typeof import('node:path');
    return join(process.cwd(), 'logs', `log_${date}.txt`);
}

function resolveLogFilePath(logFile?: string): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('node:path') as typeof import('node:path');
    if (logFile) return join(process.cwd(), 'logs', logFile);
    return defaultLogFilePath();
}

function writeToFile(entry: LogEntry, logFile?: string): void {
    // File output is dev-only — keeps production noise-free.
    if (process.env.NODE_ENV !== 'development') return;

    const writer = getFileWriter();
    if (!writer) return;

    try {
        writer(resolveLogFilePath(logFile), JSON.stringify(entry));
    } catch {
        // Never let log failures crash the application
    }
}

// ── Core emit ─────────────────────────────────────────────────

function emit(
    level: LogLevel,
    ctx: string,
    msg: string,
    err?: unknown,
    data?: Record<string, unknown>,
    logFile?: string
): void {
    const errMessage = err instanceof Error ? err.message : err !== undefined ? String(err) : undefined;
    const stack = err instanceof Error && err.stack ? err.stack.split('\n').slice(1, 4).join(' | ').trim() : undefined;

    const entry: LogEntry = {
        ts: new Date().toISOString(),
        level,
        ctx,
        msg,
        caller: IS_DEV ? captureCallerInfo() : undefined,
        ...(data && Object.keys(data).length ? { data } : {}),
        ...(errMessage ? { err: errMessage } : {}),
        ...(stack ? { stack } : {})
    };

    // Console — dev only
    if (IS_DEV) {
        prettyConsole(entry);
    }

    // File — dev only (logs/ directory, filename controlled by logFile option)
    writeToFile(entry, logFile);
}

// ── Factory ───────────────────────────────────────────────────

/**
 * Create a logger bound to a specific module context.
 *
 * @param context  Short label shown in every log line, e.g. 'api/integrations'.
 * @param options  Optional configuration.
 * @param options.logFile  Override the log file name (relative to logs/).
 *                         Defaults to `log_YYYY-MM-DD.txt`.
 *                         Pass `'dbLog.txt'` for the database logger.
 *
 * @example
 *   const log   = createLogger('api/integrations');
 *   const dbLog = createLogger('db', { logFile: 'dbLog.txt' });
 *
 *   log.info('Integration saved', { id, type });
 *   log.error('Decrypt failed', decryptErr, { id });
 */
export function createLogger(context: string, options?: LoggerOptions): Logger {
    const { logFile } = options ?? {};
    return {
        debug(msg, data) {
            emit('DEBUG', context, msg, undefined, data, logFile);
        },
        info(msg, data) {
            emit('INFO', context, msg, undefined, data, logFile);
        },
        warn(msg, data) {
            emit('WARN', context, msg, undefined, data, logFile);
        },
        error(msg, err, data) {
            emit('ERROR', context, msg, err, data, logFile);
        }
    };
}

// ── DB Logger singleton ─────────────────────────────────────────
// A pre-built logger for all database-layer code.
//   • Context : 'db'
//   • Log file : logs/dbLog.txt  (dev only)
//   • Extra    : separator() — console-only visual divider

const _DB_SEP = '─'.repeat(69); // matches BOX_WIDTH-ish

export const dbLogger = {
    ...createLogger('db', { logFile: 'dbLog.txt' }),

    /**
     * Print a visual divider to the console (dev only).
     * Not written to file — purely for grouping connection-attempt
     * blocks in the dev terminal.
     */
    separator(): void {
        if (IS_DEV) {
            console.log(`${ANSI.grey}   ${_DB_SEP}${ANSI.reset}\n`);
        }
    }
};

// ── Backward-compatible singleton ─────────────────────────────
// Kept so existing callers that import `logger` continue to work.
// New code should use `createLogger('my-context')` instead.

export const logger = {
    /** @deprecated Use `createLogger(ctx).info(msg, data)` */
    info(message: string, context?: string): void {
        emit('INFO', context ?? '', message);
    },
    /** @deprecated Use `createLogger(ctx).warn(msg, data)` */
    warn(message: string, context?: string): void {
        emit('WARN', context ?? '', message);
    },
    /** @deprecated Use `createLogger(ctx).error(msg, err, data)` */
    error(message: string, context?: string, err?: unknown): void {
        emit('ERROR', context ?? '', message, err);
    }
};
