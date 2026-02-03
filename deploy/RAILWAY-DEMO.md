# Railway Demo Deployment (demo.pitbullconstructionsolutions.com)

This document describes how to stand up a **public demo** of Pitbull on **Railway** with:

- a real Postgres database
- **one shared demo tenant**
- **seeded data** (projects + bids)
- Docker-based deploys (portable)

> This repo already contains Dockerfiles for API + Web.

---

## Services (Railway)

Create a Railway project, then add these services:

1) **Postgres** (Railway Postgres plugin)
- Database name: `pitbull`

2) **Redis** (Railway Redis plugin) *(optional today; recommended if/when caching/jobs land)*

3) **API** (Dockerfile: `src/Pitbull.Api/Dockerfile`)
- Exposes: `PORT` (defaults to 8080)
- Health: `/health/ready`

4) **Web** (Dockerfile: `src/Pitbull.Web/pitbull-web/Dockerfile`)
- Exposes: `PORT` (3000)

---

## Domains

Suggested:

- Web: `demo.pitbullconstructionsolutions.com` → Railway **Web** service
- API: `api-demo.pitbullconstructionsolutions.com` → Railway **API** service

CORS must include the web origin.

---

## Environment variables

### API service

Required:

- `ConnectionStrings__PitbullDb` = Railway Postgres connection string
- `Jwt__Key` = 32+ char random string
- `Jwt__Issuer` = `pitbull-api`
- `Jwt__Audience` = `pitbull-client`
- `Cors__AllowedOrigins__0` = `https://demo.pitbullconstructionsolutions.com`

Recommended demo safety:

- `Demo__Enabled=true`
- `Demo__SeedOnStartup=true`
- `Demo__DisableRegistration=true`
- `Demo__TenantSlug=demo`
- `Demo__TenantName=Pitbull Demo`
- `Demo__UserEmail=demo@pitbullconstructionsolutions.com`
- `Demo__UserPassword=<set a strong password and rotate periodically>`

Optional (only needed if seeding outside Demo bootstrap):

- `SeedData__AllowInNonDevelopment=true`

### Web service

- `NEXT_PUBLIC_API_BASE_URL=https://api-demo.pitbullconstructionsolutions.com`

> Note: `NEXT_PUBLIC_*` values are baked into the client bundle at build time.
> Changing this requires a rebuild/redeploy of the Web service.

---

## Seeding behavior

When `Demo__Enabled=true` and `Demo__SeedOnStartup=true`, the API will:

1) Ensure the demo tenant exists (`Demo__TenantSlug`)
2) Ensure the demo user exists (`Demo__UserEmail`)
3) Set the Postgres RLS tenant session variable
4) Seed projects + bids (idempotent per tenant)

If the data already exists, seeding is skipped.

---

## Minimal "public demo" safety notes

The public demo should not accept arbitrary sign-ups.

- `Demo__DisableRegistration=true` causes `POST /api/auth/register` to return 404.
- Login still works via `POST /api/auth/login`.
- API endpoints are rate-limited (`auth`: 5/min, `api`: 60/min).

---

## Local smoke test (Docker)

```bash
# from repo root
cp .env.example .env
# edit .env (set JWT_KEY, DEMO__* vars, etc)

docker compose -f docker-compose.prod.yml up --build
```

Then:

- Web: <http://localhost:3000>
- API: <http://localhost:8080/swagger>
