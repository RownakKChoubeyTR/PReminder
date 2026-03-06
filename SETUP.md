# Setup Guide — PReminder

This document walks you through everything needed to get PReminder running, from API key generation to database provisioning.

---

## Table of Contents

- [1. Node.js & pnpm](#1-nodejs--pnpm)
- [2. GitHub OAuth App](#2-github-oauth-app)
- [3. Database (PostgreSQL)](#3-database-postgresql)
- [4. Environment Variables](#4-environment-variables)
- [5. Teams Setup](#5-teams-setup)
- [6. Email Setup](#6-email-setup)
- [7. Desktop Notifications](#7-desktop-notifications)
- [8. First Run](#8-first-run)
- [9. Troubleshooting](#9-troubleshooting)

---

## 1. Node.js & pnpm

```bash
# Install Node.js 20 LTS from https://nodejs.org
node --version   # Should be >= 20.x

# Install pnpm globally
npm install -g pnpm
pnpm --version   # Should be >= 9.x
```

---

## 2. GitHub OAuth App

You need a GitHub OAuth App to authenticate users and access the GitHub API on their behalf.

### Step-by-step

1. Go to **[github.com/settings/developers](https://github.com/settings/developers)**
2. Click **"OAuth Apps"** → **"New OAuth App"**
3. Fill in:
    - **Application name**: `PReminder` (or any name)
    - **Homepage URL**: `http://localhost:3000`
    - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click **"Register application"**
5. Copy the **Client ID** → paste into `.env.local` as `GITHUB_CLIENT_ID`
6. Click **"Generate a new client secret"** → copy → paste as `GITHUB_CLIENT_SECRET`

### For Organization Private Repos

If targeting private repos in a GitHub organization:

1. **Option A** (Recommended): Register the OAuth App under the **organization** settings:
   `https://github.com/organizations/<YOUR_ORG>/settings/applications` → **New OAuth App**

2. **Option B**: Register under your personal account, then request org access:
    - After login, users will see a prompt to grant org access
    - An org admin must approve the OAuth App in org settings

### Required Scopes

PReminder requests these scopes during OAuth:

- `repo` — Full access to private repositories (read PRs, reviewers)
- `read:org` — Read organization teams and members (expand team reviewers)

These are configured in the NextAuth provider, not on the OAuth App itself.

---

## 3. Database (PostgreSQL)

PReminder uses Prisma ORM. Any PostgreSQL instance works.

### Credential Management (Enterprise Pattern)

PReminder **never stores the database password inside a connection string** in config files. Instead, credentials are split into individual environment variables that are composed into a connection URL at runtime:

```bash
# .env.local — each credential is a separate variable
DB_HOST=localhost
DB_PORT=5432
DB_USER=preminder
DB_PASSWORD=preminder          # ← Injected from secrets manager in production
DB_NAME=preminder
DB_SCHEMA=public
# DB_SSL_MODE=require            # Uncomment for cloud databases
```

The app composes these into a PostgreSQL URL at startup via `src/lib/db/connection.ts`. The password never appears in logs — connection URLs are masked automatically.

**In production**, replace the individual vars with values from your secrets manager:

| Provider            | How to inject                                        |
| ------------------- | ---------------------------------------------------- |
| Azure Key Vault     | App Service → Configuration → Key Vault references   |
| AWS Secrets Manager | ECS Task Definition → `secrets` field                |
| HashiCorp Vault     | Vault Agent sidecar or `vault kv get`                |
| Vercel              | Project Settings → Environment Variables (encrypted) |
| GitHub Actions      | Repository → Settings → Secrets                      |

All database credentials are **required** — there is no `DATABASE_URL` fallback. The Prisma CLI uses `scripts/prisma-cli.mjs` to compose the URL from the same individual vars.

### Connection Resilience

PReminder includes an automatic **retry with exponential back-off** strategy:

- Up to **5 retries** on connection failure
- Exponential delay: 1s → 2s → 4s → 8s → 16s (capped at 30s)
- Random jitter prevents thundering-herd when multiple instances restart
- Every attempt is logged to both **console** (colour-coded) and **`logs/db-connection.log`** at the project root

Sample log output:

```
[DB] 10:15:30 INFO  ✓ Connecting to database: postgresql://preminder:****@localhost:5432/preminder
[DB] 10:15:30 WARN  ⚠ Attempt 1/6 failed: Connection refused
[DB] 10:15:31 INFO  ✓ Retrying in 1023ms...
[DB] 10:15:33 INFO  ✓ Connected successfully (after 1 retries)
```

### Option A: Local PostgreSQL (Recommended for Development)

1. Install PostgreSQL 16 from [postgresql.org/download](https://www.postgresql.org/download/)
2. Open **psql** (or pgAdmin / Beekeeper Studio) and run:

```sql
CREATE USER preminder WITH PASSWORD 'preminder';
CREATE DATABASE preminder OWNER preminder;
```

3. Set the individual env vars in `.env.local` (already pre-configured for localhost)
4. Apply migrations and seed:

```bash
pnpm db:migrate
pnpm db:seed
```

### Option B: Supabase (Free Cloud)

1. Go to **[supabase.com](https://supabase.com)** → Sign in → **New Project**
2. Set a database password (save it!)
3. In `.env.local`, set:

```bash
DB_HOST=aws-0-<region>.pooler.supabase.com
DB_PORT=6543
DB_USER=postgres.<ref>
DB_PASSWORD=<your-password>
DB_NAME=postgres
DB_SSL_MODE=require
```

### Option C: Azure Database for PostgreSQL

1. Go to **[portal.azure.com](https://portal.azure.com)** → **Create a resource** → **Azure Database for PostgreSQL**
2. Choose **Flexible server**, set admin username + password
3. Under **Networking**, add your IP to firewall rules
4. In `.env.local`:

```bash
DB_HOST=<server>.postgres.database.azure.com
DB_PORT=5432
DB_USER=<admin>
DB_PASSWORD=<password>          # From Azure Key Vault in production
DB_NAME=preminder
DB_SSL_MODE=require
```

### Switching Databases Later

1. Update `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env.local`
2. If changing database _type_ (e.g., PostgreSQL → SQLite for local dev):
    - Update `provider` in `prisma/schema.prisma`
    - Run `pnpm db:migrate`
3. If same type (e.g., Supabase → Azure PostgreSQL):
    - Just update the individual env vars — Prisma handles the rest
    - Run `pnpm db:migrate:deploy` to apply existing migrations

---

## 4. Environment Variables

### Generate Required Secrets

```bash
# Generate NEXTAUTH_SECRET (32-byte random base64)
openssl rand -base64 32
# Example output: K7gNz8qR5mX2vB9dH3fJ6wP1tY4sA0cE=

# Generate ENCRYPTION_KEY (32-byte random hex, 64 characters)
openssl rand -hex 32
# Example output: a1b2c3d4e5f6...64 hex characters
```

### Complete `.env.local` File

```bash
# ━━━ Core ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=K7gNz8qR5mX2vB9dH3fJ6wP1tY4sA0cE=

# ━━━ GitHub OAuth ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=0123456789abcdef...
GITHUB_ORG=my-company

# ━━━ Database (split credentials) ━━━━━━━━━━━━━━━━━
DB_HOST=localhost
DB_PORT=5432
DB_USER=preminder
DB_PASSWORD=preminder
DB_NAME=preminder
DB_SCHEMA=public
# DB_SSL_MODE=require  # Uncomment for cloud databases

# ━━━ Encryption ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENCRYPTION_KEY=a1b2c3d4e5f6789...

# ━━━ Microsoft Graph (Optional — for automated email) ━━━━━━━
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# ━━━ Feature Flags ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_ENABLE_GRAPH_EMAIL=false
NEXT_PUBLIC_ENABLE_DESKTOP_NOTIFICATIONS=true
```

### Validation

PReminder validates all environment variables at startup using Zod. If a required variable is missing or malformed, the app will refuse to start and print a clear error message.

---

## 5. Teams Setup

### 5A. Power Automate DM (Recommended)

Sends automated 1:1 Teams messages as yourself. No admin consent needed.

**Prerequisites**: Microsoft 365 account with Power Automate access (included in most enterprise licenses).

#### Step-by-step

> **Tip**: The Power Automate UI changes frequently. If a button or label doesn't match exactly, look for the closest equivalent.

**1. Create the flow**

1. Go to **[make.powerautomate.com](https://make.powerautomate.com)** and sign in with your Microsoft 365 work account
2. In the left sidebar, click **"+ Create"**
3. Select **"Instant cloud flow"**
4. In the dialog:
    - **Flow name**: `PReminder - Send Teams DM`
    - **Choose how to trigger this flow**: scroll down and select **"When an HTTP request is received"**
    - Click **"Create"**

**2. Configure the HTTP trigger**

5. You'll see the trigger card **"When an HTTP request is received"**. Click on it to expand.
6. Click **"Use sample payload to generate schema"**
7. In the popup, paste this JSON and click **"Done"**:
    ```json
    {
        "recipientEmail": "john.doe@company.com",
        "subject": "PR Review Reminder",
        "message": "Hi John, PR #123 needs your review: https://github.com/..."
    }
    ```
    The schema will auto-generate with `recipientEmail`, `subject`, and `message` fields.

**3. Add the Teams action**

8. Click **"+ New step"** (or the **+** button below the trigger)
9. In the **"Choose an operation"** search box, type: **`Post message in a chat or channel`**

    > **Can't find it?** Microsoft has multiple Teams connectors. Try these alternatives:
    >
    > - Search for **`Microsoft Teams`** first, click on the connector, then browse its actions
    > - Look for **"Post message in a chat or channel (V2)"** — this is the newer version
    > - If you see **"Chat or channel"** as a category, expand it
    > - Try searching for just **`chat`** or **`Teams`** and scroll through results
    > - If you're on the new Power Automate designer (2024+), click **"Add an action"** → type **`Teams`** → look under **"Microsoft Teams"** connector → select **"Post message in a chat or channel"**

10. Once you find and select the action, configure it:

**4. Configure the Teams action fields**

11. **Post as**: Choose **"Flow bot"** (sends as a bot — no extra permissions needed) or **"User"** (sends as you — requires Teams permissions)

12. **Post in**: Select **"Chat with Flow bot"**

    > This creates a 1:1 chat between the Flow bot and the recipient. If you chose "User" above, select **"Chat with a user"** instead.

13. **Recipient**: Click the field, then click the ⚡ lightning bolt icon (or **"Add dynamic content"**). Select **`recipientEmail`** from the dynamic content list.

14. **Message**: Click the field, click ⚡ dynamic content, select **`message`**.

    > **Optional**: For a richer message, switch to the code view and use HTML:
    >
    > ```html
    > <b>PR Review Reminder</b><br /><br />@{triggerBody()?['message']}
    > ```

**5. Save and get the URL**

15. Click **"Save"** in the top-right corner
16. After saving, click on the **"When an HTTP request is received"** trigger card to expand it
17. You'll now see the **"HTTP POST URL"** field populated with a long URL starting with `https://prod-*.logic.azure.com:443/workflows/...`
18. Click the 📋 **copy** button next to the URL

**6. Configure in PReminder**

19. Paste the URL into `.env.local` as the default for all users:
    ```bash
    POWER_AUTOMATE_FLOW_URL=https://prod-XX.logic.azure.com:443/workflows/...
    ```
20. Set `ENABLE_TEAMS_DM=true` in `.env.local` to activate the feature
21. **(Optional)** Users can override this per-account in **Settings → Integrations** within the PReminder UI. The UI value (stored encrypted in DB) takes priority over the env var.

#### Visual reference (action path)

```
When an HTTP request is received
        │
        ▼
Post message in a chat or channel
  ├─ Post as:    Flow bot
  ├─ Post in:    Chat with Flow bot
  ├─ Recipient:  ⚡ recipientEmail
  └─ Message:    ⚡ message
```

#### Alternative: "Post a message as the Flow bot to a user" (simpler)

If you still can't find the chat action, search for this exact name instead:

- **`Post a message as the Flow bot to a user`** (under Microsoft Teams connector)
- This is a simpler action with only two fields:
    - **Recipient**: ⚡ `recipientEmail`
    - **Message**: ⚡ `message`
- It always posts as the Flow bot — no "Post as" choice needed

#### Testing

```bash
# Test the flow directly
curl -X POST "<YOUR_FLOW_URL>" \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail":"your.email@company.com","subject":"Test","message":"Hello from PReminder!"}'
```

You should receive a Teams DM within seconds.

**Rate limits**: Free Power Automate allows ~750 flow runs/day. Premium is unlimited.

### 5B. Teams Deep Links (Fallback — Zero Config)

If Power Automate is not available, PReminder can open Teams with a pre-filled message. You just click Send.

**How it works**: The app generates a URL like:

```
https://teams.microsoft.com/l/chat/0/0?users=john.doe@company.com&message=Hi%20John...
```

Clicking it opens the Teams desktop app (which must be running locally) with a chat to that person and the message pre-filled.

**Limitation**: You must manually click Send in Teams. The message is not sent automatically.

### 5C. Incoming Webhooks (Channel Posts)

For posting reminders to a whole team channel.

1. In Teams → Go to the channel → **⋯** → **Connectors** → **Incoming Webhook**
2. Name it: `PReminder`
3. Copy the webhook URL
4. In PReminder, go to **Settings → Integrations → Add Channel Webhook**

---

## 6. Email Setup

### 6A. Mailto Links (Always Available — Zero Config)

PReminder generates `mailto:` links with pre-filled To, Subject, and Body from your saved template. Clicking opens your default email client.

No setup required. Works immediately.

### 6B. Microsoft Graph API (Fully Automated)

Sends emails as yourself through Outlook. Requires Azure AD app registration.

**Prerequisites**: Access to Azure AD / Entra ID (even without admin — see below).

#### Step-by-step

1. Go to **[portal.azure.com](https://portal.azure.com)** → **Azure Active Directory** → **App registrations** → **New registration**
2. Name: `PReminder`
3. Supported account types: **"Accounts in this organizational directory only"**
4. Redirect URI: **Web** → `http://localhost:3000/api/auth/callback/azure-ad`
5. Click **Register**
6. Copy **Application (client) ID** → `AZURE_AD_CLIENT_ID`
7. Copy **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`
8. Go to **Certificates & secrets** → **New client secret** → Copy value → `AZURE_AD_CLIENT_SECRET`
9. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → Add:
    - `Mail.Send` — Send mail as user
    - `User.Read` — Sign in and read user profile
10. If you don't have admin: click **"Grant admin consent"** — if greyed out, ask an admin, or the app will prompt users individually for consent.

#### Enable in `.env.local`

```bash
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_ENABLE_GRAPH_EMAIL=true
```

---

## 7. Desktop Notifications

PReminder uses the **Web Notifications API** to send Windows toast notifications.

### Requirements

- Browser must support Notifications API (all modern browsers do)
- User must grant notification permission when prompted
- PReminder tab must be open (or Service Worker registered for background)

### Configuration

In PReminder **Settings → Notifications**:

| Setting                         | Default | Options                       |
| ------------------------------- | ------- | ----------------------------- |
| Enable notifications            | Off     | On/Off                        |
| Check interval                  | 60 min  | 15min, 30min, 60min, 2hr, 4hr |
| Notify for stale PRs older than | 4 hours | 1hr, 2hr, 4hr, 8hr, 24hr      |
| Sound                           | Off     | On/Off                        |

---

## 8. First Run

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma client
pnpm db:generate

# 3. Apply database migrations
pnpm db:migrate

# 4. Seed default templates
pnpm db:seed

# 5. Start dev server
pnpm dev

# 6. Open http://localhost:3000
#    → Click "Sign in with GitHub"
#    → Authorize the OAuth app
#    → Grant org access if prompted
#    → You're on the Dashboard!
```

---

## 9. Multi-Environment Strategy

PReminder uses **one env file per environment**, all gitignored. Next.js auto-loads `.env.local` for local dev. For other environments, the `prisma-cli.mjs` wrapper accepts `--env-file` and deployment platforms inject env vars directly.

### Env File Layout

| File              | Purpose               | Loaded by                                   |
| ----------------- | --------------------- | ------------------------------------------- |
| `.env.local`      | Local development     | Next.js (auto), `prisma-cli.mjs` (default)  |
| `.env.staging`    | Staging deployment    | `prisma-cli.mjs --env-file .env.staging`    |
| `.env.production` | Production deployment | `prisma-cli.mjs --env-file .env.production` |
| `.env.example`    | Documented template   | Committed to repo — never contains secrets  |

> All env files except `.env.example` are in `.gitignore`. **Never commit secrets.**

### How Each Environment Works

#### Local Development (`.env.local`)

Next.js automatically loads `.env.local` at startup — no extra config needed. Prisma CLI reads it via `scripts/prisma-cli.mjs`:

```bash
pnpm dev              # Next.js loads .env.local
pnpm db:migrate       # prisma-cli.mjs loads .env.local
pnpm db:studio        # prisma-cli.mjs loads .env.local
```

#### Staging (`.env.staging`)

Create `.env.staging` with staging DB/API credentials (same format as `.env.local`). Use it with Prisma CLI:

```bash
# Run migrations against staging DB
pnpm db:migrate:staging

# Or any Prisma command
node scripts/prisma-cli.mjs --env-file .env.staging studio
```

For the Next.js app in staging, set env vars on the **deployment platform** (Vercel, Azure, etc.) — not via files.

#### Production (`.env.production`)

Same pattern. Create `.env.production` for local Prisma CLI operations against production:

```bash
# Deploy migrations to production DB
pnpm db:migrate:production

# Open studio against production (read-only recommended)
node scripts/prisma-cli.mjs --env-file .env.production studio
```

For the running Next.js app, inject env vars via:

- **Vercel** → Project Settings → Environment Variables
- **Azure App Service** → Configuration → Application Settings
- **AWS** → Secrets Manager → injected at container start
- **Docker** → `docker run --env-file .env.production` or Kubernetes Secrets

### Creating a New Environment File

```bash
# Copy the template
cp .env.example .env.staging

# Fill in staging values
# DB_HOST=staging-db.yourcompany.com
# DB_PORT=5432
# DB_USER=preminder_staging
# DB_PASSWORD=<from-vault>
# DB_NAME=preminder_staging
# ...
```

### Summary

| Task                         | Command                                               |
| ---------------------------- | ----------------------------------------------------- |
| Local dev server             | `pnpm dev`                                            |
| Migrate local DB             | `pnpm db:migrate`                                     |
| Migrate staging DB           | `pnpm db:migrate:staging`                             |
| Migrate production DB        | `pnpm db:migrate:production`                          |
| Any Prisma cmd with env file | `node scripts/prisma-cli.mjs --env-file <file> <cmd>` |

---

## 10. Troubleshooting

### "Invalid environment variables" on startup

The app validates all required env vars via Zod. Check the error output — it tells you exactly which variable is missing or malformed. Verify your `.env.local` matches `.env.example`.

### Database connection keeps retrying

PReminder retries up to 5 times with exponential back-off. Check `logs/db-connection.log` at the project root for detailed timestamps and error messages. Common causes:

- PostgreSQL service not running → `net start postgresql-x64-16` (Windows) or `sudo systemctl start postgresql` (Linux)
- Wrong credentials → verify `DB_USER` / `DB_PASSWORD` match what you created in PostgreSQL
- Wrong host/port → verify `DB_HOST` and `DB_PORT` (default: `localhost:5432`)
- Firewall blocking → check Windows Firewall or cloud security groups

### "Bad credentials" from GitHub API

Your GitHub OAuth token may have expired or been revoked. Sign out and sign in again. If persistent, regenerate the OAuth App client secret.

### "Org access denied"

The OAuth App needs to be approved by an org admin. Ask the admin to go to:
`https://github.com/organizations/<ORG>/settings/oauth_application_policy`

### Power Automate flow not triggering

- Verify the flow is **turned on** in Power Automate
- Test the HTTP URL directly with curl (see section 5A)
- Check flow run history in Power Automate for error details
- Ensure the recipient email matches a real Teams user in your organization

### Prisma migration errors

```bash
# Reset everything (destructive — dev only!)
pnpm db:reset

# If migration conflicts:
pnpm db:migrate -- --name fix_schema
```

### Docker build fails

Ensure Docker Desktop is running. Check that `.env.local` is present with the required variables.

```bash
# Build with verbose output
docker build -t preminder:latest -f docker/Dockerfile . --progress=plain
```
