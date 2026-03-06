import { QueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// TanStack Query Client — Shared Configuration
// ─────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Data is fresh for 2 minutes — avoids unnecessary re-fetches
                // when navigating between tabs/pages.
                staleTime: 2 * 60 * 1000,

                // Keep unused cache entries for 5 minutes before GC.
                gcTime: 5 * 60 * 1000,

                // Retry failed requests up to 2 times with exponential backoff.
                retry: 2,
                retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10_000),

                // Don't refetch when the window regains focus by default —
                // explicit invalidation via mutation callbacks is preferred.
                refetchOnWindowFocus: false
            }
        }
    });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Get or create a singleton QueryClient.
 *
 * On the server, always create a new client (avoid cross-request leaks).
 * In the browser, reuse the same client across renders.
 */
export function getQueryClient(): QueryClient {
    if (typeof window === 'undefined') {
        // Server: always new
        return makeQueryClient();
    }

    // Browser: singleton
    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
}
