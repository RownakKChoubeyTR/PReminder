# PReminder — AI Agent Rules

## Always Apply

### Code Quality

- Use TypeScript strict mode. No `any` types.
- All React components are functional. No class components.
- Server Components by default. Add `'use client'` only for interactivity/hooks/browser APIs.
- All styles via SCSS Modules (`.module.scss`). No inline styles, no global CSS leakage.
- Use CSS Custom Properties (`var(--color-*)`) for all colors. Never hardcode color values in components.
- All API route handlers validate request bodies with Zod schemas.
- All database operations through Prisma ORM. No raw SQL.
- All external API calls through the service layer in `src/lib/`. Never call GitHub/Teams/Graph APIs directly from components.

### Security

- Never expose secrets to client-side code. Only `NEXT_PUBLIC_*` vars are allowed in client components.
- Encrypt sensitive data (tokens, webhook URLs) before storing in database. Use `src/lib/db/encryption.ts`.
- Always check NextAuth session in API routes before processing requests.
- Validate and sanitize all user inputs. Never trust client data.

### Styling

- Import SCSS variables with `@use '../../styles/variables' as *;`
- Use semantic CSS tokens: `--color-primary`, `--color-bg-secondary`, `--color-text-primary`, etc.
- Follow the spacing scale from `_variables.scss` ($space-1 through $space-16).
- All interactive elements must have visible focus indicators for accessibility.

### Testing

- Use Vitest + React Testing Library.
- Mock external services. No real network requests.
- Test files live in `src/tests/` mirroring the source structure (e.g., `src/tests/lib/logger.test.ts` tests `src/lib/logger.ts`, `src/tests/components/pr-table.test.tsx` tests `src/components/pr/pr-table.tsx`).
- Prefer `getByRole` > `getByLabelText` > `getByText` > `data-testid`.
- Use per-module scripts for focused runs: `pnpm test:api`, `pnpm test:components`, `pnpm test:lib`, etc.

### Accessibility

- Semantic HTML elements (use `<button>` not `<div onClick>`).
- All images have `alt` text.
- All form inputs have associated labels.
- All interactive elements are keyboard navigable.
- Maintain WCAG 2.1 AA color contrast ratios.

### Internationalization

- User-facing strings should be extractable (plan for future i18n).
- Use relative date formatting (`Intl.RelativeTimeFormat`) not custom implementations.
- Date/number formatting via `Intl` APIs.

### Error Handling

- API routes return structured error responses: `{ error, code, details }`.
- Client components show user-friendly error messages with retry options.
- Use error boundaries for unexpected React errors.
- Log errors server-side. Never expose stack traces to clients.

### Performance

- Use TanStack Query for all server data. Set appropriate `staleTime`.
- Lazy-load heavy components with `React.lazy` / `next/dynamic`.
- Optimize images with `next/image`.
- Use pagination for all list endpoints. Never fetch all records.

### Logging and Auth

- Use `createLogger(context)` from `src/lib/logger.ts` in all server-side code. Do NOT use `console.log` directly.
- All API routes must call `authenticateUser(request)` from `src/lib/auth-utils.ts` and return early on auth failure. Never use `auth()` directly in routes.
- Use typed error classes from `src/lib/errors.ts` for structured error responses.

## Do NOT

- Do NOT install dependencies automatically. Recommend to the user.
- Do NOT run scripts automatically. Recommend which script to run.
- Do NOT use `console.log` in production code. Use a logger.
- Do NOT hardcode GitHub org names, URLs, or credentials.
- Do NOT bypass TypeScript type checking with `@ts-ignore` or `as any`.
- Do NOT create barrel files (index.ts re-exports). Import directly from source.
- Do NOT use `useEffect` for data fetching. Use TanStack Query hooks.
