---
applyTo: '**'
---

# PReminder — GitHub Copilot Instructions

## Project Overview

PReminder is a Next.js 15 SPA for tracking open GitHub PRs across an organization and sending review reminders via Teams DM (Power Automate) and Teams channels (Incoming Webhooks). Built with TypeScript, SCSS Modules, Prisma ORM, and NextAuth.js v5. Phases 0–4 are complete; Phase 5 (email, desktop notifications) is planned.

## Tech Stack

- Next.js 15 (App Router), TypeScript 5.x strict, SCSS Modules
- Prisma ORM (PostgreSQL), NextAuth.js v5, TanStack Query v5, Zustand
- Radix UI Primitives, Vitest + React Testing Library
- pnpm package manager

## Conventions

- Functional components only. Server Components by default, `'use client'` when needed.
- SCSS Modules for styles. CSS Custom Properties for theme colors (`var(--color-*)`).
- Zod validation on all API route inputs. Prisma for all DB access.
- Service layer in `src/lib/` for external APIs. No direct API calls from components.
- All API routes authenticate via `authenticateUser(request)` from `src/lib/auth-utils.ts`.
- Logger: use `createLogger(context)` from `src/lib/logger.ts`. No `console.log` in production code.
- Tests live in `src/tests/` mirroring source structure. Run `pnpm test:api`, `pnpm test:components`, `pnpm test:lib`, etc. for focused runs.
- Commit format: `<type>(<scope>): <summary>`

## Key Docs

- `README.md` — Full project overview and quick start
- `ARCHITECTURE.md` — System design, data flow, API routes
- `SETUP.md` — Step-by-step setup with all API keys
- `PLAN.md` — Development roadmap (Phases 0–6 + backlog)
- `docs/API.md` — API route reference
- `docs/TEAMS-INTEGRATION.md` — Power Automate + Webhook setup
- `docs/DATABASE.md` — Schema, migrations, encryption
- `docs/TEMPLATES.md` — Template engine, variable reference
- `docs/DEPLOYMENT.md` — Vercel, Docker, Azure deployment

## Rules

- No `any` types. No inline styles. No raw SQL.
- Encrypt secrets before DB storage using `src/lib/db/encryption.ts`. Check auth in all API routes via `src/lib/auth-utils.ts`.
- WCAG 2.1 AA accessibility. Semantic HTML. Keyboard navigation.
- Do NOT install dependencies or run scripts automatically — recommend to user.
