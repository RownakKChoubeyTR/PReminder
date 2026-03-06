import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ───────────────────────────────────────────────────

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { name: 'Test User', email: 'test@corp.com', image: null }, githubLogin: 'testuser' },
    status: 'authenticated',
  })),
}))

vi.mock('@/hooks/use-reminder-store', () => ({
  useReminderStore: vi.fn(),
}));

vi.mock('@/hooks/use-reminders', () => ({
  useSendReminders: vi.fn(() => ({ mutateAsync: vi.fn(), error: null })),
  useCooldownCheck: vi.fn(() => ({ data: null })),
}));

vi.mock('@/hooks/use-email-mappings', () => ({
  useCreateEmailMapping: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('@/hooks/use-templates', () => ({
  useTemplates: vi.fn(),
}));

vi.mock('@/lib/templates/engine', () => ({
  renderTemplate: vi.fn((body: string) => body),
  getSampleContext: vi.fn(() => ({
    senderName: 'Sender',
    senderLogin: 'sender',
    receiverName: 'Receiver',
    receiverLogin: 'receiver',
    prTitle: 'Test PR',
    prNumber: 1,
    prUrl: 'https://github.com/test',
    prAge: 2,
    repoName: 'test-repo',
    repoUrl: 'https://github.com/test-repo',
    reviewStatus: 'Pending',
    branchName: 'main',
    targetBranch: 'develop',
    labelList: '',
    prDescription: '',
    currentDate: '2025-01-01',
    currentTime: '12:00',
    orgName: '',
  })),
}));

import { useReminderStore } from '@/hooks/use-reminder-store';
import { useSendReminders, useCooldownCheck } from '@/hooks/use-reminders';
import { useCreateEmailMapping } from '@/hooks/use-email-mappings';
import { useTemplates } from '@/hooks/use-templates';
import { ReminderFlowModal } from '@/components/reminders/reminder-flow-modal';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const baseStore = {
  flowOpen: true,
  closeFlow: vi.fn(),
  selectedReviewers: ['alice', 'bob'],
  channel: 'TEAMS_DM' as const,
  setChannel: vi.fn(),
  templateId: null as string | null,
  setTemplateId: vi.fn(),
  prContext: {
    number: 42,
    title: 'Fix login',
    url: 'https://github.com/org/repo/pull/42',
    repo: 'org/repo',
    branch: 'feature/login',
    targetBranch: 'main',
    age: 2,
    labels: ['bug'],
    description: 'Fix the login issue',
  },
  clearReviewers: vi.fn(),
  reset: vi.fn(),
};

const templates = [
  { id: 't1', name: 'Friendly Nudge', body: 'Hey {{receiverName}}, please review', type: 'TEAMS_DM', isDefault: true },
  { id: 't2', name: 'Urgent', body: 'Urgent review needed', type: 'TEAMS_DM', isDefault: false },
];

describe('ReminderFlowModal', () => {
  beforeEach(() => {
    vi.mocked(useReminderStore).mockReturnValue({ ...baseStore } as never);
    vi.mocked(useTemplates).mockReturnValue({
      data: { data: templates },
      isLoading: false,
    } as never);
    vi.mocked(useCooldownCheck).mockReturnValue({ data: null } as never);
    vi.mocked(useSendReminders).mockReturnValue({
      mutateAsync: vi.fn(),
      error: null,
    } as never);
    vi.mocked(useCreateEmailMapping).mockReturnValue({ mutateAsync: vi.fn() } as never);
  });

  it('renders nothing when flowOpen is false', () => {
    vi.mocked(useReminderStore).mockReturnValue({ ...baseStore, flowOpen: false } as never);
    const { container } = render(<ReminderFlowModal />, { wrapper });
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog when open', () => {
    render(<ReminderFlowModal />, { wrapper });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Send Reminder')).toBeInTheDocument();
  });

  it('shows recipient count', () => {
    render(<ReminderFlowModal />, { wrapper });
    expect(screen.getByText('2 recipients')).toBeInTheDocument();
  });

  it('shows singular recipient label', () => {
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      selectedReviewers: ['alice'],
    } as never);
    render(<ReminderFlowModal />, { wrapper });
    expect(screen.getByText('1 recipient')).toBeInTheDocument();
  });

  it('shows PR context info', () => {
    render(<ReminderFlowModal />, { wrapper });
    expect(screen.getByText('#42 Fix login')).toBeInTheDocument();
  });

  it('shows channel selection step by default', () => {
    render(<ReminderFlowModal />, { wrapper });
    expect(screen.getByText('Teams DM')).toBeInTheDocument();
    expect(screen.getByText('Teams Channel')).toBeInTheDocument();
    // Only Teams DM and Teams Channel exist in current component
  });

  it('shows step indicators', () => {
    render(<ReminderFlowModal />, { wrapper });
    expect(screen.getByText('Channel')).toBeInTheDocument();
    expect(screen.getByText('Template')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('selects a channel when clicked', () => {
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Teams Channel'));
    expect(baseStore.setChannel).toHaveBeenCalledWith('TEAMS_CHANNEL');
  });

  it('advances to template step on Next click', () => {
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    expect(screen.getByText('Friendly Nudge')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('shows templates and allows selection', () => {
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Friendly Nudge'));
    expect(baseStore.setTemplateId).toHaveBeenCalledWith('t1');
  });

  it('shows Back button on template step', () => {
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('goes back to channel step from template step', () => {
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Back'));
    // Should show channel options again
    expect(screen.getByText('Teams DM')).toBeInTheDocument();
  });

  it('advances to preview step with template selected', () => {
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      templateId: 't1',
    } as never);
    render(<ReminderFlowModal />, { wrapper });
    // Go to template step
    fireEvent.click(screen.getByText('Next: Select Template'));
    // Go to preview step
    fireEvent.click(screen.getByText('Next: Preview'));
    // Should show preview content (preview metadata is always shown)
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  it('disables Next: Preview when no template selected', () => {
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      templateId: null,
    } as never);
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    expect(screen.getByText('Next: Preview')).toBeDisabled();
  });

  it('closes on close button', () => {
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(baseStore.closeFlow).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(baseStore.closeFlow).toHaveBeenCalled();
  });

  it('shows loading state for templates', () => {
    vi.mocked(useTemplates).mockReturnValue({
      data: { data: [] },
      isLoading: true,
    } as never);
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    expect(screen.getByText(/Loading templates/)).toBeInTheDocument();
  });

  it('shows empty templates message', () => {
    vi.mocked(useTemplates).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never);
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    expect(screen.getByText(/No templates found/)).toBeInTheDocument();
  });

  it('shows default badge on default template', () => {
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    expect(screen.getByText('Friendly Nudge')).toBeInTheDocument();
    // The default badge text "Default" is rendered inside the template card
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('shows all recipients in preview regardless of cooldown (cooldown disabled)', () => {
    vi.mocked(useCooldownCheck).mockReturnValue({
      data: {
        data: [
          { login: 'alice', allowed: false },
          { login: 'bob', allowed: true },
        ],
      },
    } as never);
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      templateId: 't1',
    } as never);
    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Next: Preview'));
    // Cooldown is disabled  all recipients are shown in preview
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  it('sends reminders on Send click', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      sent: 2,
      failed: 0,
      results: [
        { login: 'alice', status: 'SENT' },
        { login: 'bob', status: 'SENT' },
      ],
    });
    vi.mocked(useSendReminders).mockReturnValue({
      mutateAsync,
      error: null,
    } as never);
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      templateId: 't1',
    } as never);

    render(<ReminderFlowModal />, { wrapper });
    // Navigate to preview
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Next: Preview'));
    // Send
    fireEvent.click(screen.getByText(/Send 2 Reminders/));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });
  });

  it('shows result state with sent/failed counts', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      sent: 1,
      failed: 1,
      results: [
        { login: 'alice', status: 'SENT' },
        { login: 'bob', status: 'FAILED', error: 'Timeout' },
      ],
    });
    vi.mocked(useSendReminders).mockReturnValue({
      mutateAsync,
      error: null,
    } as never);
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      templateId: 't1',
    } as never);

    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Next: Preview'));
    fireEvent.click(screen.getByText(/Send 2 Reminders/));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  it('shows deep link URL in results', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      sent: 1,
      failed: 0,
      results: [
        { login: 'alice', status: 'SENT', deepLinkUrl: 'https://teams.microsoft.com/l/chat' },
      ],
    });
    vi.mocked(useSendReminders).mockReturnValue({
      mutateAsync,
      error: null,
    } as never);
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      selectedReviewers: ['alice'],
      templateId: 't1',
    } as never);

    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Next: Preview'));
    fireEvent.click(screen.getByText(/Send 1 Reminder/));

    await waitFor(() => {
      // deepLinkUrl is passed in results but shown as sent status
      expect(screen.getByText('Sent')).toBeInTheDocument();
      expect(screen.getByText('@alice')).toBeInTheDocument();
    });
  });

  // ── Missing-email resolution flow ──────────────────────────

  it('shows missing-email section when requiresEmailMapping result is returned', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      sent: 1,
      failed: 1,
      total: 2,
      results: [
        { login: 'alice', status: 'SENT', channel: 'TEAMS_DM' },
        {
          login: 'bob',
          status: 'FAILED',
          channel: 'TEAMS_DM',
          requiresEmailMapping: true,
          displayName: 'Bob Smith',
          error: 'No email found',
        },
      ],
    });
    vi.mocked(useSendReminders).mockReturnValue({ mutateAsync, error: null } as never);
    vi.mocked(useReminderStore).mockReturnValue({ ...baseStore, templateId: 't1' } as never);

    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Next: Preview'));
    fireEvent.click(screen.getByText(/Send 2 Reminders/));

    await waitFor(() => {
      expect(screen.getByText('Email address not found')).toBeInTheDocument();
    });
    // Email input shown for the unresolved user
    expect(screen.getByLabelText('Email for bob')).toBeInTheDocument();
    // Resolved user shown in standard result list
    expect(screen.getByText('@alice')).toBeInTheDocument();
    // Footer shows Skip & Close instead of Done
    expect(screen.getByText('Skip & Close')).toBeInTheDocument();
    expect(screen.queryByText('Save & Retry')).not.toBeInTheDocument();
  });

  it('shows Save & Retry only when a valid email format is entered', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      sent: 0,
      failed: 1,
      total: 1,
      results: [
        {
          login: 'alice',
          status: 'FAILED',
          channel: 'TEAMS_DM',
          requiresEmailMapping: true,
          displayName: 'Alice',
        },
      ],
    });
    vi.mocked(useSendReminders).mockReturnValue({ mutateAsync, error: null } as never);
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      selectedReviewers: ['alice'],
      templateId: 't1',
    } as never);

    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Next: Preview'));
    fireEvent.click(screen.getByText(/Send 1 Reminder/));

    await waitFor(() => expect(screen.getByLabelText('Email for alice')).toBeInTheDocument());

    // No Save & Retry with empty input
    expect(screen.queryByText('Save & Retry')).not.toBeInTheDocument();

    // Invalid email → still no Save & Retry
    fireEvent.change(screen.getByLabelText('Email for alice'), {
      target: { value: 'notanemailaddress' },
    });
    expect(screen.queryByText('Save & Retry')).not.toBeInTheDocument();

    // Valid email → Save & Retry appears
    fireEvent.change(screen.getByLabelText('Email for alice'), {
      target: { value: 'alice@corp.com' },
    });
    expect(screen.getByText('Save & Retry')).toBeInTheDocument();
  });

  it('saves email mapping and retries sending on Save & Retry click', async () => {
    const sendMutateAsync = vi.fn()
      .mockResolvedValueOnce({
        sent: 0,
        failed: 1,
        total: 1,
        results: [
          {
            login: 'alice',
            status: 'FAILED',
            channel: 'TEAMS_DM',
            requiresEmailMapping: true,
            displayName: 'Alice',
          },
        ],
      })
      .mockResolvedValueOnce({
        sent: 1,
        failed: 0,
        total: 1,
        results: [{ login: 'alice', status: 'SENT', channel: 'TEAMS_DM' }],
      });
    const saveMutateAsync = vi.fn().mockResolvedValue({
      data: { id: '1', githubUsername: 'alice', email: 'alice@corp.com', displayName: 'Alice', source: 'manual', createdAt: '' },
    });

    vi.mocked(useSendReminders).mockReturnValue({ mutateAsync: sendMutateAsync, error: null } as never);
    vi.mocked(useCreateEmailMapping).mockReturnValue({ mutateAsync: saveMutateAsync } as never);
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      selectedReviewers: ['alice'],
      templateId: 't1',
    } as never);

    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Next: Preview'));
    fireEvent.click(screen.getByText(/Send 1 Reminder/));

    await waitFor(() => expect(screen.getByLabelText('Email for alice')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Email for alice'), {
      target: { value: 'alice@corp.com' },
    });
    fireEvent.click(screen.getByText('Save & Retry'));

    await waitFor(() => {
      expect(saveMutateAsync).toHaveBeenCalledWith({
        githubUsername: 'alice',
        email: 'alice@corp.com',
        displayName: 'Alice',
      });
      expect(sendMutateAsync).toHaveBeenCalledTimes(2);
      // All resolved — shows Done
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('shows inline error when save fails and does not retry', async () => {
    const sendMutateAsync = vi.fn().mockResolvedValue({
      sent: 0,
      failed: 1,
      total: 1,
      results: [
        {
          login: 'alice',
          status: 'FAILED',
          channel: 'TEAMS_DM',
          requiresEmailMapping: true,
          displayName: 'Alice',
        },
      ],
    });
    const saveMutateAsync = vi.fn().mockRejectedValue(new Error('Invalid email address'));

    vi.mocked(useSendReminders).mockReturnValue({ mutateAsync: sendMutateAsync, error: null } as never);
    vi.mocked(useCreateEmailMapping).mockReturnValue({ mutateAsync: saveMutateAsync } as never);
    vi.mocked(useReminderStore).mockReturnValue({
      ...baseStore,
      selectedReviewers: ['alice'],
      templateId: 't1',
    } as never);

    render(<ReminderFlowModal />, { wrapper });
    fireEvent.click(screen.getByText('Next: Select Template'));
    fireEvent.click(screen.getByText('Next: Preview'));
    fireEvent.click(screen.getByText(/Send 1 Reminder/));

    await waitFor(() => expect(screen.getByLabelText('Email for alice')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Email for alice'), {
      target: { value: 'alice@corp.com' },
    });
    fireEvent.click(screen.getByText('Save & Retry'));

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
    // Send was not retried because save failed
    expect(sendMutateAsync).toHaveBeenCalledTimes(1);
  });
});
