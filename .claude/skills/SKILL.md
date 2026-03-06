# PReminder — AI Agent Skill File

## Project Overview

PReminder is a GitHub PR Review Reminder SPA built with Next.js 15 (App Router), TypeScript, SCSS Modules, and Prisma ORM. It authenticates via GitHub OAuth, displays open PRs across an organization, shows reviewer status, and sends reminders via Teams DM (Power Automate), Teams channels (Webhooks), and email (Graph API / mailto).

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components + Client Components)
- **Language**: TypeScript 5.x strict mode
- **Styling**: SCSS Modules + CSS Custom Properties for theming
- **Database**: PostgreSQL via Prisma ORM (migration-based, provider-agnostic)
- **Auth**: NextAuth.js v5 (Auth.js) with GitHub OAuth provider
- **State**: TanStack Query v5 (server state), Zustand (client state)
- **UI**: Radix UI Primitives, custom SCSS components
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint 9 + Prettier
- **Package Manager**: pnpm

## Directory Structure

```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── layout.tsx          # Root layout: ThemeProvider, QueryProvider
│   ├── page.tsx            # Landing: redirects to /dashboard
│   ├── login/page.tsx      # GitHub OAuth login page
│   ├── dashboard/
│   │   ├── layout.tsx      # Dashboard layout (AppShell)
│   │   ├── page.tsx        # Main dashboard (PR table)
│   │   ├── reminders/      # Reminder log page
│   │   ├── templates/      # Template editor page
│   │   └── settings/
│   │       ├── page.tsx    # Settings overview
│   │       └── integrations/ # Integration configs
│   └── api/                # API routes (backend)
│       ├── github/         # repos, pulls, reviewers, debug
│       ├── reminders/      # route, send, cooldown
│       ├── templates/      # route, [id]
│       ├── integrations/   # route, test
│       └── email-mappings/ # route, [id]
├── components/             # React components
│   ├── ui/                 # Reusable primitives (card, spotlight, spline-scene)
│   ├── pr/                 # pr-table, pr-detail-modal, reviewer-list, status-badge
│   ├── layout/             # app-shell, sidebar, header, theme-toggle, user-menu
│   ├── reminders/          # bulk-action-bar, reminder-flow-modal, reminder-log-table
│   └── settings/           # template-form, template-list, template-preview
├── context/                # React context providers
├── hooks/                  # Custom React hooks
│   ├── use-dashboard-store.ts  # Zustand: sidebar state + selected reviewers
│   ├── use-reminder-store.ts   # Zustand: reminder flow state (channel, recipients)
│   ├── use-integrations.ts     # CRUD + test hooks for integrations
│   ├── use-email-mappings.ts   # CRUD hooks for email mappings
│   ├── use-templates.ts        # CRUD hooks for templates
│   ├── use-reminders.ts        # Fetch + create reminder logs
│   ├── use-repos.ts / use-pulls.ts / use-reviewers.ts
│   └── use-theme.ts / use-debounced-value.ts
├── lib/                    # Server-side utilities
│   ├── auth.ts             # NextAuth v5 config
│   ├── auth-utils.ts       # authenticateUser() — used by all API routes
│   ├── cache.ts            # Server-side cache utilities
│   ├── errors.ts           # Typed error classes + factory helpers
│   ├── logger.ts           # createLogger(ctx) factory + legacy singleton
│   ├── env.ts              # Zod env validation
│   ├── utils.ts            # Shared utilities
│   ├── db/                 # Prisma client singleton + connection + encryption
│   ├── github/client.ts    # GitHub REST API wrapper + caching
│   ├── teams/              # deeplink.ts, power-automate.ts
│   ├── email/resolve.ts    # GitHub → email 4-level fallback resolver
│   ├── templates/engine.ts # Template variable interpolation
│   └── notifications/email-resolver.ts
├── styles/                 # SCSS files
│   ├── globals.scss
│   ├── _variables.scss     # SCSS design tokens
│   └── themes/             # _light.scss, _dark.scss
├── tests/                  # All tests in src/tests/ (mirroring source structure)
│   ├── api/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── lib/
│   └── pages/
└── types/                  # TypeScript type definitions
    ├── github.ts
    ├── next-auth.d.ts
    ├── reminders.ts
    └── templates.ts
```

## Conventions

### File Naming

- `page.tsx` — Next.js page (route segment)
- `layout.tsx` — Next.js layout (shared wrapper)
- `route.ts` — Next.js API route handler
- `*.module.scss` — SCSS Module (component-scoped styles)
- `use-*.ts` — React custom hook
- `*.test.ts(x)` — Test file
- `*.types.ts` — Type definition file

### Code Style

- Functional components only (no class components)
- Server Components by default; `'use client'` directive only when needed
- All API routes validate input with Zod schemas
- All database access through Prisma (no raw SQL)
- All external API calls through service layer in `src/lib/`
- SCSS Modules for all component styles — no inline styles
- CSS Custom Properties (`var(--color-*)`) for theme-aware colors
- No `any` types — use `unknown` and type narrowing

### Testing

- Vitest for unit tests, React Testing Library for component tests
- Test files live in `src/tests/` mirroring source structure: `src/tests/lib/templates/engine.test.ts` tests `src/lib/templates/engine.ts`
- Use per-module scripts: `pnpm test:api`, `pnpm test:components`, `pnpm test:lib`, `pnpm test:hooks`, `pnpm test:pages`
- Mock external services (GitHub API, Prisma, fetch) — no real network requests in tests
- Mock `@/lib/auth-utils` with `authenticateUser: vi.fn()` in API route tests

### Commit Messages

- Format: `<type>(<scope>): <summary>`
- Types: feat, fix, refactor, test, docs, style, chore, ci
- Examples: `feat(templates): add variable insertion pills`, `fix(teams): handle expired flow URL`

### Environment Variables

- All env vars validated at startup via `src/lib/env.ts` (Zod)
- Server-only vars: no `NEXT_PUBLIC_` prefix
- Client-exposed vars: `NEXT_PUBLIC_` prefix required
- Secrets never exposed to client bundle

## Key Files to Read

- `README.md` — Full project overview and quick start
- `ARCHITECTURE.md` — System design, data flow, API routes
- `SETUP.md` — Step-by-step setup with all API keys
- `PLAN.md` — Development roadmap (Phases 0–6 + backlog)
- `docs/API.md` — API route reference
- `docs/TEAMS-INTEGRATION.md` — Power Automate + Webhook setup
- `docs/DATABASE.md` — Schema, migrations, encryption
- `docs/TEMPLATES.md` — Template engine, variable reference
- `docs/DEPLOYMENT.md` — Vercel, Docker, Azure deployment
- `docs/FEATURES.md` — Detailed feature specifications
- `docs/COLOR-SCHEMA.md` — Theme tokens, color system

## Common Tasks

### Add a new API route

1. Create `src/app/api/<path>/route.ts`
2. Call `authenticateUser(request)` from `src/lib/auth-utils.ts` — return early on failure
3. Define Zod schema for request body validation
4. Call service layer functions from `src/lib/`
5. Use `createLogger('route-name')` from `src/lib/logger.ts` for logging
6. Return JSON response using typed error classes from `src/lib/errors.ts`
7. Add test to `src/tests/api/`
8. Add to `docs/API.md`

### Add a new database table

1. Add model to `prisma/schema.prisma`
2. Run `pnpm db:migrate -- --name describe_change`
3. Update seed if needed (`prisma/seed.ts`)
4. Add types to `src/types/`

### Add a new component

1. Create `src/components/<category>/<name>.tsx`
2. Create `src/components/<category>/<name>.module.scss`
3. Use CSS Custom Properties for theme colors
4. Write test in `src/tests/components/<name>.test.tsx`

### Add a new page

1. Create `src/app/dashboard/<route>/page.tsx` (all authenticated pages live under `dashboard/`)
2. Use Server Component for initial data — Client Components for interactivity
3. Add navigation entry in `src/components/layout/sidebar.tsx`
4. Add tests in `src/tests/pages/`
