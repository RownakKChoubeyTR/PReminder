'use client';

import { useDeleteTemplate, useTemplates } from '@/hooks/use-templates';
import type { MessageTemplate, TemplateType } from '@/types/templates';
import styles from './template-list.module.scss';

// ─────────────────────────────────────────────────────────────
// Template List — Displays user's message templates as cards
// ─────────────────────────────────────────────────────────────

interface TemplateListProps {
  selectedId: string | null;
  onSelect: (template: MessageTemplate) => void;
  onCreateNew: () => void;
}

const TYPE_LABELS: Record<TemplateType, string> = {
  TEAMS_DM: 'Teams DM',
  TEAMS_CHANNEL: 'Teams Channel',
  EMAIL: 'Email',
};

const TYPE_ICONS: Record<TemplateType, React.ReactNode> = {
  TEAMS_DM: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  TEAMS_CHANNEL: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  EMAIL: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
};

export function TemplateList({ selectedId, onSelect, onCreateNew }: TemplateListProps) {
  const { data, isLoading, error, refetch } = useTemplates();
  const deleteMutation = useDeleteTemplate();

  const templates = data?.data ?? [];

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.list} role="status" aria-label="Loading templates">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error} role="alert">
        <p>Failed to load templates</p>
        <button type="button" className={styles.retryButton} onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {/* Create new button */}
      <button type="button" className={styles.createButton} onClick={onCreateNew}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <span>New Template</span>
      </button>

      {/* Delete error feedback */}
      {deleteMutation.error && (
        <div className={styles.error} role="alert">
          <p>{deleteMutation.error.message}</p>
        </div>
      )}

      {/* Template cards */}
      {templates.map((template: MessageTemplate) => (
        <div
          key={template.id}
          role="button"
          tabIndex={0}
          className={`${styles.card} ${selectedId === template.id ? styles.active : ''}`}
          onClick={() => onSelect(template)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(template);
            }
          }}
          aria-pressed={selectedId === template.id}
        >
          <div className={styles.cardIcon}>{TYPE_ICONS[template.type]}</div>
          <div className={styles.cardContent}>
            <div className={styles.cardHeader}>
              <span className={styles.cardName}>{template.name}</span>
              {template.isDefault && <span className={styles.defaultBadge}>Default</span>}
            </div>
            <span className={styles.cardType}>{TYPE_LABELS[template.type]}</span>
          </div>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={(e) => handleDelete(e, template.id)}
            aria-label={`Delete ${template.name}`}
            disabled={deleteMutation.isPending}
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
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      ))}

      {/* Empty state */}
      {templates.length === 0 && (
        <div className={styles.empty}>
          <p>No templates yet. Create your first template to get started.</p>
        </div>
      )}
    </div>
  );
}
