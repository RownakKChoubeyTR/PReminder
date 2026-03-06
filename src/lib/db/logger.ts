import { createLogger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────
// Database Logger
// ─────────────────────────────────────────────────────────────
// Thin adapter over the universal createLogger factory.
//
// Output (NODE_ENV === 'development' only):
//   Console  — box-border pretty-print via logger.ts
//   File     — JSON Lines → logs/dbLog.txt
//
// separator() prints a visual divider to the console to break
// up connection-attempt groups. No file noise.
// ─────────────────────────────────────────────────────────────

const _log = createLogger('db', { logFile: 'dbLog.txt' });

const GREY = '\x1b[90m';
const RESET = '\x1b[0m';
const SEP = '─'.repeat(69); // matches BOX_WIDTH - 2 in logger.ts

export const dbLogger = {
    ..._log,

    /**
     * Print a visual divider to the console (dev only).
     * Groups connection attempt blocks for readability.
     * Not written to file.
     */
    separator(): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(`${GREY}   ${SEP}${RESET}\n`);
        }
    }
};
