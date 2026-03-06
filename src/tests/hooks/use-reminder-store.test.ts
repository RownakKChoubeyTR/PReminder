import { useReminderStore } from '@/hooks/use-reminder-store';
import { beforeEach, describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: Reminder Store (Zustand)
// ─────────────────────────────────────────────────────────────

describe('useReminderStore', () => {
    beforeEach(() => {
        useReminderStore.getState().reset();
    });

    it('has correct initial state', () => {
        const state = useReminderStore.getState();
        expect(state.selectedReviewers).toEqual([]);
        expect(state.flowOpen).toBe(false);
        expect(state.channel).toBe('TEAMS_DM');
        expect(state.templateId).toBeNull();
        expect(state.prContext).toBeNull();
    });

    // ── Reviewer selection ───────────────────────────────────

    it('toggleReviewer adds new reviewer', () => {
        useReminderStore.getState().toggleReviewer('alice');
        expect(useReminderStore.getState().selectedReviewers).toEqual(['alice']);
    });

    it('toggleReviewer removes existing reviewer', () => {
        useReminderStore.getState().toggleReviewer('alice');
        useReminderStore.getState().toggleReviewer('alice');
        expect(useReminderStore.getState().selectedReviewers).toEqual([]);
    });

    it('selectAllReviewers merges with existing', () => {
        useReminderStore.getState().toggleReviewer('alice');
        useReminderStore.getState().selectAllReviewers(['bob', 'charlie', 'alice']);
        const reviewers = useReminderStore.getState().selectedReviewers;
        expect(reviewers).toContain('alice');
        expect(reviewers).toContain('bob');
        expect(reviewers).toContain('charlie');
        expect(reviewers).toHaveLength(3);
    });

    it('deselectReviewers removes specified logins', () => {
        useReminderStore.getState().selectAllReviewers(['alice', 'bob', 'charlie']);
        useReminderStore.getState().deselectReviewers(['alice', 'charlie']);
        expect(useReminderStore.getState().selectedReviewers).toEqual(['bob']);
    });

    it('clearReviewers empties the list', () => {
        useReminderStore.getState().selectAllReviewers(['alice', 'bob']);
        useReminderStore.getState().clearReviewers();
        expect(useReminderStore.getState().selectedReviewers).toEqual([]);
    });

    // ── Flow modal ───────────────────────────────────────────

    it('openFlow sets flowOpen to true', () => {
        useReminderStore.getState().openFlow();
        expect(useReminderStore.getState().flowOpen).toBe(true);
    });

    it('closeFlow sets flowOpen to false', () => {
        useReminderStore.getState().openFlow();
        useReminderStore.getState().closeFlow();
        expect(useReminderStore.getState().flowOpen).toBe(false);
    });

    // ── Channel & template ──────────────────────────────────

    it('setChannel updates channel', () => {
        useReminderStore.getState().setChannel('TEAMS_CHANNEL');
        expect(useReminderStore.getState().channel).toBe('TEAMS_CHANNEL');
    });

    it('setTemplateId updates templateId', () => {
        useReminderStore.getState().setTemplateId('tmpl-1');
        expect(useReminderStore.getState().templateId).toBe('tmpl-1');
    });

    // ── PR context ──────────────────────────────────────────

    it('setPrContext sets PR metadata', () => {
        const ctx = {
            number: 42,
            title: 'Fix bug',
            url: 'https://github.com/org/repo/pull/42',
            repo: 'org/repo',
            branch: 'fix-bug',
            targetBranch: 'main',
            age: 3,
            labels: ['bug'],
            description: 'Fixes the issue'
        };
        useReminderStore.getState().setPrContext(ctx);
        expect(useReminderStore.getState().prContext).toEqual(ctx);
    });

    // ── Reset ───────────────────────────────────────────────

    it('reset restores initial state', () => {
        useReminderStore.getState().toggleReviewer('alice');
        useReminderStore.getState().setChannel('TEAMS_CHANNEL');
        useReminderStore.getState().openFlow();
        useReminderStore.getState().setTemplateId('tmpl-1');

        useReminderStore.getState().reset();

        const state = useReminderStore.getState();
        expect(state.selectedReviewers).toEqual([]);
        expect(state.flowOpen).toBe(false);
        expect(state.channel).toBe('TEAMS_DM');
        expect(state.templateId).toBeNull();
    });
});
