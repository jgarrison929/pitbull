# Public demo (Railway + pcserp.app)

Live hosted demo of Pitbull on Railway, multi-tenant seed data, Explore-as-role login.

## URLs

| Role | URL | Railway service |
|------|-----|-----------------|
| **Web (canonical demo)** | https://demo.pcserp.app | `pitbull-web` |
| Web (alias) | https://app.pcserp.app | `pitbull-web` (same service) |
| API | https://api.pcserp.app | `pitbull` |

Visitors open **demo.pcserp.app** → login → **Explore as a role**.

## Railway project

- Project: `dependable-heart` (production)
- Services: Postgres, `pitbull` (API), `pitbull-web` (Next.js)
- Auto-deploy from GitHub `main`

### Custom domains

```powershell
# Already configured on production (verify with):
railway domain list -s pitbull-web
railway domain list -s pitbull

# Add demo hostname to the same web service if missing:
railway domain demo.pcserp.app -s pitbull-web
```

### DNS (Cloudflare zone `pcserp.app`)

Railway requires **DNS-only** (gray cloud) CNAMEs. Sync from Railway’s required records:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<Zone.DNS Edit token for pcserp.app>"
.\scripts\cloudflare-railway-dns.ps1          # includes app + demo + api
.\scripts\cloudflare-railway-dns.ps1 -DryRun  # preview
```

Manual records (values change per Railway; always prefer `railway domain status`):

```text
# Example shape — copy requiredValue from:
#   railway domain status demo.pcserp.app -s pitbull-web --json

CNAME  demo   →  <railway-edge>.up.railway.app     (Proxied: Off)
TXT    _railway-verify.demo  →  railway-verify=...  (until verified)
CNAME  app    →  <railway-edge>.up.railway.app
CNAME  api    →  <railway-edge>.up.railway.app
```

SSL on Railway becomes active after CNAME (+ verification TXT when requested) propagate.

## Environment (demo mode)

### API (`pitbull`)

| Variable | Value |
|----------|--------|
| `Demo__Enabled` | `true` |
| `Demo__SeedOnStartup` | `true` |
| `Demo__DisableRegistration` | `true` |
| `Demo__TenantSlug` | `demo` |
| `Demo__TenantName` | `Pitbull Demo` |
| `Cors__AllowedOrigins__0` | `https://app.pcserp.app` |
| `Cors__AllowedOrigins__1` | `https://demo.pcserp.app` |
| `Jwt__Key` | 32+ char secret |
| `DATABASE_URL` | Railway Postgres |

### Web (`pitbull-web`)

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.pcserp.app` |

`NEXT_PUBLIC_*` is **build-time** — redeploy web after changing the API URL.

## Safety

- Registration disabled (`Demo__DisableRegistration`)
- Demo users restricted (admin GET-only; no destructive admin APIs)
- Explore-as-role: `POST /api/auth/demo-role-login` when `Demo:Enabled`
- Rate limits on auth and API

## Verify

```powershell
curl -sI https://demo.pcserp.app
curl -sI https://api.pcserp.app/health/live
railway domain status demo.pcserp.app -s pitbull-web
```

Open https://demo.pcserp.app → **Explore as a role**.

## README

The repo root [README](../README.md) links the live demo at the top so reviewers do not have to dig for a URL.
