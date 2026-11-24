# Deploying to Cloudflare

The backend is a [Hono](https://hono.dev) app running on Cloudflare Workers, backed by
a Cloudflare D1 (SQLite) database via Prisma's D1 driver adapter. The frontend is a
static React build served from Cloudflare Pages.

This replaces the previous Render deployment (Express + Postgres + static site). Because
Render's free Postgres database expired, there is no data to migrate — this is a fresh
start, and the consultant account must be recreated via the `/setup` flow once the app is
live.

## One-time setup

You need a Cloudflare account and the `wrangler` CLI authenticated:

```bash
cd backend
npx wrangler login
```

### 1. Create the D1 database

```bash
npx wrangler d1 create nura-nursing-db
```

This prints a `database_id`. Copy it into `backend/wrangler.toml`, replacing the
placeholder:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nura-nursing-db"
database_id = "<paste-the-real-id-here>"
```

### 2. Apply the database schema

```bash
npm run db:migrate:remote
```

This runs the SQL in `backend/migrations/0001_init.sql` against the real D1 database.

### 3. Set the JWT secret

This must never go in `wrangler.toml` (it's committed to git). Set it as an encrypted
Worker secret instead:

```bash
npx wrangler secret put JWT_SECRET
```

When prompted, paste a long random string, e.g. generated with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Create the backup bucket

The Worker backs up the whole database every night to a private R2 bucket (see
[Backups](#backups) below). Create the bucket once, **before** the first deploy — the
deploy fails if the bucket doesn't exist:

```bash
npx wrangler r2 bucket create nura-nursing-backups
```

(R2 must be enabled on the account first: Cloudflare dashboard → **R2 Object Storage**.)

### 5. Deploy the Worker

```bash
npm run deploy
```

This runs `prisma generate` then `wrangler deploy`. Wrangler prints the Worker's URL,
e.g. `https://nura-nursing-api.<your-subdomain>.workers.dev`. Keep this URL — the
frontend needs it.

### 6. Deploy the frontend to Cloudflare Pages

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick
this repository, and set:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm install && npm run build` |
| Build output directory | `dist` |

Add an environment variable on the Pages project:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://nura-nursing-api.<your-subdomain>.workers.dev/api` (the Worker URL from step 5, plus `/api`) |

Deploy. Cloudflare prints the Pages URL, e.g. `https://nura-nursing-app.pages.dev`.

### 7. Point the backend's CORS at the real frontend URL

Edit `backend/wrangler.toml`:

```toml
[vars]
CORS_ORIGIN = "https://nura-nursing-app.pages.dev"
JWT_EXPIRES_IN = "8h"
ENVIRONMENT = "production"
```

Then redeploy the Worker so it picks up the new value:

```bash
cd backend
npm run deploy
```

(`ENVIRONMENT = "production"` also turns off the `devResetToken` field the
`/forgot-password` endpoint otherwise includes in its response for local testing.)

### 8. Create the consultant account

Visit the Pages URL and go through the first-run `/setup` flow to create the one
consultant account the app supports.

## Backups

All app data lives in the D1 database, and it is protected in two ways:

1. **D1 Time Travel** (built in, nothing to set up) — restore to any minute in the last
   30 days (Workers Paid) or 7 days (Free):
   ```bash
   npx wrangler d1 time-travel restore nura-nursing-db --timestamp=2026-11-20T10:00:00Z
   ```
2. **Daily backups to R2** — a cron trigger on the Worker (`[triggers]` in
   `wrangler.toml`, 02:17 UTC daily) runs `src/lib/backup.ts`, which writes a gzipped SQL
   dump of every table to `nura-nursing-backups/d1/nura-backup-<timestamp>.sql.gz`.
   Backups older than `BACKUP_RETENTION_DAYS` (default 90) are deleted automatically.

The bucket holds client health information: keep it private (never enable public
access or an r2.dev URL on it).

### Checking backups

Cloudflare dashboard → **R2 → nura-nursing-backups → d1/** lists every backup. The
Worker's **Logs** tab shows `Backup stored: …` (or `Backup failed: …`) for each nightly
run. To trigger one immediately, use **Workers → nura-nursing-api → Settings → Trigger
events → cron → Test**, or locally:

```bash
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=17+2+*+*+*"
```

### Downloading and restoring a backup

```bash
npx wrangler r2 object get nura-nursing-backups/d1/nura-backup-<timestamp>.sql.gz --remote --file=backup.sql.gz
gunzip backup.sql.gz
```

The dump includes the schema, so restore it into an **empty** database — e.g. a new one,
then point `database_id` in `wrangler.toml` at it and redeploy:

```bash
npx wrangler d1 create nura-nursing-db-restored
npx wrangler d1 execute nura-nursing-db-restored --remote --file=backup.sql
```

Delete the downloaded `.sql` file when done — it contains client data and must never be
committed to git.

## Local development

```bash
cd backend
cp .dev.vars.example .dev.vars   # then edit JWT_SECRET to any random string
npm install
npm run db:migrate:local         # creates/updates the local D1 SQLite file
npm run dev                      # wrangler dev, listens on http://localhost:8787
```

```bash
cd frontend
npm install
cp .env.example .env.local       # VITE_API_URL already points at localhost:8787/api
npm run dev                      # vite, listens on http://localhost:5173
```

`wrangler dev --local` runs the full Workers + D1 stack entirely offline — no Cloudflare
account or network access required for local development.

## Notes on what changed from the Render/Postgres setup

- **Database**: Postgres → Cloudflare D1 (SQLite). The Prisma schema itself is unchanged
  (it never used Postgres-specific types), only the `datasource` block and the way
  `PrismaClient` is constructed (per-request, via the D1 binding, instead of a
  module-level singleton reading `DATABASE_URL`).
- **Web framework**: Express → Hono (Workers has no persistent Node process, so Express's
  model doesn't apply).
- **PDF export**: `pdfkit` cannot run on Workers — it reads its built-in fonts from disk,
  and Workers has no filesystem. The visit-summary PDF is now generated client-side in
  the browser (`jspdf`), from the same data and field selection the old server-side PDF
  used. The backend still logs a `VISIT_SUMMARY_EXPORTED` audit entry, via
  `POST /api/visits/:id/summary/exported`, which the frontend calls right after the PDF
  downloads.
- **Rate limiting**: the old per-IP `express-rate-limit` middleware has no Workers
  equivalent without extra infrastructure (KV/Durable Objects). The real security control
  for login brute-forcing was always the database-backed account lockout (5 failed
  attempts locks the account for 15 minutes), which is unchanged. For defense in depth,
  consider adding a [Cloudflare dashboard rate-limiting rule](https://developers.cloudflare.com/waf/rate-limiting-rules/)
  on `/api/auth/login` once the Worker is live.
- **Seed script removed**: `backend/prisma/seed.ts` used to connect to Postgres directly
  and isn't compatible with the D1 driver-adapter setup. It's no longer needed — creating
  the one consultant account is already handled by the `/setup` endpoint (step 7 above).

## Decommissioning Render

Once you've confirmed the Cloudflare deployment works end-to-end (login, creating a
client, a visit, and downloading a summary PDF), you can delete the `nura-nursing-api`
and `nura-nursing-app` services in the Render dashboard. There is no data left on Render
to lose — its free Postgres database already expired.
