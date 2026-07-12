# Mobile Phase 2 (Arc B) — plans viewer notes

**Band:** 2.13.3 → 2.14.2  
**Status:** Shipped through 2.14.2  

## Test commands

```powershell
cd src/Pitbull.Web/pitbull-web
npm test -- --run plans-specs-mobile plans-specs-lookup plan-revision-label plan-metadata-cache plans-specs-mobile-layout help-field-workflows offline-store spatial-context
./scripts/preflight.ps1 -FullWeb -DotNet
```

## Manual QA (390×844)

1. Plans & Specs — no primary admin CTA above fold on phone; tap-to-view works
2. Site Walk → Plans deep link applies sheet/q filter
3. Field report optional plan sheet picker; offline queue retains PlanSheetId
4. Offline: plan-sets list served from SW cache when network fails (honest empty if never fetched)

## Version map

| Version | Deliverable |
|---------|-------------|
| 2.13.3 | Field-mode wireframe notes |
| 2.13.4 | Field-only viewer on phone |
| 2.13.5 | Touch targets + search |
| 2.13.6 | Site walk → plans filter |
| 2.13.7 | Revision label (API only) |
| 2.13.8 | Help Plans on site |
| 2.13.9 | Plans mobile layout vitest |
| 2.14.0 | PlanSheetId picker on field report |
| 2.14.1 | SW plan-sets metadata cache |
| 2.14.2 | Arc B checkpoint (this doc) |
