'use client';

import { useCreateTemplate, useUpdateTemplate } from '@/hooks/use-templates';
import { extractVariables, validateTemplate } from '@/lib/templates/engine';
import type { MessageTemplate, TemplateInput, TemplateType, TemplateVariable } from '@/types/templates';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './template-form.module.scss';

// ─────────────────────────────────────────────────────────────
// Template Form — Create/Edit with variable pills
// ─────────────────────────────────────────────────────────────

interface TemplateFormProps {
    template: MessageTemplate | null;
    onSaved: () => void;
    onCancel: () => void;
    /** Called on every form field change for live preview */
    onFormChange?: (body: string, subject: string, type: TemplateType) => void;
}

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
    { value: 'TEAMS_DM', label: 'Teams DM' },
    { value: 'TEAMS_CHANNEL', label: 'Teams Channel' },
    { value: 'EMAIL', label: 'Email' }
];

const AVAILABLE_VARIABLES: { name: TemplateVariable; description: string }[] = [
    { name: 'receiverName', description: 'Reviewer display name' },
    { name: 'receiverLogin', description: 'Reviewer GitHub login' },
    { name: 'senderName', description: 'Your display name' },
    { name: 'senderLogin', description: 'Your GitHub login' },
    { name: 'prTitle', description: 'Pull request title' },
    { name: 'prNumber', description: 'PR number' },
    { name: 'prUrl', description: 'Link to the PR' },
    { name: 'prAge', description: 'PR age in days' },
    { name: 'repoName', description: 'Repository name' },
    { name: 'repoUrl', description: 'Repository URL' },
    { name: 'reviewStatus', description: 'Current review status' },
    { name: 'branchName', description: 'Source branch' },
    { name: 'targetBranch', description: 'Target branch' },
    { name: 'labelList', description: 'Comma-separated labels' },
    { name: 'prDescription', description: 'PR description excerpt' },
    { name: 'currentDate', description: "Today's date" },
    { name: 'currentTime', description: 'Current time' },
    { name: 'orgName', description: 'Organization name' }
];

export function TemplateForm({ template, onSaved, onCancel, onFormChange }: TemplateFormProps) {
    const createMutation = useCreateTemplate();
    const updateMutation = useUpdateTemplate();
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    const isEditing = !!template;

    const [name, setName] = useState(template?.name ?? '');
    const [type, setType] = useState<TemplateType>(template?.type ?? 'TEAMS_DM');
    const [subject, setSubject] = useState(template?.subject ?? '');
    const [body, setBody] = useState(template?.body ?? '');
    const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
    const [errors, setErrors] = useState<string[]>([]);

    // Reset form when template changes
    useEffect(() => {
        setName(template?.name ?? '');
        setType(template?.type ?? 'TEAMS_DM');
        setSubject(template?.subject ?? '');
        setBody(template?.body ?? '');
        setIsDefault(template?.isDefault ?? false);
        setErrors([]);
    }, [template]);

    // Broadcast form state changes for live preview
    useEffect(() => {
        onFormChange?.(body, subject, type);
    }, [body, subject, type, onFormChange]);

    const usedVariables = extractVariables(body);

    const insertVariable = useCallback((varName: string) => {
        const textarea = bodyRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const insertion = `{${varName}}`;

        setBody(prev => prev.slice(0, start) + insertion + prev.slice(end));

        // Restore cursor position after insertion
        requestAnimationFrame(() => {
            textarea.focus();
            const newPos = start + insertion.length;
            textarea.setSelectionRange(newPos, newPos);
        });
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        const validationErrors: string[] = [];
        if (!name.trim()) validationErrors.push('Template name is required.');
        if (!body.trim()) validationErrors.push('Template body is required.');

        const validation = validateTemplate(body);
        if (!validation.valid) {
            validationErrors.push(...validation.errors);
        }

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setErrors([]);

        const input: TemplateInput = {
            name: name.trim(),
            type,
            subject: type === 'EMAIL' ? subject.trim() || undefined : undefined,
            body: body.trim(),
            isDefault
        };

        if (isEditing && template) {
            updateMutation.mutate({ id: template.id, input }, { onSuccess: onSaved });
        } else {
            createMutation.mutate(input, { onSuccess: onSaved });
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;
    const mutationError = createMutation.error ?? updateMutation.error;

    return (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <h3 className={styles.formTitle}>{isEditing ? 'Edit Template' : 'New Template'}</h3>

            {/* Error messages */}
            {(errors.length > 0 || mutationError) && (
                <div className={styles.errorBox} role="alert">
                    {errors.map(err => (
                        <p key={err}>{err}</p>
                    ))}
                    {mutationError && <p>{mutationError.message}</p>}
                </div>
            )}

            {/* Name */}
            <div className={styles.field}>
                <label htmlFor="template-name" className={styles.label}>
                    Name
                </label>
                <input
                    id="template-name"
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Friendly Reminder"
                    maxLength={200}
                    required
                />
            </div>

            {/* Type */}
            <div className={styles.field}>
                <label htmlFor="template-type" className={styles.label}>
                    Channel
                </label>
                <select
                    id="template-type"
                    className={styles.select}
                    value={type}
                    onChange={e => setType(e.target.value as TemplateType)}
                >
                    {TEMPLATE_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Subject (email only) */}
            {type === 'EMAIL' && (
                <div className={styles.field}>
                    <label htmlFor="template-subject" className={styles.label}>
                        Subject
                    </label>
                    <input
                        id="template-subject"
                        type="text"
                        className={styles.input}
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="e.g. Review reminder for {prTitle}"
                        maxLength={500}
                    />
                </div>
            )}

            {/* Body */}
            <div className={styles.field}>
                <label htmlFor="template-body" className={styles.label}>
                    Body
                    <span className={styles.labelHint}>Use {'{variableName}'} for dynamic content</span>
                </label>
                <textarea
                    ref={bodyRef}
                    id="template-body"
                    className={styles.textarea}
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder={`Hi {receiverName},\n\nJust a friendly reminder to review PR #{prNumber}: {prTitle}\n{prUrl}\n\nThanks!`}
                    rows={8}
                    maxLength={10000}
                    required
                />
            </div>

            {/* Variable Pills */}
            <div className={styles.field}>
                <span className={styles.label}>Insert Variable</span>
                <div className={styles.variablePills}>
                    {AVAILABLE_VARIABLES.map(v => (
                        <button
                            key={v.name}
                            type="button"
                            className={`${styles.pill} ${usedVariables.includes(v.name) ? styles.pillUsed : ''}`}
                            onClick={() => insertVariable(v.name)}
                            title={v.description}
                        >
                            {'{'}
                            {v.name}
                            {'}'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Default checkbox */}
            <label className={styles.checkboxLabel}>
                <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isDefault}
                    onChange={e => setIsDefault(e.target.checked)}
                />
                <span>Set as default for {TEMPLATE_TYPES.find(t => t.value === type)?.label}</span>
            </label>

            {/* Actions */}
            <div className={styles.actions}>
                <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={isPending}>
                    Cancel
                </button>
                <button type="submit" className={styles.submitButton} disabled={isPending}>
                    {isPending ? 'Saving\u2026' : isEditing ? 'Update Template' : 'Create Template'}
                </button>
            </div>
        </form>
    );
}
