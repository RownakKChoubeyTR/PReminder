'use client';

import { renderTemplate, getSampleContext } from '@/lib/templates/engine';
import { useMemo } from 'react';
import styles from './template-preview.module.scss';

// ─────────────────────────────────────────────────────────────
// Template Preview — Live rendered preview of a template
// ─────────────────────────────────────────────────────────────

interface TemplatePreviewProps {
  body: string;
  subject?: string;
  type: 'TEAMS_DM' | 'TEAMS_CHANNEL' | 'EMAIL';
}

const TYPE_LABELS = {
  TEAMS_DM: 'Teams Direct Message',
  TEAMS_CHANNEL: 'Teams Channel Message',
  EMAIL: 'Email Message',
};

export function TemplatePreview({ body, subject, type }: TemplatePreviewProps) {
  const rendered = useMemo(() => {
    const context = getSampleContext();
    return {
      body: body ? renderTemplate(body, context) : '',
      subject: subject ? renderTemplate(subject, context) : '',
    };
  }, [body, subject]);

  if (!body.trim()) {
    return (
      <div className={styles.empty}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <p>Start typing to see a live preview</p>
      </div>
    );
  }

  return (
    <div className={styles.preview}>
      <div className={styles.header}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>Preview — {TYPE_LABELS[type]}</span>
      </div>

      <div className={styles.content}>
        {/* Subject line for email */}
        {type === 'EMAIL' && rendered.subject && (
          <div className={styles.subject}>
            <span className={styles.subjectLabel}>Subject:</span>
            <span className={styles.subjectText}>{rendered.subject}</span>
          </div>
        )}

        {/* Rendered body */}
        <div className={styles.body}>
          {rendered.body.split('\n').map((line, i) => (
            <p key={i}>{line || '\u00A0'}</p>
          ))}
        </div>
      </div>

      <div className={styles.sampleNote}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        Rendered with sample data
      </div>
    </div>
  );
}
