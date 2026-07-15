# Mobile / prod 3.2.x - CI & verification notes

**Band:** `3.2.0` -> `3.2.9`  
**Status:** Shipped through **3.2.9**  
**Spec:** `docs/specs/product-bands/band-3.2-security-prod.md`

## Outcomes

| Version | Outcome |
|---------|---------|
| 3.2.0 | LogSafe + CI permissions + form PII exclude |
| 3.2.1 | SW CACHE_VERSION deploy freshness |
| 3.2.2 | GET fetch transient retry |
| 3.2.3 | Deploy recovery banner |
| 3.2.4 | Plan pin offline flush helpers |
| 3.2.5 | Plans open honesty helpers |
| 3.2.6 | PostHog session recording opt-out |
| 3.2.7 | Help deploy/offline cards |
| 3.2.8 | Helper test coverage gate |
| 3.2.9 | This checkpoint |

## Test commands

```powershell
cd src/Pitbull.Web/pitbull-web
npm test -- --run sw-cache-version fetch-retry deploy-recovery plan-pin-flush plans-open-copy posthog-session-recording help-deploy-offline band-3.2-coverage
```

## Truth rules

- No invented KPIs  
- Emails redacted in logs  
- Never claim whole plan set offline  
