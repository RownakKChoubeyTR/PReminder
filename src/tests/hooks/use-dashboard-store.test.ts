import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { beforeEach, describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Dashboard Store Tests
// ─────────────────────────────────────────────────────────────

describe('useDashboardStore', () => {
    beforeEach(() => {
        // Reset store between tests
        useDashboardStore.setState({
            selectedRepo: null,
            selectedPR: null,
            sidebarCollapsed: false,
            repoSearch: '',
            prSearch: '',
            repoPage: 1,
            prPage: 1,
            myPrSelected: null
        });
    });

    it('should have correct initial state', () => {
        const state = useDashboardStore.getState();
        expect(state.selectedRepo).toBeNull();
        expect(state.selectedPR).toBeNull();
        expect(state.sidebarCollapsed).toBe(false);
        expect(state.repoSearch).toBe('');
        expect(state.prSearch).toBe('');
        expect(state.repoPage).toBe(1);
        expect(state.prPage).toBe(1);
        expect(state.myPrSelected).toBeNull();
    });

    it('should select a repo and reset PR selection', () => {
        const { selectPR, selectRepo } = useDashboardStore.getState();

        // First select a PR
        selectPR(42);
        expect(useDashboardStore.getState().selectedPR).toBe(42);

        // Selecting a repo should reset PR
        selectRepo('my-repo');
        expect(useDashboardStore.getState().selectedRepo).toBe('my-repo');
        expect(useDashboardStore.getState().selectedPR).toBeNull();
        expect(useDashboardStore.getState().prSearch).toBe('');
    });

    it('should select and deselect a PR', () => {
        const { selectPR } = useDashboardStore.getState();

        selectPR(7);
        expect(useDashboardStore.getState().selectedPR).toBe(7);

        selectPR(null);
        expect(useDashboardStore.getState().selectedPR).toBeNull();
    });

    it('should toggle sidebar collapsed state', () => {
        const { toggleSidebar } = useDashboardStore.getState();

        expect(useDashboardStore.getState().sidebarCollapsed).toBe(false);
        toggleSidebar();
        expect(useDashboardStore.getState().sidebarCollapsed).toBe(true);
        toggleSidebar();
        expect(useDashboardStore.getState().sidebarCollapsed).toBe(false);
    });

    it('should set sidebar collapsed directly', () => {
        const { setSidebarCollapsed } = useDashboardStore.getState();

        setSidebarCollapsed(true);
        expect(useDashboardStore.getState().sidebarCollapsed).toBe(true);
        setSidebarCollapsed(false);
        expect(useDashboardStore.getState().sidebarCollapsed).toBe(false);
    });

    it('should set repo search', () => {
        const { setRepoSearch } = useDashboardStore.getState();

        setRepoSearch('front');
        expect(useDashboardStore.getState().repoSearch).toBe('front');
    });

    it('should set PR search', () => {
        const { setPrSearch } = useDashboardStore.getState();

        setPrSearch('bug fix');
        expect(useDashboardStore.getState().prSearch).toBe('bug fix');
    });

    it('should clear PR search when switching repos', () => {
        const { selectRepo, setPrSearch } = useDashboardStore.getState();

        setPrSearch('some search');
        expect(useDashboardStore.getState().prSearch).toBe('some search');

        selectRepo('another-repo');
        expect(useDashboardStore.getState().prSearch).toBe('');
    });

    it('should deselect repo by passing null', () => {
        const { selectRepo } = useDashboardStore.getState();

        selectRepo('repo-a');
        expect(useDashboardStore.getState().selectedRepo).toBe('repo-a');

        selectRepo(null);
        expect(useDashboardStore.getState().selectedRepo).toBeNull();
    });

    it('should reset prPage when selecting a new repo', () => {
        const { selectRepo, setPrPage } = useDashboardStore.getState();

        setPrPage(5);
        expect(useDashboardStore.getState().prPage).toBe(5);

        selectRepo('new-repo');
        expect(useDashboardStore.getState().prPage).toBe(1);
    });

    it('should reset repoPage when changing search', () => {
        const { setRepoSearch, setRepoPage } = useDashboardStore.getState();

        setRepoPage(3);
        expect(useDashboardStore.getState().repoPage).toBe(3);

        setRepoSearch('frontend');
        expect(useDashboardStore.getState().repoPage).toBe(1);
    });

    it('should store a selected My PR', () => {
        const { setMyPrSelected } = useDashboardStore.getState();
        const pr = { id: 99, number: 10, title: 'My PR', repo_name: 'org/repo' } as never;

        setMyPrSelected(pr);
        expect(useDashboardStore.getState().myPrSelected).toEqual(pr);
    });

    it('should clear myPrSelected when set to null', () => {
        const { setMyPrSelected } = useDashboardStore.getState();
        const pr = { id: 99, number: 10, title: 'My PR', repo_name: 'org/repo' } as never;

        setMyPrSelected(pr);
        expect(useDashboardStore.getState().myPrSelected).not.toBeNull();

        setMyPrSelected(null);
        expect(useDashboardStore.getState().myPrSelected).toBeNull();
    });

    it('should replace myPrSelected when a different PR is selected', () => {
        const { setMyPrSelected } = useDashboardStore.getState();
        const pr1 = { id: 1, number: 1, title: 'PR 1', repo_name: 'org/repo' } as never;
        const pr2 = { id: 2, number: 2, title: 'PR 2', repo_name: 'org/repo' } as never;

        setMyPrSelected(pr1);
        setMyPrSelected(pr2);
        expect(useDashboardStore.getState().myPrSelected).toEqual(pr2);
    });
});
