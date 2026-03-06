# ─────────────────────────────────────────────────────────────
# PReminder — Multi-stage Docker build
# ─────────────────────────────────────────────────────────────
# Stage 1 (deps)    — install production + dev dependencies
# Stage 2 (builder) — generate Prisma client + build Next.js (standalone)
# Stage 3 (runner)  — minimal runtime image (~200MB)
#
# Build:
#   docker build -t preminder:latest -f docker/Dockerfile .
#
# Run locally:
#   docker run -p 3000:3000 --env-file .env.local preminder:latest
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ─────────────────────────────
FROM node:20-alpine AS deps

# Install libc compatibility for Prisma's native binary on Alpine
RUN apk add --no-cache libc6-compat

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Copy prisma schema so postinstall (prisma generate) can run
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (schema → TypeScript types)
RUN pnpm db:generate

ENV DOCKER_BUILD=true
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ── Stage 3: Production runner ────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone Next.js server (self-contained, no node_modules needed)
COPY --from=builder /app/.next/standalone ./
# Copy static assets (CSS, JS chunks, images)
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets (favicons, images, etc.)
COPY --from=builder /app/public ./public

EXPOSE 3000

# next.config.ts sets output: 'standalone' when DOCKER_BUILD=true,
# which produces server.js at the root of the standalone directory.
CMD ["node", "server.js"]
