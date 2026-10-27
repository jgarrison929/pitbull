# Railway deployment

The live Railway service is **pitbull-web**. It deploys the Next.js app in [`v5/`](../v5/).

| Setting | Value |
|---------|--------|
| Service | `pitbull-web` |
| Root Directory | `/v5` |
| Builder | Railpack (no Dockerfile in this tree) |
| Build | `npm run build` |
| Pre-deploy | `npm run db:prepare` |
| Start | `npm start` |
| Healthcheck | `/health` (60 s) |
| Watch paths | `/v5/**` |

`DATABASE_URL` on that service points at the `pcs_v5` database. Build and deploy settings live in the Railway service settings, not in a repo config file. Railpack reads service variables during `npm run build`. Any `NEXT_PUBLIC_*` value is inlined at build time, so changing one requires a rebuild.

Public hosts: `https://demo.pcserp.app` and `https://app.pcserp.app`.

Staging tracks `main`. Production moves when [`.github/workflows/release.yml`](../.github/workflows/release.yml) promotes a version tag onto the `production` branch. Demo layout: [RAILWAY-DEMO.md](./RAILWAY-DEMO.md).

`scripts/railway-provision.ps1` and `scripts/railway-setup.ps1` exit immediately. They targeted the removed 3.8.2 services. Do not run them.

## Local

```bash
cd v5
npm ci
npm run db:prepare   # needs DATABASE_URL
npm run dev
```

`GET /health` returns the same payload as `/status`, as JSON.
