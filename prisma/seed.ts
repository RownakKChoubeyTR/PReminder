import { PrismaClient, TemplateType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Default message templates seeded for every new user.
 * These are also used as system defaults when a user has no templates.
 */
const defaultTemplates = [
    {
        name: 'Friendly Reminder',
        type: TemplateType.TEAMS_DM,
        subject: null,
        body: `Hey {receiver_name},

I would like to remind you to please give feedback on the below PR:

{pr_url}

Please approve if it looks good.

Thanks,
{sender_name}`,
        isDefault: true
    },
    {
        name: 'Urgent Review',
        type: TemplateType.TEAMS_DM,
        subject: null,
        body: `Hi {receiver_name},

PR #{pr_number} ({pr_title}) in {repo} needs your review urgently.

Link: {pr_url}

Thanks,
{sender_name}`,
        isDefault: false
    },
    {
        name: 'Quick Nudge',
        type: TemplateType.TEAMS_DM,
        subject: null,
        body: `Hey {receiver_name}, just a gentle nudge — PR #{pr_number} in {repo} is still waiting on your review. {pr_url} — Thanks, {sender_name}`,
        isDefault: false
    },
    {
        name: 'Standard Email',
        type: TemplateType.EMAIL,
        subject: 'PR Review Reminder: {pr_title} (#{pr_number})',
        body: `Hi {receiver_name},

This is a reminder that PR #{pr_number} in {repo_full} is pending your review.

Title: {pr_title}
Link: {pr_url}
Author: {author_name} (@{author})

Please review and approve if everything looks good.

{custom_message}

Best regards,
{sender_name}`,
        isDefault: true
    },
    {
        name: 'Formal Email',
        type: TemplateType.EMAIL,
        subject: 'Action Required: Review PR #{pr_number} — {pr_title}',
        body: `Dear {receiver_name},

Your review is requested for the following pull request:

• Repository: {repo_full}
• PR: #{pr_number} — {pr_title}  
• Author: {author_name}
• Open for: {days_open} day(s)
• Link: {pr_url}

Currently pending on {reviewer_count} reviewer(s): {reviewer_list}

Please take a moment to review at your earliest convenience.

Kind regards,
{sender_name}`,
        isDefault: false
    },
    {
        name: 'Channel Notification',
        type: TemplateType.TEAMS_CHANNEL,
        subject: null,
        body: `📋 **PR Review Needed**

**{pr_title}** (#{pr_number}) in \`{repo}\`
Author: @{author}
Pending on: {reviewer_list}
Open for: {days_open} day(s)

[View PR]({pr_url})`,
        isDefault: true
    }
];

async function main() {
    console.log('🌱 Seeding PReminder database...\n');

    // Log default templates (these get created per-user on first login)
    console.log('Default templates that will be created for new users:');
    for (const template of defaultTemplates) {
        console.log(`  ✓ ${template.name} (${template.type})`);
    }

    // You can also create a "system" user to hold global defaults
    // or simply export the template definitions for the app to use
    // during user onboarding:
    //
    // const systemUser = await prisma.user.upsert({
    //   where: { githubId: 0 },
    //   update: {},
    //   create: {
    //     githubId: 0,
    //     username: '__system__',
    //     accessToken: 'none',
    //   },
    // });
    //
    // for (const t of defaultTemplates) {
    //   await prisma.messageTemplate.upsert({
    //     where: { userId_name_type: { userId: systemUser.id, name: t.name, type: t.type } },
    //     update: { body: t.body, subject: t.subject },
    //     create: { ...t, userId: systemUser.id },
    //   });
    // }

    console.log('\n✅ Seed complete.');
    console.log('   Default templates are defined in prisma/seed.ts');
    console.log('   They are created per-user during first login.\n');
}

main()
    .catch(e => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

// Export for use in the application (user onboarding)
export { defaultTemplates };
