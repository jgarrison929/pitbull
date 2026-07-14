# Mobile 3.1.x field band — CI & verification notes

**Band:** `3.1.0` → `3.1.9`  
**Status:** Shipped through **3.1.9**  
**Spec:** `docs/specs/product-bands/band-3.1-field-mobile.md`

## Outcomes

| Version | Outcome |
|---------|---------|
| 3.1.0 | Offline photo downscale helper + tests |
| 3.1.1 | Field report offline photo honesty UI |
| 3.1.2 | Multi-photo queue (max 10) + status copy |
| 3.1.3 | Plan binary cache after view |
| 3.1.4 | Cached vs not labels + unavailable open |
| 3.1.5 | Save for offline on drawings |
| 3.1.6 | Quick field log (`?mode=quick`) |
| 3.1.7 | Last project/plan sheet defaults |
| 3.1.8 | Plan pin → draft RFI (confirm) |
| 3.1.9 | Help + this checkpoint |

## Test commands

```powershell
cd src/Pitbull.Web/pitbull-web
npm test -- --run offline-photo plan-binary-cache plan-pin-draft field-quick-log help-field-workflows
```

## Truth rules

- Never claim entire plan set offline  
- Photos skipped still too large → honest UI  
- Pin RFI requires confirm; no invented cost/%  
