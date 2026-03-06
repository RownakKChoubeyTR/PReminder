'use client';

import type { EmailMapping } from '@/hooks/use-email-mappings';
import { useCreateEmailMapping, useDeleteEmailMapping, useEmailMappings } from '@/hooks/use-email-mappings';
import type { IntegrationConfig } from '@/hooks/use-integrations';
import {
    useCreateIntegration,
    useDeleteIntegration,
    useIntegrations,
    useTestIntegration,
    useUpdateIntegration
} from '@/hooks/use-integrations';
import { useCallback, useState } from 'react';
import styles from './page.module.scss';

// ─────────────────────────────────────────────────────────────
// Settings > Integrations — Teams + Email Mapping config
// ─────────────────────────────────────────────────────────────

type Tab = 'integrations' | 'mappings';

export default function IntegrationsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('integrations');

    return (
        <div className={styles.page}>
            <h1 className={styles.pageTitle}>Integrations</h1>
            <p className={styles.pageDescription}>
                Configure Teams webhooks, Power Automate flows, and GitHub-to-email mappings.
            </p>

            <div className={styles.tabs} role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'integrations'}
                    className={`${styles.tab} ${activeTab === 'integrations' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('integrations')}
                >
                    Webhooks
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'mappings'}
                    className={`${styles.tab} ${activeTab === 'mappings' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('mappings')}
                >
                    Email Mappings
                </button>
            </div>

            {activeTab === 'integrations' && <IntegrationsSection />}
            {activeTab === 'mappings' && <EmailMappingsSection />}
        </div>
    );
}

// ── Integrations Section ────────────────────────────────────

const TYPE_LABELS: Record<IntegrationConfig['type'], string> = {
    POWER_AUTOMATE_DM: 'Power Automate DM',
    TEAMS_WEBHOOK: 'Teams Channel Webhook'
};

const ALL_TYPES: IntegrationConfig['type'][] = ['POWER_AUTOMATE_DM', 'TEAMS_WEBHOOK'];

function formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(iso));
}

function IntegrationsSection() {
    const { data, isLoading, error } = useIntegrations();
    const createMutation = useCreateIntegration();
    const deleteMutation = useDeleteIntegration();
    const updateMutation = useUpdateIntegration();
    const testMutation = useTestIntegration();

    // Add form state
    const [type, setType] = useState<IntegrationConfig['type']>('POWER_AUTOMATE_DM');
    const [label, setLabel] = useState('');
    const [value, setValue] = useState('');

    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [editValue, setEditValue] = useState('');

    const [testResult, setTestResult] = useState<{ id: string; success: boolean } | null>(null);

    const configs = data?.data ?? [];

    // Types that already have an entry — max one per type
    const takenTypes = new Set(configs.map(c => c.type));
    const availableTypes = ALL_TYPES.filter(t => !takenTypes.has(t));
    const allTypesTaken = availableTypes.length === 0;

    // When available types change, ensure the selected type is always available
    const effectiveType = availableTypes.includes(type) ? type : (availableTypes[0] ?? type);

    const handleAdd = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!label.trim() || !value.trim()) return;
            await createMutation.mutateAsync({
                type: effectiveType,
                label: label.trim(),
                value: value.trim()
            });
            setLabel('');
            setValue('');
        },
        [effectiveType, label, value, createMutation]
    );

    const handleDelete = useCallback(
        (id: string) => {
            deleteMutation.mutate(id);
        },
        [deleteMutation]
    );

    const handleToggle = useCallback(
        (config: IntegrationConfig) => {
            updateMutation.mutate({ id: config.id, input: { isActive: !config.isActive } });
        },
        [updateMutation]
    );

    const handleTest = useCallback(
        async (id: string) => {
            const result = await testMutation.mutateAsync(id);
            setTestResult({ id, success: result.success });
            setTimeout(() => setTestResult(null), 5000);
        },
        [testMutation]
    );

    const handleStartEdit = useCallback((config: IntegrationConfig) => {
        setEditingId(config.id);
        setEditLabel(config.label);
        setEditValue(''); // URL is encrypted and not returned by API; user must re-enter to change
    }, []);

    const handleSaveEdit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!editingId || !editLabel.trim()) return;
            const input: { label?: string; value?: string } = { label: editLabel.trim() };
            if (editValue.trim()) input.value = editValue.trim();
            await updateMutation.mutateAsync({ id: editingId, input });
            setEditingId(null);
        },
        [editingId, editLabel, editValue, updateMutation]
    );

    const handleCancelEdit = useCallback(() => {
        setEditingId(null);
        setEditLabel('');
        setEditValue('');
    }, []);

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Webhook Configurations</h2>
            <p className={styles.sectionDescription}>
                One integration per type. URLs are stored encrypted (AES-256-GCM).
            </p>

            {error && (
                <div className={styles.error} role="alert">
                    {error.message}
                </div>
            )}
            {createMutation.error && (
                <div className={styles.error} role="alert">
                    {createMutation.error.message}
                </div>
            )}
            {updateMutation.error && (
                <div className={styles.error} role="alert">
                    {updateMutation.error.message}
                </div>
            )}

            {/* Add form — only shown when at least one type slot is still free */}
            {!allTypesTaken && (
                <form className={styles.form} onSubmit={handleAdd}>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="int-type">
                            Type
                        </label>
                        <select
                            id="int-type"
                            className={styles.select}
                            value={effectiveType}
                            onChange={e => setType(e.target.value as IntegrationConfig['type'])}
                        >
                            {availableTypes.map(t => (
                                <option key={t} value={t}>
                                    {TYPE_LABELS[t]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="int-label">
                            Label
                        </label>
                        <input
                            id="int-label"
                            className={styles.input}
                            placeholder="e.g. My PA Flow"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.field} style={{ flex: 2 }}>
                        <label className={styles.label} htmlFor="int-value">
                            Webhook URL
                        </label>
                        <input
                            id="int-value"
                            className={styles.input}
                            type="url"
                            placeholder="https://prod-xx.westus.logic.azure.com/..."
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className={styles.addButton} disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Adding…' : 'Add'}
                    </button>
                </form>
            )}

            {allTypesTaken && (
                <p className={styles.allTypesTakenNote}>
                    Both integration types are configured. Edit or delete an existing entry to make changes.
                </p>
            )}

            {isLoading && <div className={styles.empty}>Loading…</div>}

            {!isLoading && configs.length === 0 && <div className={styles.empty}>No integrations configured yet.</div>}

            {configs.length > 0 && (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Label</th>
                            <th>Status</th>
                            <th>Last Modified</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {configs.map(config =>
                            editingId === config.id ? (
                                /* ── Inline edit row ── */
                                <tr key={config.id} className={styles.editRow}>
                                    <td>{TYPE_LABELS[config.type]}</td>
                                    <td colSpan={2}>
                                        <form
                                            id={`edit-form-${config.id}`}
                                            className={styles.inlineEditForm}
                                            onSubmit={handleSaveEdit}
                                        >
                                            <input
                                                className={styles.input}
                                                placeholder="Label"
                                                value={editLabel}
                                                onChange={e => setEditLabel(e.target.value)}
                                                required
                                                aria-label="Edit label"
                                            />
                                            <input
                                                className={styles.input}
                                                type="url"
                                                placeholder="New URL (leave blank to keep current)"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                aria-label="Edit webhook URL"
                                            />
                                        </form>
                                    </td>
                                    <td>{formatDateTime(config.updatedAt)}</td>
                                    <td>
                                        <div className={styles.actionsCell}>
                                            <button
                                                type="submit"
                                                form={`edit-form-${config.id}`}
                                                className={styles.saveButton}
                                                disabled={updateMutation.isPending}
                                            >
                                                {updateMutation.isPending ? 'Saving…' : 'Save'}
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.cancelButton}
                                                onClick={handleCancelEdit}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                /* ── Normal row ── */
                                <tr key={config.id}>
                                    <td>{TYPE_LABELS[config.type]}</td>
                                    <td>{config.label}</td>
                                    <td>
                                        <span
                                            className={`${styles.badge} ${config.isActive ? styles.badgeActive : styles.badgeInactive}`}
                                        >
                                            {config.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={styles.timestamp}>{formatDateTime(config.updatedAt)}</span>
                                    </td>
                                    <td>
                                        <div className={styles.actionsCell}>
                                            <button
                                                type="button"
                                                className={
                                                    styles.toggleSwitch +
                                                    (config.isActive ? ` ${styles.toggleActive}` : '')
                                                }
                                                onClick={() => handleToggle(config)}
                                                aria-label={config.isActive ? 'Deactivate' : 'Activate'}
                                                title={config.isActive ? 'Deactivate' : 'Activate'}
                                            />
                                            <button
                                                type="button"
                                                className={styles.editButton}
                                                onClick={() => handleStartEdit(config)}
                                                aria-label={`Edit ${config.label}`}
                                                title="Edit"
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.testButton}
                                                onClick={() => handleTest(config.id)}
                                                disabled={testMutation.isPending}
                                                aria-label="Test connection"
                                                title="Test connection"
                                            >
                                                {testResult?.id === config.id ? (
                                                    testResult.success ? (
                                                        '✓'
                                                    ) : (
                                                        '✗'
                                                    )
                                                ) : (
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="m22 2-7 20-4-9-9-4z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.deleteButton}
                                                onClick={() => handleDelete(config.id)}
                                                aria-label={`Delete ${config.label}`}
                                                title="Delete"
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M3 6h18" />
                                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            )}
        </section>
    );
}

// ── Email Mappings Section ──────────────────────────────────

function EmailMappingsSection() {
    const { data, isLoading, error } = useEmailMappings();
    const createMutation = useCreateEmailMapping();
    const deleteMutation = useDeleteEmailMapping();

    const [githubUsername, setGithubUsername] = useState('');
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');

    const mappings = data?.data ?? [];

    const handleAdd = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!githubUsername.trim() || !email.trim()) return;
            await createMutation.mutateAsync({
                githubUsername: githubUsername.trim(),
                email: email.trim(),
                displayName: displayName.trim() || undefined
            });
            setGithubUsername('');
            setEmail('');
            setDisplayName('');
        },
        [githubUsername, email, displayName, createMutation]
    );

    const handleDelete = useCallback(
        (id: string) => {
            deleteMutation.mutate(id);
        },
        [deleteMutation]
    );

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Email Mappings</h2>
            <p className={styles.sectionDescription}>
                Map GitHub usernames to corporate email addresses. Required for Teams DM and email reminders. Emails
                discovered from GitHub profiles/commits are cached automatically.
            </p>

            {error && (
                <div className={styles.error} role="alert">
                    {error.message}
                </div>
            )}
            {createMutation.error && (
                <div className={styles.error} role="alert">
                    {createMutation.error.message}
                </div>
            )}

            <form className={styles.form} onSubmit={handleAdd}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="map-github">
                        GitHub Username
                    </label>
                    <input
                        id="map-github"
                        className={styles.input}
                        placeholder="octocat"
                        value={githubUsername}
                        onChange={e => setGithubUsername(e.target.value)}
                        required
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label} htmlFor="map-email">
                        Corporate Email
                    </label>
                    <input
                        id="map-email"
                        className={styles.input}
                        type="email"
                        placeholder="user@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label} htmlFor="map-name">
                        Display Name
                    </label>
                    <input
                        id="map-name"
                        className={styles.input}
                        placeholder="John Smith (optional)"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                    />
                </div>

                <button type="submit" className={styles.addButton} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Adding…' : 'Add Mapping'}
                </button>
            </form>

            {isLoading && <div className={styles.empty}>Loading…</div>}

            {!isLoading && mappings.length === 0 && (
                <div className={styles.empty}>
                    No email mappings yet. Add one above to enable Teams DM and email reminders.
                </div>
            )}

            {mappings.length > 0 && (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>GitHub Username</th>
                            <th>Email</th>
                            <th>Display Name</th>
                            <th>Source</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mappings.map((mapping: EmailMapping) => (
                            <tr key={mapping.id}>
                                <td>@{mapping.githubUsername}</td>
                                <td>{mapping.email}</td>
                                <td>{mapping.displayName ?? '—'}</td>
                                <td>
                                    <span className={styles.sourceBadge}>{mapping.source}</span>
                                </td>
                                <td>
                                    <div className={styles.actionsCell}>
                                        <button
                                            type="button"
                                            className={styles.deleteButton}
                                            onClick={() => handleDelete(mapping.id)}
                                            aria-label={`Delete mapping for ${mapping.githubUsername}`}
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M3 6h18" />
                                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
