# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Nura Lactation — an internal client-management tool for a lactation consultant (clients, babies + weight logs, follow-ups, note templates, reports, audit log). Two independent npm projects, no root package.json:

- `backend/` — Hono API on Cloudflare Workers, Prisma (D1 driver adapter) over Cloudflare D1 (SQLite).
- `frontend/` — React 19 + Vite + Tailwind SPA (TanStack Query, Axios, react-i18next), deployed to Cloudflare Pages.

**Follow-up is the sole encounter record** — Visits, Problems, Recommendations, Action Items and visit summaries were removed; don't reintroduce them from old migrations or git history.

## Commands

Backend (`cd backend`, Node 22):
```bash
cp .dev.vars.example .dev.vars   # sets JWT_SECRET (required locally)
npm run db:migrate:local         # apply migrations/ to local D1 (.wrangler/)
npm run dev                      # wrangler dev → http://localhost:8787
npm run build                    # prisma generate (needed after schema.prisma changes)
npm run typecheck                # tsc --noEmit
npm run db:migrate:remote        # apply migrations to production D1
npm run deploy                   # prisma generate && wrangler deploy
```

Frontend (`cd frontend`):
```bash
cp .env.example .env.local       # VITE_API_URL=http://localhost:8787/api
npm run dev                      # http://localhost:5173
npm run build                    # tsc -b && vite build (this is the typecheck)
npm run lint                     # oxlint
```

There is no automated test suite. Verification has been done by running both dev servers and driving the app with Playwright. On first run with an empty DB the app routes to `/setup` to create the single consultant account (the endpoint locks once an account exists).

Deployment details (D1 creation, `wrangler secret put JWT_SECRET`, Pages config) are in `CLOUDFLARE_DEPLOY.md`.

## Architecture

### Backend
- `src/worker.ts` is the entry point: applies secure headers, CORS (from `CORS_ORIGIN`, comma-separated), builds a **fresh PrismaClient per request** from the `DB` binding (`lib/prisma.ts`) and stores it in Hono context, then mounts route modules under `/api/*`. Handlers get it via `c.get("prisma")`.
- Each `src/routes/*.ts` is its own `Hono<AppEnv>` sub-app that calls `app.use(authenticate)` (except public parts of `auth.ts`). `authenticate` verifies the JWT and sets `consultantId`; **every query is scoped by `consultantId`** (look up with `findFirst({ where: { id, consultantId } })` and 404 if missing before updating/deleting).
- Input validation uses zod `safeParse`; errors return `{ error: "<user-facing message>" }` with a 4xx. The global `onError` returns a generic 500 and avoids logging sensitive data.
- Writes call `recordAudit()` (`lib/audit.ts`) with an `ACTION_NAME` / entity type. It swallows its own failures. The audit log is read-only via the API.
- Env bindings/vars are typed in `src/types.ts`; non-secret vars live in `wrangler.toml`, `JWT_SECRET` in `.dev.vars` / Worker secret. `ENVIRONMENT !== "production"` causes password-reset tokens to be echoed in the API response (no email provider is wired up).

### Schema changes (two places, kept in sync by hand)
Wrangler runs plain SQL migrations; Prisma is only used for the client. When changing the data model:
1. Edit `backend/prisma/schema.prisma`, then `npm run build` to regenerate the client.
2. Add a new numbered SQL file in `backend/migrations/` (`000N_description.sql`) with the matching DDL (SQLite; table drops are wrapped in `PRAGMA foreign_keys=off/on`), then `npm run db:migrate:local`.

Enumerated fields are plain `String` columns, not DB enums. Allowed values are defined in **both** `backend/src/utils/enums.ts` (used by zod) and `frontend/src/api/enums.ts` (plus status color maps) — update both, and add translation keys for new values.

### Frontend
- `src/api/client.ts`: Axios instance with JWT from localStorage ("remember me") or sessionStorage; a 401 clears the token and redirects to `/login`. Use `apiErrorMessage()` for user-facing errors. Response shapes are hand-written in `src/api/types.ts` (mirror backend changes there).
- `src/App.tsx` defines routes; authenticated pages render inside `components/Layout.tsx`. `AuthContext` holds the session; `useInactivityLogout` auto-logs out idle users.
- Shared UI primitives are in `components/ui.tsx`; date/number formatting goes through `lib/format.ts` (forces Latin digits for Arabic).
- **i18n is mandatory for UI text**: English, Hebrew and Arabic (`src/i18n/locales/{en,he,ar}.json`). Add every new key to all three. Hebrew and Arabic are RTL — `document.dir` is set automatically, so use Tailwind logical utilities (`ms-/me-/ps-/pe-/start-/end-`), never `ml-/mr-/pl-/pr-/left-/right-`.
- `public/_redirects` provides the SPA fallback on Pages; `.env.production` sets the production API URL.
