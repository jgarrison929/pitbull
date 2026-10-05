# Railway Deployment Setup

Step-by-step guide for deploying Pitbull to a **new Railway account** from GitHub.

## Architecture

```
Railway Project
├── Postgres          (managed plugin)
├── pitbull-api       (Docker: src/Pitbull.Api/Dockerfile, build context = repo root)
└── pitbull-web       (Docker: src/Pitbull.Web/pitbull-web/Dockerfile)
```

- **API** listens on Railway's `PORT` (auto-set). Health check: `/health/live`
- **Web** is Next.js standalone on `PORT`. Health check: `/`
- **Migrations** run automatically on API startup
- **Demo seed** runs when `Demo__Enabled=true` + `Demo__SeedOnStartup=true`

---

## 1. Prerequisites

- GitHub repo: `https://github.com/jgarrison929/pitbull`
- Railway account with GitHub connected ([railway.com](https://railway.com))
- [Railway CLI](https://docs.railway.com/guides/cli): `npm i -g @railway/cli` then `railway login`

### One-command CLI provision

```powershell
railway login
.\scripts\railway-provision.ps1
git push origin main   # staging deploy per commit; do NOT also run railway redeploy
```

**Important:** GitHub auto-deploy is enabled. Pushing to `main` deploys **staging**. Production deploys only when the `production` branch moves (via a version tag / Release workflow). Do not chain `railway redeploy --from-source` after a push (that causes double deploys).

---

## 2. Create the Railway project

### Dashboard (recommended)

1. **New Project** → **Deploy from GitHub repo** → select `jgarrison929/pitbull`
2. Rename the auto-created service to `pitbull-api` (we'll add web + postgres next)

### Add Postgres

1. **+ New** → **Database** → **PostgreSQL**
2. Railway creates `DATABASE_URL` on the Postgres service

### Add Web service

1. **+ New** → **GitHub Repo** → same repo
2. Rename service to `pitbull-web`
3. **Settings → Source**:
   - **Root Directory**: `src/Pitbull.Web/pitbull-web`
   - **Builder**: Dockerfile (`Dockerfile` in that directory)

### Configure API service root directory

1. Select `pitbull-api` → **Settings → Source**:
   - **Root Directory**: `/` (repo root)
   - **Builder**: Dockerfile (`src/Pitbull.Api/Dockerfile`, build context `.`)
   - Configured in `src/Pitbull.Api/railway.json` + `railpack.json` at repo root

---

## 3. Wire Postgres to API

On the **pitbull-api** service → **Variables**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

> The API maps `DATABASE_URL` → `ConnectionStrings:PitbullDb` at startup and adds `sslmode=require` for Railway-hosted Postgres.

Alternatively, set `ConnectionStrings__PitbullDb` directly with the Npgsql connection string from the Postgres service **Connect** tab.

---

## 4. Generate public domains

For each service → **Settings → Networking** → **Generate Domain** (Railway `*.up.railway.app`), then add custom domains for the public demo:

| Service | Railway default (example) | Custom (production) |
|---------|---------------------------|---------------------|
| `pitbull` (API) | `*.up.railway.app` | `api.pcserp.app` |
| `pitbull-web` | `*.up.railway.app` | `demo.pcserp.app` + `app.pcserp.app` |

```powershell
railway domain demo.pcserp.app -s pitbull-web
railway domain app.pcserp.app -s pitbull-web
railway domain api.pcserp.app -s pitbull
.\scripts\cloudflare-railway-dns.ps1   # needs CLOUDFLARE_API_TOKEN
```

See [RAILWAY-DEMO.md](./RAILWAY-DEMO.md) for the live demo layout.
---

## 5. Environment variables

### pitbull-api (required)

| Variable | Example / notes |
|----------|-----------------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `Jwt__Key` | 32+ char random string (run `scripts/railway-setup.ps1` to generate) |
| `Jwt__Issuer` | `pitbull-api` |
| `Jwt__Audience` | `pitbull-client` |
| `Cors__AllowedOrigins__0` | `https://demo.pcserp.app` (or your web origin) |
| `Cors__AllowedOrigins__1` | `https://app.pcserp.app` (optional second origin) |
| `ASPNETCORE_ENVIRONMENT` | `Production` |

### pitbull-api (demo mode)

| Variable | Value |
|----------|-------|
| `Demo__Enabled` | `true` |
| `Demo__SeedOnStartup` | `true` |
| `Demo__DisableRegistration` | `true` |
| `Demo__TenantSlug` | `demo` |
| `Demo__TenantName` | `Pitbull Demo` |
| `Demo__UserEmail` | `demo@example.com` |
| `Demo__UserPassword` | strong password (8+ chars) |
| `SeedData__AllowInNonDevelopment` | `true` |

### pitbull-web (required)

| Variable | Example / notes |
|----------|-----------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-api-domain>` |

> **Important:** `NEXT_PUBLIC_*` is baked in at **build time**. After changing the API URL, trigger a **redeploy** of the web service.

Railway passes service variables as Docker build args when the Dockerfile declares matching `ARG` names.

### Optional

| Variable | Service | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | API | AI features |
| `PostHog__ProjectApiKey` | API | Analytics |
| `Email__Resend__ApiKey` | API | Transactional email |

---

## 6. Environments and deploy triggers

Pitbull uses two Railway environments. Staging tracks `main`; production tracks a release branch that only moves when a version tag is promoted.

| Railway environment | Git branch | Wait for CI | Purpose |
|---------------------|------------|-------------|---------|
| `staging` | `main` | On | Continuous deploy of merged work |
| `production` | `production` | On | Tag-gated releases only |

### Staging (`main`)

For each service in the **staging** environment → **Settings → Source**:

- **Branch**: `main`
- **Auto-deploy**: enabled
- **Wait for CI**: enabled

Every merge to `main` deploys to staging after GitHub CI check runs on that commit succeed.

### Production (`production` branch)

For each service in the **production** environment → **Settings → Source**:

- **Branch**: `production` (not `main`)
- **Auto-deploy**: enabled
- **Wait for CI**: enabled

The `production` branch is moved only by `.github/workflows/release.yml` when a `vX.Y.Z` tag is promoted. Railway watches that branch via its GitHub app. A push by `GITHUB_TOKEN` does not re-trigger GitHub Actions workflows on `production`; that is intentional. Wait for CI still works because the promoted commit is the same SHA that already ran CI on `main`, so the existing check runs on that commit satisfy Railway.

### One-time Railway cutover (from main-only)

1. Create a Railway **staging** environment (duplicate production or create empty, then copy variables/services as needed).
2. Point staging services at branch `main`, enable Wait for CI.
3. Create an empty `production` git branch at the currently deployed SHA (or let the first release workflow create it), then point production services at branch `production`, enable Wait for CI.
4. Confirm staging auto-deploys on the next `main` push and production does **not** move until a tag is promoted.

### How to release

1. Bump version and changelog with the existing scripts (`scripts/bump-version.ps1` / `scripts/stamp-version.ps1`), move `## [Unreleased]` into a dated `## [X.Y.Z]` header, open a PR, merge to `main`.
2. After CI is green on that merge commit:
   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. The **Release** workflow validates the tag against root `VERSION`, confirms the commit is on `main`, confirms CI succeeded, fast-forwards `production` to the tag SHA, and creates a GitHub Release (notes from the matching `CHANGELOG.md` section, or generated notes if missing).
4. Railway production services deploy from the updated `production` branch once Wait for CI sees the existing successful checks on that SHA.

### Rollback

Migrations are **forward-only** (applied on API startup). Rolling back application code does not reverse schema changes. Prefer a forward fix when migrations already ran in production.

Options:

1. **Re-promote a previous tag** (preferred for app code): run workflow **Release** via `workflow_dispatch` with `tag` set to the prior `vX.Y.Z` and `force_rollback: true`. That updates `production` with `--force-with-lease`. Only use force when intentionally rolling back; normal promotes stay fast-forward only.
2. **Railway dashboard**: redeploy a prior successful deployment on the production services (does not move the git branch; next tag promote will overwrite).

---

## 7. Verify deployment

```powershell
# Generate env template + JWT
.\scripts\railway-setup.ps1 -ApiUrl "https://pitbull-api-production.up.railway.app" -WebUrl "https://pitbull-web-production.up.railway.app"

# Smoke test after deploy
curl https://<api-domain>/health/live
curl https://<api-domain>/api/version
curl -I https://<web-domain>/
```

Login at the web URL with demo credentials (`demo@example.com` + your `Demo__UserPassword`).

---

## 8. CLI alternative

```bash
npm i -g @railway/cli
railway login
railway init          # create/link project
railway add --database postgres
railway link          # link to pitbull-api service

# Set variables (interactive)
railway variables set Jwt__Key="<generated-key>"
railway variables set Cors__AllowedOrigins__0="https://your-web.up.railway.app"
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}'

railway up            # deploy current directory's linked service
```

Repeat `railway link` for each service, or use the dashboard for multi-service setup.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API crash on startup: config validation | Set `Jwt__Key` (32+ chars), `Cors__AllowedOrigins__0`, and database connection |
| CORS errors in browser | `Cors__AllowedOrigins__0` must exactly match web URL (https, no trailing slash) |
| Web calls wrong API | Redeploy web after fixing `NEXT_PUBLIC_API_BASE_URL` |
| Health check timeout | API migrations on first deploy can take 2–5 min; `healthcheckTimeout` is 300s |
| `relation does not exist` | Check API logs — migrations should run on startup; verify `DATABASE_URL` |
| Demo login fails | Ensure `Demo__Enabled=true`, `Demo__UserPassword` set, check API logs for DemoBootstrapper |

---

## Custom domains (optional)

1. Add domain in Railway **Networking** for each service
2. Create CNAME records pointing to Railway's target hostname
3. Update `Cors__AllowedOrigins__0` and `NEXT_PUBLIC_API_BASE_URL`
4. Redeploy **both** services

---

## Local parity check

Before pushing to Railway:

```bash
cp .env.example .env
# fill JWT_KEY, NEXT_PUBLIC_API_BASE_URL, etc.
docker compose -f docker-compose.prod.yml up --build
```