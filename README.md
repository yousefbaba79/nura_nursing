# Nura Lactation — Lactation Consultant Client Management System

A secure, responsive web application for a lactation consultant to manage clients, their
babies (with weight history), and follow-ups. Includes consent tracking, reusable note
templates for follow-up notes, reports with CSV export, audit logging, and an English /
Hebrew / Arabic interface (Hebrew and Arabic are right-to-left).

Follow-ups are the single encounter record: each one is a clinic visit or video meeting that
is scheduled ahead of time and documented afterward (status, notes).

## Stack

- **Backend**: [Hono](https://hono.dev) on Cloudflare Workers, TypeScript, Prisma ORM (D1
  driver adapter), Cloudflare D1 (SQLite), JWT auth, bcrypt.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Axios,
  react-i18next, served from Cloudflare Pages.

## Project layout

```
backend/    Hono API on Cloudflare Workers (src/routes, src/middleware, prisma/schema.prisma)
frontend/   React SPA (src/pages, src/components, src/api)
```

## Deploying

See [`CLOUDFLARE_DEPLOY.md`](./CLOUDFLARE_DEPLOY.md) for the full Cloudflare Workers + D1 +
Pages deployment walkthrough.

## Running locally

### 1. Backend

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars   # then edit JWT_SECRET to any random string
npm run db:migrate:local         # creates/updates the local D1 SQLite file
npm run dev                      # wrangler dev, http://localhost:8787
```

`wrangler dev --local` runs the full Workers + D1 stack entirely offline — no Cloudflare
account or network access needed. Non-secret config (`CORS_ORIGIN`, `JWT_EXPIRES_IN`,
`ENVIRONMENT`) lives in `backend/wrangler.toml`; the one secret (`JWT_SECRET`) lives in
`backend/.dev.vars` locally (gitignored) and as a Worker secret in production.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local       # VITE_API_URL already points at localhost:8787/api
npm run dev                      # vite, http://localhost:5173
```

### First run

Visit the frontend URL. With no consultant account yet, you're routed to a one-time **setup**
screen to create the first consultant account (this endpoint locks itself once an account
exists — there's no public sign-up after that, matching the "internal tool" requirement that
clients never get accounts). From there, sign in normally.

## Notable design choices

- **No native database enums**: enumerated fields (client status, feeding method, follow-up type and status)
  are plain, validated `String` columns rather than native `enum` types, so adding a new
  allowed value is an application-code change, not a migration. This also made the move from
  Postgres to SQLite/D1 a zero-model-change migration.
- **Per-request Prisma client**: Workers has no persistent process to hold a database
  singleton in, so `createPrismaClient()` (`backend/src/lib/prisma.ts`) builds a fresh
  `PrismaClient` from the D1 binding on every request, wired in via Hono middleware
  (`backend/src/worker.ts`).
- **Password reset without an email provider**: `POST /api/auth/forgot-password` generates a
  reset token and always logs it server-side; it's only echoed back in the API response when
  `ENVIRONMENT` isn't `"production"`, so the full flow can be exercised end-to-end locally
  without leaking reset tokens to anyone who can reach the endpoint in a real deployment. Wire
  up a real email provider (Resend, Postmark, SendGrid — the integration point is right where
  that token is generated in `backend/src/routes/auth.ts`) before relying on self-service
  password reset in production; until then, retrieve the token from `wrangler tail` or the
  Cloudflare dashboard logs. The endpoint always returns the same generic message either way,
  to avoid leaking which emails have accounts.
- **Audit log**: sign-ins, client/baby/follow-up/note-template writes, archiving, and
  account changes are recorded server-side and are not editable through the API.
- **Login brute-force protection**: Workers has no persistent process for an in-memory
  per-IP rate limiter, so the real control is the database-backed account lockout (5 failed
  attempts locks the account for 15 minutes). See `CLOUDFLARE_DEPLOY.md` for adding a
  Cloudflare dashboard rate-limiting rule as defense in depth.

## Testing

There is no automated test suite. Verify changes by running the backend and frontend locally
(`wrangler dev --local` + `vite`) and exercising the app in a browser (e.g. Playwright +
Chromium): first-run setup → login → client list/detail → baby creation → follow-ups →
reports → audit log.
