# PReminder — GitHub PR Review Reminder SPA

> A modern, minimal SPA to track open pull requests across your GitHub organization, see who's blocking reviews, and send personalized reminders via Microsoft Teams DM, Teams channels, or email — all from a single dashboard.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![SCSS](https://img.shields.io/badge/SCSS-Modules-pink?logo=sass)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Teams Integration](#teams-integration)
- [Theme System](#theme-system)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Development Scripts](#development-scripts)
- [License](#license)

---

## Features

### Core

- **GitHub OAuth Login** — Sign in with your GitHub account (org-scoped)
- **Org Repo Browser** — Search/filter all repos in your GitHub organization
- **Open PR Dashboard** — View all open PRs per repo with real-time status
- **Reviewer Breakdown** — See exactly who each PR is pending on (individuals + team members)
- **Team/Group Expansion** — Auto-expand GitHub team reviewers to show all individual members

### Reminders

- **Bulk Select Reviewers** — Checkbox UI to pick individuals from the reviewer list
- **Teams DM** — Send personalized 1:1 messages via Power Automate HTTP trigger
- **Teams Channel** — Post Adaptive Cards to a team channel via Incoming Webhook
- **Reminder Log** — Full audit trail of sent reminders with status, method, and timestamp
- **Email Mapping** — Map GitHub usernames to corporate emails (manual overrides + auto-resolution via 4-level fallback)

### Templates

- **Custom Message Templates** — Create/edit/delete reusable reminder templates
- **Variable Interpolation** — `{receiverName}`, `{senderName}`, `{prTitle}`, `{prUrl}`, `{repoName}`, `{prNumber}`, `{prAge}`, `{reviewStatus}`, `{branchName}`, `{currentDate}`
- **Live Preview** — See rendered template output with sample data as you type
- **Per-Method Templates** — Separate templates for Teams DM, Teams Channel, and Email
- **Default Templates** — Pre-seeded templates ready to use out of the box

### UI/UX

- **Global Theme Switch** — Light / Dark / System with smooth transitions
- **Custom Color Schema** — Adjustable accent colors with CSS custom properties
- **SCSS Modules** — Scoped, maintainable styles with theme-aware variables
- **Responsive Design** — Mobile-first, works on all screen sizes
- **Skeleton Loaders** — Smooth loading states for all async data
- **Toast Notifications** — Success/error feedback for every action
- **Keyboard Shortcuts** — Power-user navigation (Cmd+K search, etc.)

### Infrastructure

- **Database Agnostic** — Prisma ORM with migration support (Supabase, Azure PostgreSQL, SQLite, etc.)
- **Deploy Anywhere** — Vercel, Netlify, Azure App Service, Docker, on-prem
- **Environment Validation** — Zod-based env validation — app won't start with missing vars
- **Rate Limit Awareness** — GitHub API rate limit display + smart caching
- **Encrypted Secrets** — Webhook URLs and tokens encrypted at rest with AES-256-GCM

---

## Tech Stack

| Layer                | Technology                              | Purpose                                      |
| -------------------- | --------------------------------------- | -------------------------------------------- |
| **Framework**        | Next.js 15 (App Router)                 | SSR + API routes, single deployable          |
| **Language**         | TypeScript 5.x                          | Type safety everywhere                       |
| **Styling**          | SCSS Modules + CSS Custom Properties    | Scoped styles, theme tokens                  |
| **UI Components**    | Radix UI Primitives + custom components | Accessible, unstyled base                    |
| **Auth**             | NextAuth.js v5 (Auth.js)                | GitHub OAuth, session management             |
| **Database**         | PostgreSQL via Prisma ORM               | Portable, migration-based schema             |
| **Data Fetching**    | TanStack Query v5                       | Caching, background refetch, optimistic UI   |
| **State**            | Zustand                                 | Lightweight global state (theme, user prefs) |
| **Teams DM**         | Power Automate HTTP Trigger             | Automated 1:1 messages via HTTP trigger      |
| **Teams Channel**    | Incoming Webhooks (Adaptive Cards)      | Channel posts to team channels               |
| **Email Mapping**    | GitHub API + Prisma                     | GitHub login → corporate email resolution    |
| **Containerization** | Docker + docker-compose                 | Azure / on-prem portability                  |
| **Linting**          | ESLint 9 + Prettier                     | Code quality                                 |
| **Testing**          | Vitest + React Testing Library          | Unit + component tests                       |

---

## Architecture

**Key principle**: Clean frontend/backend separation within the Next.js App Router.

```
┌─────────────────────────────────────────┐
│  Browser (React Client Components)      │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │Dashboard │ │PR Detail │ │Templates │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │             │             │       │
│  ─────┴─────────────┴─────────────┴───── │
│           TanStack Query Cache           │
│  ────────────────────────────────────── │
│           Zustand (Theme, Prefs)         │
└────────────────┬─────────────────────────┘
                 │ HTTP (fetch)
┌────────────────┴─────────────────────────┐
│  Next.js API Routes (Server)             │
│  ┌──────────┐ ┌────────┐ ┌────────────┐ │
│  │GitHub API│ │Remind  │ │Templates   │ │
│  │  Proxy   │ │Service │ │  CRUD      │ │
│  └────┬─────┘ └───┬────┘ └─────┬──────┘ │
│       │           │             │         │
│  ┌────┴───┐  ┌────┴────┐  ┌────┴─────┐  │
│  │GitHub  │  │Teams/   │  │Prisma    │  │
│  │REST API│  │Email    │  │(Database)│  │
│  └────────┘  └─────────┘  └──────────┘  │
└──────────────────────────────────────────┘
```

---

## Prerequisites

| Requirement          | Version     | How to Get                                                              |
| -------------------- | ----------- | ----------------------------------------------------------------------- |
| **Node.js**          | ≥ 20 LTS    | [nodejs.org](https://nodejs.org)                                        |
| **pnpm**             | ≥ 9.x       | `npm install -g pnpm`                                                   |
| **PostgreSQL**       | ≥ 15        | Supabase (free) or local install                                        |
| **GitHub Account**   | —           | With access to target org                                               |
| **GitHub OAuth App** | —           | [Create one →](https://github.com/settings/developers)                  |
| **Power Automate**   | —           | [make.powerautomate.com](https://make.powerautomate.com) (for Teams DM) |
| **Teams**            | Desktop app | Running locally for deep links                                          |

---

## Quick Start

```bash
# 1. Clone the repo
git clone <your-repo-url> PReminder
cd PReminder

# 2. Install dependencies
pnpm install

# 3. Copy environment file and fill in values
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)

# 4. Generate Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# 5. Seed default templates
pnpm db:seed

# 6. Start development server
pnpm dev
# → Open http://localhost:3000
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
# ━━━ Core ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                    # openssl rand -base64 32

# ━━━ GitHub OAuth ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GITHUB_CLIENT_ID=                   # GitHub OAuth App → Client ID
GITHUB_CLIENT_SECRET=               # GitHub OAuth App → Client Secret
GITHUB_ORG=                         # Your org slug (e.g., "my-company")

# ━━━ Database (split credentials) ━━━━━━━━━━━━━━━━━
DB_HOST=localhost
DB_PORT=5432
DB_USER=preminder
DB_PASSWORD=preminder
DB_NAME=preminder
DB_SCHEMA=public
# DB_SSL_MODE=require               # Uncomment for cloud databases

# ━━━ Encryption ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENCRYPTION_KEY=                     # openssl rand -hex 32 (64 chars)

# ━━━ Microsoft Graph (Optional — for email) ━━━━━━━
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# ━━━ Feature Flags ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_ENABLE_GRAPH_EMAIL=false
NEXT_PUBLIC_ENABLE_DESKTOP_NOTIFICATIONS=true
```

Full details in [SETUP.md](./SETUP.md).

---

## Database Setup

PReminder uses **Prisma ORM** for database-agnostic persistence. Database credentials are split into individual env vars (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) — no full connection string ever appears in config files. In production, inject each var from your secrets manager.

```bash
# Generate Prisma client from schema
pnpm db:generate

# Create/apply migrations
pnpm db:migrate

# Reset database (destructive)
pnpm db:reset

# Open Prisma Studio (GUI browser)
pnpm db:studio

# Seed default templates
pnpm db:seed
```

### Switching Databases

1. Update `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env.local`
2. Update `provider` in `prisma/schema.prisma` if switching database types (e.g., `postgresql` → `sqlite`)
3. Run `pnpm db:migrate` to apply schema to new database
4. Run `pnpm db:seed` to populate defaults

Full details in [SETUP.md](./SETUP.md).

---

## Teams Integration

### Method 1: Power Automate DM (Recommended — Fully Automated)

Send 1:1 Teams messages as yourself with zero admin consent required.

1. Create a Power Automate flow with HTTP trigger
2. Paste the flow URL into PReminder Settings → Integrations
3. Select reviewers → Click "DM on Teams" → Done

### Method 2: Teams Deep Links (Zero Config Fallback)

Opens Teams locally with pre-filled message. You click Send.

- No setup required — works if Teams desktop app is installed
- Limited to plain text messages

### Method 3: Incoming Webhooks (Channel Posts)

Post Adaptive Cards to team channels.

1. Create Incoming Webhook in Teams channel
2. Paste URL into PReminder Settings → Integrations
3. Reminders go to the whole channel

Full setup guide: [SETUP.md](./SETUP.md#teams-integration)

---

## Theme System

### Built-in Themes

| Theme      | Description                            |
| ---------- | -------------------------------------- |
| **Light**  | Clean white backgrounds, high contrast |
| **Dark**   | Deep slate backgrounds, easy on eyes   |
| **System** | Follows OS preference automatically    |

### Color Schema

The design system uses CSS Custom Properties with SCSS token generation:

```
Primary:    #6366F1 (Indigo 500)     — Actions, links, active states
Secondary:  #8B5CF6 (Violet 500)     — Accents, highlights
Success:    #10B981 (Emerald 500)    — Approved reviews, success toasts
Warning:    #F59E0B (Amber 500)      — Pending reviews, caution states
Danger:     #EF4444 (Red 500)        — Errors, changes requested
Neutral:    #64748B (Slate 500)      — Text, borders, backgrounds
```

### Customization

Users can adjust the accent color in Settings. The theme engine recomputes all derived colors (hover, active, disabled states) from the chosen accent.

---

## Deployment

### Vercel (Recommended for Getting Started)

```bash
pnpm build
vercel deploy --prod
# Set env vars in Vercel Dashboard → Settings → Environment Variables
```

### Netlify

```bash
pnpm build
# Set publish directory: .next
# Set env vars in Netlify Dashboard → Site settings → Environment variables
```

### Docker (Azure App Service / On-Prem)

```bash
# Build image
docker build -t preminder:latest -f docker/Dockerfile .

# Run locally
docker-compose -f docker/docker-compose.yml up

# Push to Azure Container Registry
az acr build --registry <acr-name> --image preminder:latest .
```

Full deployment guide: [SETUP.md](./SETUP.md#deployment)

---

## Project Structure

```
PReminder/
├── .claude/
│   └── rules/RULES.md              # AI agent coding rules
├── .github/
│   └── instructions/copilot-instructions.md
├── prisma/
│   ├── schema.prisma               # Database schema (User, Template, Integration, ReminderLog, EmailMapping)
│   ├── migrations/                 # Prisma migration history
│   └── seed.ts                     # Default template seeder
├── public/
│   ├── sw.js                       # Service Worker (Phase 5)
│   └── icons/
├── scripts/
│   └── prisma-cli.mjs              # Prisma CLI wrapper (composes DB URL from env vars)
├── src/
│   ├── middleware.ts               # Route protection — guards /dashboard/**
│   ├── app/
│   │   ├── layout.tsx              # Root layout (ThemeProvider, QueryProvider)
│   │   ├── page.tsx                # Landing — redirects to /dashboard
│   │   ├── login/page.tsx          # GitHub OAuth login page
│   │   ├── dashboard/
│   │   │   ├── layout.tsx          # Dashboard layout (AppShell)
│   │   │   ├── page.tsx            # Main dashboard (PR table)
│   │   │   ├── reminders/page.tsx  # Reminder log page
│   │   │   ├── templates/page.tsx  # Template editor page
│   │   │   └── settings/
│   │   │       ├── page.tsx        # Settings overview
│   │   │       └── integrations/page.tsx  # Integration configs
│   │   └── api/                    # ── API Routes (Backend) ──
│   │       ├── github/
│   │       │   ├── repos/route.ts          # GET: org repos (paginated)
│   │       │   ├── pulls/route.ts          # GET: open PRs per repo
│   │       │   ├── reviewers/route.ts      # GET: reviewer status per PR
│   │       │   └── debug/route.ts          # GET: GitHub API diagnostics
│   │       ├── reminders/
│   │       │   ├── route.ts                # GET: reminder log
│   │       │   ├── send/route.ts           # POST: TEAMS_DM | TEAMS_CHANNEL
│   │       │   └── cooldown/route.ts       # GET: per-reviewer cooldown status
│   │       ├── templates/
│   │       │   ├── route.ts                # GET/POST: list + create
│   │       │   └── [id]/route.ts           # GET/PUT/DELETE: single template
│   │       ├── integrations/
│   │       │   ├── route.ts                # GET/POST/DELETE: integration configs
│   │       │   └── test/route.ts           # POST: test an integration
│   │       └── email-mappings/
│   │           ├── route.ts                # GET/POST: email mappings
│   │           └── [id]/route.ts           # PUT/DELETE: single mapping
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-shell.tsx       # Session + layout wrapper
│   │   │   ├── sidebar.tsx         # Repo list, navigation, search
│   │   │   ├── header.tsx          # Breadcrumb, refresh, user menu
│   │   │   ├── theme-toggle.tsx    # Light/Dark/System toggle
│   │   │   └── user-menu.tsx       # Avatar dropdown, sign out
│   │   ├── pr/
│   │   │   ├── pr-table.tsx        # Sortable PR table with filters
│   │   │   ├── pr-detail-modal.tsx # PR details + reviewer breakdown modal
│   │   │   ├── reviewer-list.tsx   # Reviewer avatars + status badges
│   │   │   └── status-badge.tsx    # Color-coded review status badge
│   │   ├── reminders/
│   │   │   ├── bulk-action-bar.tsx     # Sticky bar for bulk reviewer actions
│   │   │   ├── reminder-flow-modal.tsx # Step-through: template → preview → send
│   │   │   └── reminder-log-table.tsx  # Sortable reminder history table
│   │   ├── settings/
│   │   │   ├── template-form.tsx       # Template editor with variable pills
│   │   │   ├── template-list.tsx       # Template CRUD list
│   │   │   └── template-preview.tsx    # Live template rendering preview
│   │   └── ui/
│   │       ├── card.tsx
│   │       ├── spline-scene.tsx
│   │       └── spotlight.tsx
│   ├── context/
│   │   ├── theme-provider.tsx      # Theme context + persistence
│   │   └── query-provider.tsx      # TanStack Query provider
│   ├── hooks/
│   │   ├── use-dashboard-store.ts  # Zustand: sidebar state, selected reviewers
│   │   ├── use-debounced-value.ts  # Debounce utility hook
│   │   ├── use-email-mappings.ts   # CRUD hooks for email mappings
│   │   ├── use-integrations.ts     # CRUD + test hooks for integrations
│   │   ├── use-pulls.ts            # Fetch open PRs per repo
│   │   ├── use-reminder-store.ts   # Zustand: reminder flow state (channel, recipients)
│   │   ├── use-reminders.ts        # Fetch + create reminder logs
│   │   ├── use-repos.ts            # Fetch org repos
│   │   ├── use-reviewers.ts        # Fetch reviewers per PR
│   │   ├── use-templates.ts        # CRUD hooks for templates
│   │   └── use-theme.ts            # Theme hook
│   ├── lib/
│   │   ├── auth.ts                 # NextAuth v5 config
│   │   ├── auth-utils.ts           # authenticateUser() helper for API routes
│   │   ├── cache.ts                # Server-side cache utilities
│   │   ├── env.ts                  # Zod env validation (app fails fast on missing vars)
│   │   ├── errors.ts               # Typed error classes + factory helpers
│   │   ├── logger.ts               # createLogger(ctx) factory + legacy singleton
│   │   ├── query-client.ts         # TanStack QueryClient factory
│   │   ├── utils.ts                # Shared utilities (dates, formatting)
│   │   ├── db/
│   │   │   ├── connection.ts       # URL composition + exponential retry back-off
│   │   │   ├── encryption.ts       # AES-256-GCM encrypt/decrypt for stored secrets
│   │   │   ├── logger.ts           # DB connection logger
│   │   │   └── prisma.ts           # Prisma client singleton
│   │   ├── email/
│   │   │   └── resolve.ts          # GitHub → email 4-level fallback resolver
│   │   ├── github/
│   │   │   └── client.ts           # GitHub REST API wrapper + response caching
│   │   ├── teams/
│   │   │   ├── deeplink.ts         # msteams:// URL generator
│   │   │   └── power-automate.ts   # Power Automate HTTP trigger client
│   │   └── templates/
│   │       └── engine.ts           # Template variable interpolation engine
│   ├── styles/
│   │   ├── globals.scss            # Global resets + base
│   │   ├── tailwind.css            # Tailwind CSS layer
│   │   ├── _variables.scss         # SCSS tokens + utility mixins
│   │   └── themes/
│   │       ├── _light.scss         # Light theme tokens
│   │       └── _dark.scss          # Dark theme tokens
│   ├── tests/
│   │   ├── setup.ts                # Vitest setup (jest-dom, cleanup)
│   │   ├── test-utils.tsx          # Custom render helpers
│   │   ├── api/                    # API route tests
│   │   ├── components/             # Component tests
│   │   ├── context/                # Context + provider tests
│   │   ├── hooks/                  # Hook tests
│   │   ├── lib/                    # Unit tests (email, github, templates, teams, logger)
│   │   └── pages/                  # Page integration tests
│   └── types/
│       ├── github.ts               # GitHub API types
│       ├── next-auth.d.ts          # NextAuth type augmentations
│       ├── reminders.ts            # Reminder flow types
│       └── templates.ts            # Template types
├── .env.example
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── README.md
├── SETUP.md
├── vitest.config.ts
└── tsconfig.json
```

---

## Development Scripts

| Script               | Command                | Description                       |
| -------------------- | ---------------------- | --------------------------------- |
| **Dev server**       | `pnpm dev`             | Start Next.js dev server on :3000 |
| **Build**            | `pnpm build`           | Production build                  |
| **Start**            | `pnpm start`           | Start production server           |
| **Lint**             | `pnpm lint`            | ESLint + Prettier check           |
| **Lint fix**         | `pnpm lint:fix`        | Auto-fix lint issues              |
| **Type check**       | `pnpm typecheck`       | TypeScript compiler check         |
| **Test**             | `pnpm test`            | Run all Vitest tests              |
| **Test watch**       | `pnpm test:watch`      | Vitest in watch mode              |
| **Test coverage**    | `pnpm test:coverage`   | Run tests with v8 coverage report |
| **Test: API**        | `pnpm test:api`        | API route tests only              |
| **Test: components** | `pnpm test:components` | Component tests only              |
| **Test: hooks**      | `pnpm test:hooks`      | Hook tests only                   |
| **Test: lib**        | `pnpm test:lib`        | Library unit tests only           |
| **Test: pages**      | `pnpm test:pages`      | Page integration tests only       |
| **DB generate**      | `pnpm db:generate`     | Generate Prisma client            |
| **DB migrate**       | `pnpm db:migrate`      | Run Prisma migrations             |
| **DB studio**        | `pnpm db:studio`       | Open Prisma Studio GUI            |
| **DB seed**          | `pnpm db:seed`         | Seed default data                 |
| **DB reset**         | `pnpm db:reset`        | Reset + re-seed database          |
| **Docker dev**       | `pnpm docker:dev`      | Start docker-compose dev stack    |
| **Docker build**     | `pnpm docker:build`    | Build production Docker image     |

---

## License

MIT — see [LICENSE](./LICENSE) for details.
