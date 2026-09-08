# Nura Lactation — Lactation Consultant Client Management System

A secure, responsive web application for lactation consultants to manage clients, babies,
consultations, recommendations, action items, and follow-ups. Built to the MVP scope defined
in the product requirements document (clients, babies, visits with draft autosave, problems,
recommendations, action items, follow-ups, consent tracking, client-friendly visit summaries,
audit logging, and responsive mobile design).

## Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, JWT auth, bcrypt, PDFKit.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Axios.

## Project layout

```
backend/    Express API (src/routes, src/middleware, prisma/schema.prisma)
frontend/   React SPA (src/pages, src/components, src/api)
```

## Deploying

See [`DEPLOY.md`](./DEPLOY.md) for a one-click Render deployment (`render.yaml` provisions a
Postgres database, the API, and the frontend automatically).

## Running locally

### 0. Database

The app runs against Postgres everywhere, including locally. The easiest way to get one running:

```bash
docker compose up -d        # from the repo root — starts Postgres on localhost:5432
```

(No Docker available? Point `DATABASE_URL` in `backend/.env` at any Postgres instance you
already have instead.)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # already points at the docker-compose Postgres from step 0
npx prisma migrate deploy
npm run dev                 # http://localhost:4000
```

Environment variables live in `backend/.env` (see `backend/.env.example` for what each one
does — replace `JWT_SECRET` before deploying anywhere real). Key ones:

- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CORS_ORIGIN` — must match the frontend's origin
- `NODE_ENV` — set to `production` in real deployments (see notes below)

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

`frontend/.env` sets `VITE_API_URL` (default `http://localhost:4000/api`).

### First run

Visit the frontend URL. With no consultant account yet, you're routed to a one-time **setup**
screen to create the first consultant account (this endpoint locks itself once an account
exists — there's no public sign-up after that, matching the "internal tool" requirement that
clients never get accounts). From there, sign in normally.

Alternatively, seed a known account non-interactively:

```bash
cd backend
SEED_EMAIL=consultant@example.com SEED_PASSWORD='ChangeMe123!' npx tsx prisma/seed.ts
```

## Notable design choices

- **No native Postgres enums**: enumerated fields (client status, visit type, priority, etc.)
  are plain, validated `String` columns rather than Postgres `enum` types, so adding a new
  allowed value is an application-code change, not a migration.
- **Password reset without an email provider**: `POST /api/auth/forgot-password` generates a
  reset token and always logs it server-side; it's only echoed back in the API response
  outside of `NODE_ENV=production`, so the full flow can be exercised end-to-end locally
  without leaking reset tokens to anyone who can reach the endpoint in a real deployment. Wire
  up a real email provider (Resend, Postmark, SendGrid, plain SMTP — the integration point is
  right where that token is generated in `backend/src/routes/auth.ts`) before relying on
  self-service password reset in production; until then, retrieve the token from the server
  logs. The endpoint always returns the same generic message either way, to avoid leaking
  which emails have accounts.
- **Visit drafts**: creating a new visit immediately creates a `DRAFT` row server-side, so
  autosave (debounced `PATCH /visits/:id/draft`) always has something to write to and a
  consultant can navigate away and resume later without losing work.
- **Client summaries never leak private data**: `privateNotes`, internal assessments, and
  audit information are excluded at the API layer (`GET /visits/:id/summary`), not just
  hidden in the UI — the consultant explicitly selects which recommendations/action items to
  share before generating a PDF or copying text.
- **Audit log**: sign-ins, client/visit/baby writes, archiving, and summary exports are
  recorded server-side and are not editable through the API.

## Testing performed

The full golden path was exercised with an automated browser (Playwright + Chromium) against
a fresh database: first-run setup → client creation with duplicate-detection → baby record →
new visit with autosaved draft → problem/recommendation/action item → completing the visit →
generating a client summary (verified private notes are excluded from the output) → PDF
download → scheduling a follow-up → dashboard/search/list/settings/audit-log pages → a mobile
viewport pass (390×844, confirmed no horizontal scroll, bottom tab nav). No console or page
errors were observed on the final run.
