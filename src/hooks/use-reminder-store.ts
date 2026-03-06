import type { ReminderChannel } from '@/types/reminders';
import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
// Reminder Store — Zustand
// ─────────────────────────────────────────────────────────────
// Manages state for the reminder send flow: selected reviewers,
// chosen channel/template, and flow modal visibility.

interface ReminderFlowState {
  /** GitHub logins of reviewers selected for reminding. */
  selectedReviewers: string[];
  /** Whether the reminder flow modal is open. */
  flowOpen: boolean;
  /** Chosen delivery channel. */
  channel: ReminderChannel;
  /** Chosen template ID. */
  templateId: string | null;
  /** PR context for the current reminder flow. */
  prContext: {
    number: number;
    title: string;
    url: string;
    repo: string;
    branch: string;
    targetBranch: string;
    age: number;
    labels: string[];
    description: string;
  } | null;

  // Actions
  toggleReviewer: (login: string) => void;
  selectAllReviewers: (logins: string[]) => void;
  deselectReviewers: (logins: string[]) => void;
  clearReviewers: () => void;
  openFlow: () => void;
  closeFlow: () => void;
  setChannel: (channel: ReminderChannel) => void;
  setTemplateId: (id: string | null) => void;
  setPrContext: (ctx: ReminderFlowState['prContext']) => void;
  reset: () => void;
}

const initialState = {
  selectedReviewers: [] as string[],
  flowOpen: false,
  channel: 'TEAMS_DM' as ReminderChannel,
  templateId: null as string | null,
  prContext: null as ReminderFlowState['prContext'],
};

export const useReminderStore = create<ReminderFlowState>((set) => ({
  ...initialState,

  toggleReviewer: (login) =>
    set((s) => ({
      selectedReviewers: s.selectedReviewers.includes(login)
        ? s.selectedReviewers.filter((l) => l !== login)
        : [...s.selectedReviewers, login],
    })),

  selectAllReviewers: (logins) =>
    set((s) => {
      const existing = new Set(s.selectedReviewers);
      for (const login of logins) existing.add(login);
      return { selectedReviewers: Array.from(existing) };
    }),

  deselectReviewers: (logins) =>
    set((s) => {
      const toRemove = new Set(logins);
      return { selectedReviewers: s.selectedReviewers.filter((l) => !toRemove.has(l)) };
    }),

  clearReviewers: () => set({ selectedReviewers: [] }),

  openFlow: () => set({ flowOpen: true }),

  closeFlow: () => set({ flowOpen: false }),

  setChannel: (channel) => set({ channel }),

  setTemplateId: (id) => set({ templateId: id }),

  setPrContext: (ctx) => set({ prContext: ctx }),

  reset: () => set(initialState),
}));
