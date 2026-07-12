# Twin Phase 2 — Photo pins MVP notes

**Band:** 2.15.3 → 2.16.2  
**Status:** Shipped through 2.16.2  

## Truth rules (mandatory)

- Empty photo pins / gray overlays are **not** all-clear and **not** green by default.
- GPS is never invented; pins only when GPS and/or zone link exist.
- Help truth legend: `help-twin-truth-legend` on Help Center.

## Test commands

```powershell
# Unit — aggregation
dotnet test tests/Pitbull.Tests.Unit/Pitbull.Tests.Unit.csproj --filter "FullyQualifiedName~TwinPhotoPinAggregation"

# Integration — zone + photo-pins
dotnet test tests/Pitbull.Tests.Integration/Pitbull.Tests.Integration.csproj --filter "FullyQualifiedName~Photo_pins"

# Web helpers
cd src/Pitbull.Web/pitbull-web
npm test -- --run twin-photo-pins twin-overlay-poll twin-zone-drill-analytics help-twin-overlays twin-surface
```

## Manual QA

1. Twin zone drill → Photos section neutral empty when no pins
2. Photo-pins API: `GET /api/projects/{id}/spatial/photo-pins`
3. Help: Digital Twin overlays truth legend
4. Loading: `twin-loading-skeleton` on first load (mobile)

## Version map

| Version | Deliverable |
|---------|-------------|
| 2.15.3 | Photo pin API stub + aggregation helpers |
| 2.15.4 | Zone panel photo thumbnails |
| 2.15.5 | GPS/zone placement from daily reports |
| 2.15.6 | Overlay poll interval config |
| 2.15.7 | Twin loading skeleton mobile |
| 2.15.8 | Help twin truth legend |
| 2.15.9 | Aggregation unit tests expanded |
| 2.16.0 | Integration zone + photo-pins |
| 2.16.1 | PostHog `twin_zone_drill` timing |
| 2.16.2 | Checkpoint (this notes fragment) |

## Next

Model upload band: 2.16.3 → 2.17.2

## Model sample (2.16.6)

**Skipped** shipping a sample glTF/IFC blob in this band (license/size). Runtime pointer and conversion remain admin-driven; zones-first path is authoritative for demos.


## Feature flag (2.17.1)

`NEXT_PUBLIC_FEATURE_DIGITAL_TWIN` / product name `features.digitalTwin`:

| Env | Behavior |
|-----|----------|
| unset / empty | **ON** (production default) |
| `false` / `0` / `off` / `no` | OFF � hide twin nav |

Documented in `src/Pitbull.Web/pitbull-web/src/lib/feature-flags.ts`.

