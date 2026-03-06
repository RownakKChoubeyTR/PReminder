import { authenticateUser } from '@/lib/auth-utils';
import { decrypt } from '@/lib/db/encryption';
import { prisma } from '@/lib/db/prisma';
import { resolveRecipientEmail } from '@/lib/email/resolve';
import { createLogger } from '@/lib/logger';
import { sendTeamsChannelMessage, sendTeamsDM } from '@/lib/teams/power-automate';
import { renderTemplate } from '@/lib/templates/engine';
import type { ReminderChannel, SingleReminderResult } from '@/types/reminders';
import type { TemplateContext } from '@/types/templates';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createLogger('api/reminders/send');

// ─────────────────────────────────────────────────────────────
// POST /api/reminders/send — Send reminders to selected reviewers
// ─────────────────────────────────────────────────────────────

// TODO: re-enable cooldown — const COOLDOWN_SECONDS = 3600;
const MAX_RECIPIENTS = 50; // Hard cap

const sendReminderSchema = z.object({
    recipients: z.array(z.string().min(1)).min(1, 'At least one recipient is required').max(MAX_RECIPIENTS),
    pr: z.object({
        number: z.number().int().positive(),
        title: z.string().min(1),
        url: z.string().url(),
        repo: z.string().min(1),
        branch: z.string(),
        targetBranch: z.string(),
        age: z.number().int(),
        labels: z.array(z.string()),
        description: z.string()
    }),
    templateId: z.string().min(1),
    channel: z.enum(['TEAMS_DM', 'TEAMS_CHANNEL'])
});

export async function POST(request: NextRequest) {
    const authResult = await authenticateUser();
    if (authResult.error) return authResult.error;
    const { user } = authResult;

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const parsed = sendReminderSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: parsed.error.flatten().fieldErrors
            },
            { status: 400 }
        );
    }

    const { recipients, pr, templateId, channel } = parsed.data;

    // Fetch template
    const template = await prisma.messageTemplate.findUnique({
        where: { id: templateId }
    });

    if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Fetch user's webhook configs
    let dmWebhookUrl: string | null = null;
    let channelWebhookUrl: string | null = null;

    if (channel === 'TEAMS_DM' || channel === 'TEAMS_CHANNEL') {
        const configs = await prisma.integrationConfig.findMany({
            where: {
                userId: user.id,
                isActive: true,
                type: { in: ['POWER_AUTOMATE_DM', 'TEAMS_WEBHOOK'] }
            }
        });
        for (const config of configs) {
            if (config.type === 'POWER_AUTOMATE_DM' && !dmWebhookUrl) {
                dmWebhookUrl = decrypt(config.encryptedValue);
            }
            if (config.type === 'TEAMS_WEBHOOK' && !channelWebhookUrl) {
                channelWebhookUrl = decrypt(config.encryptedValue);
            }
        }
    }

    const results: SingleReminderResult[] = await Promise.all(
        recipients.map(async (login): Promise<SingleReminderResult> => {
            try {
                const resolution = await resolveRecipientEmail(user.id, login, user.accessToken);

                const context: TemplateContext = {
                    senderName: user.githubLogin,
                    senderLogin: user.githubLogin,
                    receiverName: resolution.displayName ?? login,
                    receiverLogin: login,
                    prTitle: pr.title,
                    prNumber: pr.number,
                    prUrl: pr.url,
                    prAge: pr.age,
                    repoName: pr.repo,
                    repoUrl: `https://github.com/${pr.repo}`,
                    reviewStatus: 'Pending',
                    branchName: pr.branch,
                    targetBranch: pr.targetBranch,
                    labelList: pr.labels.join(', '),
                    prDescription: pr.description.slice(0, 200),
                    currentDate: new Date().toLocaleDateString(),
                    currentTime: new Date().toLocaleTimeString(),
                    orgName: process.env.GITHUB_ORG ?? ''
                };

                const renderedBody = renderTemplate(template.body, context);
                const effectiveChannel: ReminderChannel = channel;

                // Fail early if webhook not configured
                if (channel === 'TEAMS_DM' && !dmWebhookUrl) {
                    const result: SingleReminderResult = {
                        login,
                        channel,
                        status: 'FAILED',
                        error: 'No Teams DM webhook configured — add your Power Automate URL in Settings → Integrations'
                    };
                    await logReminder(
                        user.id,
                        login,
                        resolution.email,
                        pr,
                        'TEAMS_DM_POWER_AUTOMATE',
                        templateId,
                        result
                    );
                    return result;
                }
                if (channel === 'TEAMS_CHANNEL' && !channelWebhookUrl) {
                    const result: SingleReminderResult = {
                        login,
                        channel,
                        status: 'FAILED',
                        error: 'No Teams channel webhook configured — add one in Settings → Integrations'
                    };
                    await logReminder(
                        user.id,
                        login,
                        resolution.email,
                        pr,
                        'TEAMS_CHANNEL_WEBHOOK',
                        templateId,
                        result
                    );
                    return result;
                }

                const recipientEmail = resolution.email;
                let result: SingleReminderResult;

                switch (effectiveChannel) {
                    case 'TEAMS_DM': {
                        if (!recipientEmail) {
                            result = {
                                login,
                                channel: effectiveChannel,
                                status: 'FAILED',
                                requiresEmailMapping: true,
                                displayName: resolution.displayName,
                                error:
                                    resolution.source === null
                                        ? (resolution as { reason: string }).reason
                                        : 'No email mapping found — add one in Settings → Email Mappings'
                            };
                        } else {
                            const renderedSubject = renderTemplate(
                                template.subject ?? 'PR Review Reminder: {prTitle}',
                                context
                            );
                            const dmResult = await sendTeamsDM(dmWebhookUrl!, {
                                recipientEmail,
                                message: renderedBody,
                                subject: renderedSubject
                            });
                            if (!dmResult.success) {
                                log.warn('PA DM delivery failed', {
                                    login,
                                    statusCode: dmResult.statusCode,
                                    error: dmResult.error
                                });
                            }
                            result = {
                                login,
                                channel: effectiveChannel,
                                status: dmResult.success ? 'SENT' : 'FAILED',
                                error: dmResult.error
                            };
                        }
                        break;
                    }

                    case 'TEAMS_CHANNEL': {
                        const title = renderTemplate(template.subject ?? '🔔 PR Review Reminder', context);
                        const channelResult = await sendTeamsChannelMessage(
                            channelWebhookUrl!,
                            title,
                            renderedBody,
                            pr.url
                        );
                        if (!channelResult.success) {
                            log.warn('Teams channel delivery failed', {
                                login,
                                statusCode: channelResult.statusCode,
                                error: channelResult.error
                            });
                        }
                        result = {
                            login,
                            channel: effectiveChannel,
                            status: channelResult.success ? 'SENT' : 'FAILED',
                            error: channelResult.error
                        };
                        break;
                    }

                    default: {
                        result = {
                            login,
                            channel: effectiveChannel,
                            status: 'FAILED',
                            error: `Channel "${effectiveChannel}" is not supported`
                        };
                        break;
                    }
                }

                const methodMap: Record<ReminderChannel, ReminderMethod> = {
                    TEAMS_DM: 'TEAMS_DM_POWER_AUTOMATE',
                    TEAMS_CHANNEL: 'TEAMS_CHANNEL_WEBHOOK'
                };
                await logReminder(
                    user.id,
                    login,
                    resolution.email,
                    pr,
                    methodMap[effectiveChannel],
                    templateId,
                    result
                );
                return result;
            } catch (err) {
                log.error('Failed to process reminder', err, { login, channel });
                return { login, channel, status: 'FAILED', error: 'Internal error processing reminder' };
            }
        })
    );

    return NextResponse.json({
        total: results.length,
        sent: results.filter(r => r.status === 'SENT').length,
        failed: results.filter(r => r.status === 'FAILED').length,
        results
    });
}

// ─────────────────────────────────────────────────────────────
// Helper: log a reminder to the database
// ─────────────────────────────────────────────────────────────

interface PrInfo {
    number: number;
    repo: string;
    title: string;
}

type ReminderMethod = 'TEAMS_DM_POWER_AUTOMATE' | 'TEAMS_CHANNEL_WEBHOOK';

async function logReminder(
    userId: string,
    login: string,
    email: string | undefined | null,
    pr: PrInfo,
    method: ReminderMethod,
    templateId: string,
    result: SingleReminderResult
): Promise<void> {
    await prisma.reminderLog.create({
        data: {
            userId,
            reviewerGithub: login,
            reviewerEmail: email ?? null,
            prNumber: pr.number,
            repo: pr.repo,
            owner: pr.repo.split('/')[0] ?? '',
            prTitle: pr.title,
            method,
            templateId,
            status: result.status === 'SENT' ? 'SENT' : 'FAILED',
            errorMessage: result.status === 'FAILED' ? result.error : null
        }
    });
}
