// ─────────────────────────────────────────────────────────────
// Reminder Type Definitions
// ─────────────────────────────────────────────────────────────

/** Delivery channel for a reminder. */
export type ReminderChannel = 'TEAMS_DM' | 'TEAMS_CHANNEL';

/** Delivery status. */
export type ReminderStatus = 'SENT' | 'FAILED' | 'PENDING';

/** Reminder log record matching Prisma schema. */
export interface ReminderLog {
  id: string;
  senderId: string;
  recipientGithubLogin: string;
  recipientEmail: string | null;
  prNumber: number;
  prUrl: string;
  repoName: string;
  channel: ReminderChannel;
  templateId: string | null;
  messageBody: string;
  status: ReminderStatus;
  errorMessage: string | null;
  sentAt: Date;
}

/** Payload to send one or more reminders. */
export interface SendReminderPayload {
  /** GitHub logins of selected reviewers. */
  recipients: string[];
  /** PR metadata. */
  pr: {
    number: number;
    title: string;
    url: string;
    repo: string;
    branch: string;
    targetBranch: string;
    age: number;
    labels: string[];
    description: string;
  };
  /** Selected template ID. */
  templateId: string;
  /** Delivery channel. */
  channel: ReminderChannel;
}

/** Response after sending reminders. */
export interface SendReminderResult {
  total: number;
  sent: number;
  failed: number;
  results: SingleReminderResult[];
}

/** Per-recipient result. */
export interface SingleReminderResult {
  login: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  error?: string;
  /** True when the failure is specifically due to a missing email mapping. */
  requiresEmailMapping?: boolean;
  /** Display name fetched during resolution (for UI). */
  displayName?: string | null;
}

/** Anti-spam cooldown check result. */
export interface CooldownCheck {
  allowed: boolean;
  /** Seconds remaining until the next reminder is allowed. */
  remainingSeconds: number;
  lastSentAt: Date | null;
}
