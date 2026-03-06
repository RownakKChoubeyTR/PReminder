-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('TEAMS_DM', 'TEAMS_CHANNEL', 'EMAIL');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('POWER_AUTOMATE_DM', 'TEAMS_WEBHOOK');

-- CreateEnum
CREATE TYPE "ReminderMethod" AS ENUM ('TEAMS_DM_POWER_AUTOMATE', 'TEAMS_DM_DEEPLINK', 'TEAMS_CHANNEL_WEBHOOK', 'EMAIL_GRAPH', 'EMAIL_MAILTO');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SENT', 'FAILED', 'OPENED', 'QUEUED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "repo" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "prTitle" TEXT,
    "reviewerGithub" TEXT NOT NULL,
    "reviewerEmail" TEXT,
    "method" "ReminderMethod" NOT NULL,
    "templateId" TEXT,
    "status" "ReminderStatus" NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_mappings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "checkIntervalMins" INTEGER NOT NULL DEFAULT 60,
    "staleThresholdHrs" INTEGER NOT NULL DEFAULT 4,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "message_templates_userId_type_idx" ON "message_templates"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_userId_name_type_key" ON "message_templates"("userId", "name", "type");

-- CreateIndex
CREATE INDEX "integration_configs_userId_type_idx" ON "integration_configs"("userId", "type");

-- CreateIndex
CREATE INDEX "reminder_logs_userId_sentAt_idx" ON "reminder_logs"("userId", "sentAt" DESC);

-- CreateIndex
CREATE INDEX "reminder_logs_reviewerGithub_prNumber_repo_idx" ON "reminder_logs"("reviewerGithub", "prNumber", "repo");

-- CreateIndex
CREATE INDEX "reminder_logs_userId_prNumber_repo_reviewerGithub_idx" ON "reminder_logs"("userId", "prNumber", "repo", "reviewerGithub");

-- CreateIndex
CREATE INDEX "email_mappings_userId_idx" ON "email_mappings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_mappings_userId_githubUsername_key" ON "email_mappings"("userId", "githubUsername");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_mappings" ADD CONSTRAINT "email_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
