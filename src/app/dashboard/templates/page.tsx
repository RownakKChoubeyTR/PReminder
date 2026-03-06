'use client';

import { TemplateForm } from '@/components/settings/template-form';
import { TemplateList } from '@/components/settings/template-list';
import { TemplatePreview } from '@/components/settings/template-preview';
import type { MessageTemplate, TemplateType } from '@/types/templates';
import { useCallback, useState } from 'react';
import styles from './page.module.scss';

// ─────────────────────────────────────────────────────────────
// Template Editor Page — CRUD with live preview
// ─────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [selected, setSelected] = useState<MessageTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Live form state for preview
  const [liveBody, setLiveBody] = useState('');
  const [liveSubject, setLiveSubject] = useState('');
  const [liveType, setLiveType] = useState<TemplateType>('TEAMS_DM');

  const showForm = isCreating || !!selected;

  const handleSelect = (template: MessageTemplate) => {
    setSelected(template);
    setIsCreating(false);
    setLiveBody(template.body);
    setLiveSubject(template.subject ?? '');
    setLiveType(template.type);
  };

  const handleCreateNew = () => {
    setSelected(null);
    setIsCreating(true);
    setLiveBody('');
    setLiveSubject('');
    setLiveType('TEAMS_DM');
  };

  const handleSaved = () => {
    setSelected(null);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setSelected(null);
    setIsCreating(false);
  };

  const handleFormChange = useCallback((body: string, subject: string, type: TemplateType) => {
    setLiveBody(body);
    setLiveSubject(subject);
    setLiveType(type);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Message Templates</h1>
        <p className={styles.pageDescription}>
          Create and customize reminder templates for Teams, email, and channel messages. Use
          variables like <code>{'{receiverName}'}</code> and <code>{'{prTitle}'}</code> for dynamic
          content.
        </p>
      </div>

      <div className={styles.layout}>
        {/* Left panel — Template list */}
        <div className={styles.sidebar}>
          <TemplateList
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            onCreateNew={handleCreateNew}
          />
        </div>

        {/* Right panel — Form + Preview */}
        <div className={styles.main}>
          {showForm ? (
            <div className={styles.editorLayout}>
              <div className={styles.formPanel}>
                <TemplateForm
                  template={selected}
                  onSaved={handleSaved}
                  onCancel={handleCancel}
                  onFormChange={handleFormChange}
                />
              </div>
              <div className={styles.previewPanel}>
                <TemplatePreview
                  body={liveBody}
                  subject={liveSubject || undefined}
                  type={liveType}
                />
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
                <line x1="10" x2="8" y1="9" y2="9" />
              </svg>
              <h2>Select or create a template</h2>
              <p>Choose an existing template from the list to edit, or create a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
