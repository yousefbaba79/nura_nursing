# Deploying to Render

This repo includes a [Render Blueprint](https://render.com/docs/blueprint-spec) (`render.yaml`)
that provisions everything needed in one pass: a managed Postgres database, the backend API,
and the frontend as a static site. You click "Apply" once; Render builds and deploys both
services and wires up the database connection string and JWT secret for you.

## What you'll end up with

- `nura-nursing-db` — a free Postgres database
- `nura-nursing-api` — the Express backend, at `https://nura-nursing-api.onrender.com`
- `nura-nursing-app` — the React frontend, at `https://nura-nursing-app.onrender.com`

If those exact names are already taken on Render, it'll suffix them (e.g.
`nura-nursing-api-a1b2`) — see **"If the service names get suffixed"** below for the one
follow-up step that requires.

## Steps

1. **Push this branch** (or merge the PR) so the repo on GitHub has `render.yaml` at its root.
2. Go to **[render.com](https://render.com)** and sign in with your GitHub account (top-right
   "Get Started" → "GitHub").
3. Click **New +** → **Blueprint**.
4. Pick the `nura_nursing` repository and the branch to deploy (`main`, once the PR is merged).
   Render detects `render.yaml` automatically and shows you a preview of the three resources
   above.
5. Click **Apply**. Render provisions the database first, then builds and deploys both
   services. The first build takes a few minutes (installing dependencies, running
   `prisma generate`, running the TypeScript build, running database migrations).
6. Once both services show **Live**, open the frontend URL
   (`https://nura-nursing-app.onrender.com`). The database is empty, so you'll land on the
   one-time **setup** screen to create your consultant account.

That's it — no manual environment variable entry required. `JWT_SECRET` is generated
automatically by Render, and `DATABASE_URL` is wired to the Postgres instance automatically.

## If the service names get suffixed

Render service URLs are unique per account, but the *name* `nura-nursing-api` /
`nura-nursing-app` might already be taken globally, in which case Render appends a short
suffix to the name (and therefore the URL) when you apply the blueprint. If that happens, two
values in `render.yaml` need to point at the real URLs instead of the placeholders:

1. In the Render dashboard, open `nura-nursing-api` (or its suffixed name) → **Environment**,
   and update `CORS_ORIGIN` to the frontend's actual URL.
2. Open `nura-nursing-app` (or its suffixed name) → **Environment**, and update `VITE_API_URL`
   to the backend's actual URL plus `/api` (e.g. `https://nura-nursing-api-a1b2.onrender.com/api`).
3. Trigger a **Manual Deploy** on the frontend service (Vite bakes `VITE_API_URL` in at build
   time, so it needs a rebuild to pick up the change) and restart the backend service.

## Known limitations of this setup (worth knowing before relying on it)

- **Free tier sleeps**: Render's free web services spin down after 15 minutes of inactivity
  and take ~30–60 seconds to wake back up on the next request. Fine for evaluating the app;
  upgrade to a paid instance type before using it for real client work.
- **Free Postgres expires**: Render's free Postgres databases are deleted after 90 days.
  Upgrade to a paid plan (or take a backup and recreate) before that deadline if you're
  actually storing client data here.
- **No email provider configured**: password-reset requests generate a token that's logged to
  the backend service's logs (Render dashboard → `nura-nursing-api` → **Logs**) rather than
  emailed, since no SMTP/email API is wired up yet. This works but isn't self-service for the
  consultant — see `README.md` for where to add a provider (Resend, Postmark, SendGrid, etc.)
  when you're ready.
- **Single consultant account**: sign-up is disabled after the first account is created
  (by design — clients never get accounts, and this MVP doesn't yet support multiple
  consultants). If you need a second consultant login, it currently has to be inserted
  directly into the database.

## Local development against Postgres

The app now targets Postgres everywhere (SQLite was dropped once the app was ready for a
real deployment, since SQLite's on-disk file wouldn't survive Render's free-tier restarts
anyway). Run a local Postgres with Docker:

```bash
docker compose up -d        # from the repo root
cd backend
cp .env.example .env        # already points at the docker-compose Postgres
npx prisma migrate deploy
npm run dev
```

See `README.md` for the full local setup, including the frontend.
