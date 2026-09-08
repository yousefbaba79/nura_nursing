# Nura Lactation — Lactation Consultant Client Management System

A secure, responsive web application for lactation consultants to manage clients, babies,
consultations, recommendations, action items, and follow-ups. Built to the MVP scope defined
in the product requirements document (clients, babies, visits with draft autosave, problems,
recommendations, action items, follow-ups, consent tracking, client-friendly visit summaries,
audit logging, and responsive mobile design).

## Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, SQLite (swap the `DATABASE_URL` in
  `backend/.env` for a Postgres/MySQL connection string in production — Prisma supports both
  with a one-line `provider` change in `schema.prisma`), JWT auth, bcrypt, PDFKit.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Axios.

## Project layout

```
backend/    Express API (src/routes, src/middleware, prisma/schema.prisma)
frontend/   React SPA (src/pages, src/components, src/api)
```

## Running locally

### 1. Backend

```bash
cd backend
npm install
npx prisma migrate deploy   # creates backend/prisma/dev.db
npm run dev                 # http://localhost:4000
```

Environment variables live in `backend/.env` (already populated with dev defaults — replace
`JWT_SECRET` before deploying anywhere real). Key ones:

- `DATABASE_URL` — SQLite file path (default `file:./dev.db`)
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CORS_ORIGIN` — must match the frontend's origin

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

- **SQLite for the MVP**: zero external services to stand up; the schema avoids native
  enum columns (SQLite/Prisma limitation) in favor of validated string fields, so moving to
  Postgres later is a `provider` + `DATABASE_URL` change, no schema rewrite.
- **Password reset without an email provider**: `POST /api/auth/forgot-password` generates a
  reset token and returns it directly in the (non-production) response instead of silently
  failing, so the full reset flow can be exercised end-to-end. Wire up a real email provider
  before shipping to real users — the endpoint returns a generic message either way to avoid
  leaking which emails have accounts.
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
