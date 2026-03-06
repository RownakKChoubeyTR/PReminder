'use client';

import { useCreateEmailMapping } from '@/hooks/use-email-mappings';
import { useReminderStore } from '@/hooks/use-reminder-store';
import { useSendReminders } from '@/hooks/use-reminders';
import { useTemplates } from '@/hooks/use-templates';
import { getSampleContext, renderTemplate } from '@/lib/templates/engine';
import type { ReminderChannel, SendReminderResult } from '@/types/reminders';
import type { MessageTemplate, TemplateContext } from '@/types/templates';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './reminder-flow-modal.module.scss';

// ─────────────────────────────────────────────────────────────
// Reminder Flow Modal — Multi-step send reminder experience
// Steps: Select Channel → Select Template → Preview → Send
// ─────────────────────────────────────────────────────────────

type FlowStep = 'channel' | 'template' | 'preview' | 'sending' | 'result';

const VISIBLE_STEPS: FlowStep[] = ['channel', 'template', 'preview'];
const STEP_LABELS: Record<string, string> = {
  channel: 'Channel',
  template: 'Template',
  preview: 'Preview',
};

const CHANNELS: {
  value: ReminderChannel;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'TEAMS_DM',
    label: 'Teams DM',
    description: 'Send a direct message via Power Automate',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    value: 'TEAMS_CHANNEL',
    label: 'Teams Channel',
    description: 'Post to a channel via Incoming Webhook',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export function ReminderFlowModal() {
  const {
    flowOpen,
    closeFlow,
    selectedReviewers,
    channel,
    setChannel,
    templateId,
    setTemplateId,
    prContext,
    clearReviewers,
  } = useReminderStore();
  const { data: session } = useSession();
  const { data: templatesData, isLoading: templatesLoading } = useTemplates();
  const sendMutation = useSendReminders();
  const createMapping = useCreateEmailMapping();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [step, setStep] = useState<FlowStep>('channel');
  const [result, setResult] = useState<SendReminderResult | null>(null);
  const [previewTabIndex, setPreviewTabIndex] = useState(0);
  const [pendingEmails, setPendingEmails] = useState<Record<string, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [isSavingEmails, setIsSavingEmails] = useState(false);

  // Derived: results that need a manual email mapping
  const missingEmailResults = result?.results.filter((r) => r.requiresEmailMapping) ?? [];
  // Only valid-format emails count — prevents Save & Retry on garbage input
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const hasValidPendingEmail = missingEmailResults.some((r) =>
    EMAIL_RE.test((pendingEmails[r.login] ?? '').trim()),
  );

  const templates = templatesData?.data ?? [];
  const selectedTemplate = templates.find((t: MessageTemplate) => t.id === templateId) ?? null;

  const eligibleRecipients = selectedReviewers;

  // Reset step when modal opens
  useEffect(() => {
    if (flowOpen) {
      setStep('channel');
      setResult(null);
      setPendingEmails({});
      setSaveErrors({});
    }
  }, [flowOpen]);

  // Reset preview tab when entering preview step
  useEffect(() => {
    if (step === 'preview') setPreviewTabIndex(0);
  }, [step]);

  const handleClose = useCallback(() => {
    clearReviewers();
    setTemplateId(null);
    closeFlow();
  }, [closeFlow, clearReviewers, setTemplateId]);

  // Focus trap & ESC key
  useEffect(() => {
    if (!flowOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    requestAnimationFrame(() => {
      modalRef.current?.querySelector<HTMLElement>('button')?.focus();
    });

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [flowOpen, handleClose]);

  const handleSend = async () => {
    if (!prContext || !templateId || eligibleRecipients.length === 0) return;

    setStep('sending');

    try {
      const sendResult = await sendMutation.mutateAsync({
        recipients: eligibleRecipients,
        pr: prContext,
        templateId,
        channel,
      });
      setResult(sendResult);
      setStep('result');
    } catch {
      // sendMutation.error is populated by TanStack Query
      setStep('result');
    }
  };

  const handleSaveAndRetry = async () => {
    if (!prContext || !templateId) return;

    // Client-side email validation — show inline errors before touching the API
    const filledEntries = missingEmailResults.filter(
      (r) => (pendingEmails[r.login] ?? '').trim().length > 0,
    );
    const validationErrors: Record<string, string> = {};
    for (const r of filledEntries) {
      if (!EMAIL_RE.test((pendingEmails[r.login] ?? '').trim())) {
        validationErrors[r.login] = 'Enter a valid email address';
      }
    }
    if (Object.keys(validationErrors).length > 0) {
      setSaveErrors(validationErrors);
      return;
    }

    setIsSavingEmails(true);
    setSaveErrors({});

    // Save mappings via the existing TanStack mutation (checks res.ok, throws on errors)
    const saveAttempts = await Promise.allSettled(
      filledEntries.map((r) =>
        createMapping.mutateAsync({
          githubUsername: r.login,
          email: (pendingEmails[r.login] ?? '').trim(),
          displayName: r.displayName ?? r.login,
        }),
      ),
    );

    const savedLogins: string[] = [];
    const newSaveErrors: Record<string, string> = {};
    saveAttempts.forEach((attempt, i) => {
      const entry = filledEntries[i];
      if (!entry) return;
      if (attempt.status === 'fulfilled') {
        savedLogins.push(entry.login);
      } else {
        // PromiseRejectedResult — reason is `any`
        const msg = attempt.reason instanceof Error ? attempt.reason.message : 'Failed to save';
        newSaveErrors[entry.login] = msg;
      }
    });

    if (Object.keys(newSaveErrors).length > 0) setSaveErrors(newSaveErrors);

    if (savedLogins.length === 0) {
      setIsSavingEmails(false);
      return;
    }

    // Clear only the successfully saved inputs; keep failed ones so user can correct
    setPendingEmails((prev) => {
      const next = { ...prev };
      savedLogins.forEach((login) => delete next[login]);
      return next;
    });

    try {
      const retryResult = await sendMutation.mutateAsync({
        recipients: savedLogins,
        pr: prContext,
        templateId,
        channel,
      });
      // Merge retry results — replaces old failing entries with new status
      setResult((prev) => {
        if (!prev) return retryResult;
        const retryMap = new Map(retryResult.results.map((r) => [r.login, r]));
        const merged = prev.results.map((r) => retryMap.get(r.login) ?? r);
        const sent = merged.filter((r) => r.status === 'SENT').length;
        return { total: merged.length, sent, failed: merged.length - sent, results: merged };
      });
    } catch {
      // sendMutation.error surfaces the error in the UI
    } finally {
      setIsSavingEmails(false);
    }
  };

  // Build preview context — uses real PR data and the active tab's recipient
  const previewRecipient =
    eligibleRecipients[previewTabIndex] ?? eligibleRecipients[0] ?? 'reviewer';
  const senderLogin = session?.user?.githubLogin ?? 'you';
  const senderName = session?.user?.name ?? senderLogin;
  const previewContext: TemplateContext = prContext
    ? {
        senderName,
        senderLogin,
        receiverName: previewRecipient,
        receiverLogin: previewRecipient,
        prTitle: prContext.title,
        prNumber: prContext.number,
        prUrl: prContext.url,
        prAge: prContext.age,
        repoName: prContext.repo,
        repoUrl: `https://github.com/${prContext.repo}`,
        reviewStatus: 'Pending',
        branchName: prContext.branch,
        targetBranch: prContext.targetBranch,
        labelList: prContext.labels.join(', '),
        prDescription: prContext.description.slice(0, 200),
        currentDate: new Date().toLocaleDateString(),
        currentTime: new Date().toLocaleTimeString(),
        orgName: process.env.NEXT_PUBLIC_GITHUB_ORG ?? '',
      }
    : getSampleContext();

  if (!flowOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={handleClose} aria-hidden="true" />

      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-flow-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div className={styles.modalContent} ref={modalRef}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h2 id="reminder-flow-title" className={styles.title}>
                Send Reminder
              </h2>
              <div className={styles.meta}>
                <span>
                  {selectedReviewers.length}{' '}
                  {selectedReviewers.length === 1 ? 'recipient' : 'recipients'}
                </span>
                {prContext && (
                  <>
                    <span className={styles.metaDot} />
                    <span>
                      #{prContext.number} {prContext.title}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={handleClose}
              aria-label="Close"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {/* Steps indicator */}
          <div className={styles.steps}>
            {VISIBLE_STEPS.map((s, i) => (
              <div
                key={s}
                className={`${styles.step} ${step === s ? styles.stepActive : ''} ${
                  VISIBLE_STEPS.indexOf(step as (typeof VISIBLE_STEPS)[number]) > i
                    ? styles.stepDone
                    : ''
                }`}
              >
                <span className={styles.stepNumber}>{i + 1}</span>
                <span className={styles.stepLabel}>{STEP_LABELS[s]}</span>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className={styles.body}>
            {/* Step 1: Channel Selection */}
            {step === 'channel' && (
              <div className={styles.channelGrid}>
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.value}
                    type="button"
                    className={`${styles.channelCard} ${channel === ch.value ? styles.channelActive : ''}`}
                    onClick={() => setChannel(ch.value)}
                  >
                    <div className={styles.channelIcon}>{ch.icon}</div>
                    <div className={styles.channelInfo}>
                      <span className={styles.channelLabel}>{ch.label}</span>
                      <span className={styles.channelDesc}>{ch.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Template Selection */}
            {step === 'template' && (
              <div className={styles.templateList}>
                {templatesLoading && <div className={styles.loading}>Loading templates\u2026</div>}
                {!templatesLoading && templates.length === 0 && (
                  <div className={styles.emptyTemplates}>
                    <p>No templates found. Create one from the Templates page first.</p>
                  </div>
                )}
                {templates
                  .filter((t: MessageTemplate) => t.type === channel)
                  .map((t: MessageTemplate) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.templateCard} ${templateId === t.id ? styles.templateActive : ''}`}
                      onClick={() => setTemplateId(t.id)}
                    >
                      <div className={styles.templateName}>
                        {t.name}
                        {t.isDefault && <span className={styles.defaultBadge}>Default</span>}
                      </div>
                      <div className={styles.templateBody}>
                        {t.body.slice(0, 100)}
                        {t.body.length > 100 ? '\u2026' : ''}
                      </div>
                    </button>
                  ))}
                {/* Show all templates if channel-specific ones are empty */}
                {templates.filter((t: MessageTemplate) => t.type === channel).length === 0 &&
                  templates.length > 0 && (
                    <div className={styles.allTemplatesNote}>
                      <p>No templates for this channel. Showing all templates:</p>
                      {templates.map((t: MessageTemplate) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`${styles.templateCard} ${templateId === t.id ? styles.templateActive : ''}`}
                          onClick={() => setTemplateId(t.id)}
                        >
                          <div className={styles.templateName}>{t.name}</div>
                          <div className={styles.templateBody}>
                            {t.body.slice(0, 100)}
                            {t.body.length > 100 ? '\u2026' : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Step 3: Preview */}
            {step === 'preview' && selectedTemplate && (
              <div className={styles.previewSection}>
                <div className={styles.previewMeta}>
                  <div className={styles.previewRow}>
                    <span className={styles.previewLabel}>Channel</span>
                    <span className={styles.previewValue}>
                      {CHANNELS.find((c) => c.value === channel)?.label}
                    </span>
                  </div>
                  <div className={styles.previewRow}>
                    <span className={styles.previewLabel}>Template</span>
                    <span className={styles.previewValue}>{selectedTemplate.name}</span>
                  </div>
                  <div className={styles.previewRow}>
                    <span className={styles.previewLabel}>Recipients</span>
                    <span className={styles.previewValue}>{eligibleRecipients.join(', ')}</span>
                  </div>
                </div>

                <div className={styles.previewBox}>
                  <div className={styles.previewBoxHeader}>
                    {eligibleRecipients.length > 1 ? (
                      <div className={styles.previewTabs}>
                        {eligibleRecipients.map((login, i) => (
                          <button
                            key={login}
                            type="button"
                            className={`${styles.previewTab} ${previewTabIndex === i ? styles.previewTabActive : ''}`}
                            onClick={() => setPreviewTabIndex(i)}
                          >
                            @{login}
                          </button>
                        ))}
                      </div>
                    ) : (
                      'Message Preview'
                    )}
                  </div>
                  <div
                    className={styles.previewBoxBody}
                    // Escape template body first (user-authored — may contain HTML),
                    // then escape substituted values, then apply safe br/link transforms.
                    dangerouslySetInnerHTML={{
                      __html: renderTemplate(
                        selectedTemplate.body
                          .replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;')
                          .replace(/'/g, '&#39;'),
                        previewContext,
                        { escapeHtml: true },
                      )
                        .replace(/\n/g, '<br>')
                        .replace(
                          /(https?:\/\/[^\s<>"']+)/g,
                          '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
                        ),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sending state */}
            {step === 'sending' && (
              <div className={styles.sendingState}>
                <div className={styles.spinner} />
                <p>Sending reminders\u2026</p>
              </div>
            )}

            {/* Result state */}
            {step === 'result' && (
              <div className={styles.resultState}>
                {result ? (
                  <>
                    <div
                      className={`${styles.resultSummary} ${result.failed > 0 ? styles.hasFailures : ''}`}
                    >
                      <div className={styles.resultStat}>
                        <span className={styles.resultNumber}>{result.sent}</span>
                        <span className={styles.resultLabel}>Sent</span>
                      </div>
                      {result.failed > 0 && (
                        <div className={styles.resultStat}>
                          <span className={`${styles.resultNumber} ${styles.failedNumber}`}>
                            {result.failed}
                          </span>
                          <span className={styles.resultLabel}>Failed</span>
                        </div>
                      )}
                    </div>

                    {/* Sent / non-mapping failures */}
                    <div className={styles.resultList}>
                      {result.results
                        .filter((r) => !r.requiresEmailMapping)
                        .map((r) => (
                          <div
                            key={r.login}
                            className={`${styles.resultItem} ${r.status === 'SENT' ? styles.resultSuccess : styles.resultFailed}`}
                          >
                            <span className={styles.resultLogin}>@{r.login}</span>
                            <span className={styles.resultStatus}>
                              {r.status === 'SENT'
                                ? '\u2713 Sent'
                                : `\u2717 ${r.error ?? 'Failed'}`}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Inline missing-email resolution */}
                    {missingEmailResults.length > 0 && (
                      <div className={styles.missingEmailSection}>
                        <div className={styles.missingEmailHeader}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4" />
                            <path d="M12 16h.01" />
                          </svg>
                          <div>
                            <p className={styles.missingEmailTitle}>Email address not found</p>
                            <p className={styles.missingEmailSubtitle}>
                              Enter emails below to send the reminder and save for future use.
                            </p>
                          </div>
                        </div>

                        <div className={styles.missingEmailList}>
                          {missingEmailResults.map((r) => (
                            <div
                              key={r.login}
                              className={`${styles.missingEmailRow} ${saveErrors[r.login] ? styles.missingEmailRowError : ''}`}
                            >
                              {/* Avatar */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://avatars.githubusercontent.com/${r.login}?s=40`}
                                alt={`@${r.login}`}
                                width={36}
                                height={36}
                                className={styles.missingEmailAvatar}
                              />
                              <div className={styles.missingEmailInfo}>
                                <span className={styles.missingEmailLogin}>
                                  {r.displayName ?? r.login}
                                </span>
                                <span className={styles.missingEmailGithub}>@{r.login}</span>
                              </div>
                              <div className={styles.missingEmailInputWrapper}>
                                <input
                                  type="email"
                                  className={`${styles.missingEmailInput} ${saveErrors[r.login] ? styles.inputError : ''}`}
                                  placeholder="email@company.com"
                                  value={pendingEmails[r.login] ?? ''}
                                  onChange={(e) => {
                                    setPendingEmails((prev) => ({
                                      ...prev,
                                      [r.login]: e.target.value,
                                    }));
                                    if (saveErrors[r.login]) {
                                      setSaveErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[r.login];
                                        return next;
                                      });
                                    }
                                  }}
                                  aria-label={`Email for ${r.login}`}
                                  aria-describedby={
                                    saveErrors[r.login] ? `save-err-${r.login}` : undefined
                                  }
                                />
                                {saveErrors[r.login] && (
                                  <span
                                    id={`save-err-${r.login}`}
                                    className={styles.missingEmailSaveError}
                                    role="alert"
                                  >
                                    {saveErrors[r.login]}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.errorResult} role="alert">
                    <p>
                      {sendMutation.error?.message ?? 'Failed to send reminders. Please try again.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            {step === 'channel' && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setStep('template')}
              >
                Next: Select Template
              </button>
            )}
            {step === 'template' && (
              <>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setStep('channel')}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setStep('preview')}
                  disabled={!templateId}
                >
                  Next: Preview
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setStep('template')}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleSend}
                  disabled={eligibleRecipients.length === 0}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m22 2-7 20-4-9-9-4z" />
                    <path d="M22 2 11 13" />
                  </svg>
                  Send {eligibleRecipients.length}{' '}
                  {eligibleRecipients.length === 1 ? 'Reminder' : 'Reminders'}
                </button>
              </>
            )}
            {step === 'result' && (
              <>
                {missingEmailResults.length > 0 && hasValidPendingEmail && (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleSaveAndRetry}
                    disabled={isSavingEmails}
                  >
                    {isSavingEmails ? (
                      <>
                        <span className={styles.buttonSpinner} aria-hidden="true" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m22 2-7 20-4-9-9-4z" />
                          <path d="M22 2 11 13" />
                        </svg>
                        Save &amp; Retry
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  className={
                    missingEmailResults.length > 0 && hasValidPendingEmail
                      ? styles.secondaryButton
                      : styles.primaryButton
                  }
                  onClick={handleClose}
                >
                  {missingEmailResults.length > 0 ? 'Skip & Close' : 'Done'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
