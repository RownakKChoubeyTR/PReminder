import type { GitHubMyPR } from '@/types/github';
import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
// Dashboard Store — Zustand
// ─────────────────────────────────────────────────────────────
// Manages client-side dashboard state: selected repo, selected PR,
// sidebar collapse, search/filter terms, pagination.

interface DashboardState {
    /** Currently selected repository name (e.g. "my-repo"). */
    selectedRepo: string | null;
    /** Currently selected PR number for detail view. */
    selectedPR: number | null;
    /** Whether the sidebar is collapsed. */
    sidebarCollapsed: boolean;
    /** Search filter for the repository list. */
    repoSearch: string;
    /** Search filter for the PR table. */
    prSearch: string;
    /** Current page number for repos pagination. */
    repoPage: number;
    /** Current page number for PRs pagination. */
    prPage: number;
    /** PR selected from the My PRs page (stores full object to avoid re-fetching). */
    myPrSelected: GitHubMyPR | null;

    // Actions
    selectRepo: (repo: string | null) => void;
    selectPR: (prNumber: number | null) => void;
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setRepoSearch: (search: string) => void;
    setPrSearch: (search: string) => void;
    setRepoPage: (page: number) => void;
    setPrPage: (page: number) => void;
    setMyPrSelected: (pr: GitHubMyPR | null) => void;
}

export const useDashboardStore = create<DashboardState>(set => ({
    selectedRepo: null,
    selectedPR: null,
    sidebarCollapsed: false,
    repoSearch: '',
    prSearch: '',
    repoPage: 1,
    prPage: 1,

    selectRepo: repo =>
        set({
            selectedRepo: repo,
            selectedPR: null,
            prSearch: '',
            prPage: 1
        }),

    selectPR: prNumber => set({ selectedPR: prNumber }),

    toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

    setSidebarCollapsed: collapsed => set({ sidebarCollapsed: collapsed }),

    setRepoSearch: search => set({ repoSearch: search, repoPage: 1 }),

    setPrSearch: search => set({ prSearch: search, prPage: 1 }),

    setRepoPage: page => set({ repoPage: page }),

    setPrPage: page => set({ prPage: page }),

    myPrSelected: null,
    setMyPrSelected: pr => set({ myPrSelected: pr })
}));
