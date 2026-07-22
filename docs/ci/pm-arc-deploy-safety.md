# PM next-gen arc — Railway / deploy safety

**Program:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Version rules:** [`docs/340-pm-arc/VERSION-WORKFLOW.md`](../340-pm-arc/VERSION-WORKFLOW.md)

Failed Railway deploys burn time. Treat every band PR as production-bound.

## Required before push

1. **Stamp set** (same PR):  
   - root `VERSION`  
   - `src/Pitbull.Web/pitbull-web/package.json` → `version`  
   - `src/Pitbull.Api/Pitbull.Api.csproj` version props  
   - Docker `ARG` defaults when present  
   - `CHANGELOG.md` entry + ISO timestamp on release headers  

2. **Preflight:**

```powershell
./scripts/preflight.ps1 -FullWeb -DotNet
```

3. **No feature dump** on residual/runway stamps.  
4. **No invented KPIs** in mobile PM surfaces.  
5. Bump SW `CACHE_VERSION` when client shell/offline behavior changes (pattern from 3.2 band).

## After deploy

```powershell
curl -sI https://api.pcserp.app/health/live
curl -sI https://demo.pcserp.app/
curl -sI https://app.pcserp.app/
```

Live Railway notes: `deploy/RAILWAY-*.md`.

## Residual stamps

Allowed: honesty copy, deploy recovery, fetch retry, cache freshness, test coverage for already-shipped helpers.  
Forbidden: starting the next domain band early without its version row.
