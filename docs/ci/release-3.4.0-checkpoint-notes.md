# Release checkpoint 3.4.0

**Status:** Shipped **3.4.0**  
**Theme:** Post-3.2 security/prod + post-3.3 Today-on-site product checkpoint  

## Upstream bands

| Band | Spec | CI notes | Status |
|------|------|----------|--------|
| 3.2 security/prod | band-3.2-security-prod.md | mobile-3.2-prod-notes.md | Shipped 3.2.9 |
| 3.3 Today on site | band-3.3-today-on-site.md | mobile-3.3-today-on-site-notes.md | Shipped 3.3.9 |

## Deploy verification

```powershell
curl -sI https://api.pcserp.app/health/live
curl -sI https://demo.pcserp.app/
curl -sI https://app.pcserp.app/
```

## Truth

- No new product scope at 3.4.0 beyond residual verification stamps
- No invented KPIs; checkpoint does not re-claim deferred items
