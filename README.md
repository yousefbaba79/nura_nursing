# Nura Lactation — Lactation Consultant Client Management System

A secure, responsive web application for lactation consultants to manage clients, babies,
consultations, recommendations, action items, and follow-ups. Built to the MVP scope defined
in the product requirements document (clients, babies, visits with draft autosave, problems,
recommendations, action items, follow-ups, consent tracking, client-friendly visit summaries,
audit logging, and responsive mobile design).

## Stack

- **Backend**: [Hono](https://hono.dev) on Cloudflare Workers, TypeScript, Prisma ORM (D1
  driver adapter), Cloudflare D1 (SQLite), JWT auth, bcrypt.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Axios,
  jsPDF (client-side visit-summary PDF export), served from Cloudflare Pages.

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

- **No native database enums**: enumerated fields (client status, visit type, priority, etc.)
  are plain, validated `String` columns rather than native `enum` types, so adding a new
  allowed value is an application-code change, not a migration. This also made the move from
  Postgres to SQLite/D1 a zero-model-change migration.
- **Per-request Prisma client**: Workers has no persistent process to hold a database
  singleton in, so `createPrismaClient()` (`backend/src/lib/prisma.ts`) builds a fresh
  `PrismaClient` from the D1 binding on every request, wired in via Hono middleware
  (`backend/src/worker.ts`).
- **PDF generation is client-side**: `pdfkit` (the original PDF library) reads its fonts from
  disk, which has no equivalent on Workers. The visit-summary PDF is generated in the browser
  with `jsPDF` instead, from the same selected fields; the backend still records a
  `VISIT_SUMMARY_EXPORTED` audit entry via `POST /api/visits/:id/summary/exported`.
- **Password reset without an email provider**: `POST /api/auth/forgot-password` generates a
  reset token and always logs it server-side; it's only echoed back in the API response when
  `ENVIRONMENT` isn't `"production"`, so the full flow can be exercised end-to-end locally
  without leaking reset tokens to anyone who can reach the endpoint in a real deployment. Wire
  up a real email provider (Resend, Postmark, SendGrid — the integration point is right where
  that token is generated in `backend/src/routes/auth.ts`) before relying on self-service
  password reset in production; until then, retrieve the token from `wrangler tail` or the
  Cloudflare dashboard logs. The endpoint always returns the same generic message either way,
  to avoid leaking which emails have accounts.
- **Visit drafts**: creating a new visit immediately creates a `DRAFT` row server-side, so
  autosave (debounced `PATCH /visits/:id/draft`) always has something to write to and a
  consultant can navigate away and resume later without losing work.
- **Client summaries never leak private data**: `privateNotes`, internal assessments, and
  audit information are excluded at the API layer (`GET /visits/:id/summary`), not just
  hidden in the UI — the consultant explicitly selects which recommendations/action items to
  share before generating a PDF or copying text.
- **Audit log**: sign-ins, client/visit/baby writes, archiving, and summary exports are
  recorded server-side and are not editable through the API.
- **Login brute-force protection**: Workers has no persistent process for an in-memory
  per-IP rate limiter, so the real control is the database-backed account lockout (5 failed
  attempts locks the account for 15 minutes). See `CLOUDFLARE_DEPLOY.md` for adding a
  Cloudflare dashboard rate-limiting rule as defense in depth.

## Testing performed

The full golden path was exercised against a local Workers + D1 stack (`wrangler dev --local`)
with an automated browser (Playwright + Chromium): first-run setup → login → client list/detail
→ baby creation → visit creation → client-friendly visit summary (verified private notes are
excluded from the output) → client-side PDF download → dashboard and audit-log endpoints. No
console or page errors were observed.
