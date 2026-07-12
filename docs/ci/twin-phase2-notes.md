# Twin Phase 2 — complete notes (Arc D)

**Band:** 2.15.3 → 2.19.2  
**Status:** **Shipped through 2.19.2** (Arc D complete)  
**Spec:** `docs/specs/digital-twin-phase2-implementation.md`  
**Master:** `docs/pitbull-digital-twin-spec.md`

## Truth rules (mandatory)

- Empty photo pins / gray overlays are **not** all-clear and **not** green by default.
- GPS is never invented; pins only when GPS and/or zone link exist.
- Cost overlay off or proxy-labeled without allocation links.
- Pending/Processing model assets are never “ready.”
- Capture quality % is **labeled data quality**, not an executive KPI.
- Help: `help-twin-truth-legend`, `help-zone-picker-twin`.

## Full version map

### Photo pins (2.15.3 → 2.16.2)

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
| 2.16.2 | Photo pins MVP checkpoint |

### Model upload (2.16.3 → 2.17.2)

| Version | Deliverable |
|---------|-------------|
| 2.16.3 | ModelAsset API + migration |
| 2.16.4 | Desktop admin register UI |
| 2.16.5 | Conversion Processing stub |
| 2.16.6 | Sample glTF/IFC **skipped** (honest; license/size) |
| 2.16.7 | Active runtime pointer |
| 2.16.8 | Fail + retry UX |
| 2.16.9 | Spatial.Manage authz tests |
| 2.17.0 | Integration lifecycle happy path |
| 2.17.1 | Feature flag `features.digitalTwin` prod default ON |
| 2.17.2 | Model upload band checkpoint |

### Performance / overlays (2.17.3 → 2.18.2)

| Version | Deliverable |
|---------|-------------|
| 2.17.3 | Overlay query batch (no N+1) |
| 2.17.4 | Storey stream lazy load |
| 2.17.5 | Overlay p95 metric logging |
| 2.17.6 | Mobile twin read-only polish |
| 2.17.7 | Cost overlay hidden unless allocation |
| 2.17.8 | Banner “cost by zone not allocated” |
| 2.17.9 | Vitest overlay formula regression |
| 2.18.0 | Load seed scale doc (`twin-overlay-load-scale.md`) |
| 2.18.1 | SLO evidence (diagnostic) |
| 2.18.2 | Performance band checkpoint |

### Require spatial + close (2.18.3 → 2.19.2)

| Version | Deliverable |
|---------|-------------|
| 2.18.3 | `RequireSpatialOnProgress` schema (default false) |
| 2.18.4 | PM Settings + company setup UI |
| 2.18.5 | Field report zone prompt + API `SPATIAL_ZONE_REQUIRED` |
| 2.18.6 | Demo skip path (documented below) |
| 2.18.7 | Capture quality metric (labeled) |
| 2.18.8 | Help zone picker + twin |
| 2.18.9 | E2E twin zone round-trip (flag-gated) |
| 2.19.0 | Arc D integration suite tidy |
| 2.19.1 | **This notes file complete** |
| 2.19.2 | Arc D checkpoint (spec Status shipped) |

## Feature flag (2.17.1)

`NEXT_PUBLIC_FEATURE_DIGITAL_TWIN` / `features.digitalTwin`:

| Env | Behavior |
|-----|----------|
| unset / empty | **ON** (production default) |
| `false` / `0` / `off` / `no` | OFF — hide twin nav |

See `src/Pitbull.Web/pitbull-web/src/lib/feature-flags.ts`.

## Model sample (2.16.6)

**Skipped** shipping a sample glTF/IFC blob (license/size). Zones-first path is authoritative for demos.

## RequireSpatialOnProgress

| Setting | Company `ProjectSettings.RequireSpatialOnProgress` → column `ProjRequireSpatialOnProgress` |
| UI | Settings → Projects; company setup |
| Field | Mobile daily report zone select; required when setting on **and** zones exist |
| Draft | Always free without zone |
| Demo | `is_demo_user` may skip (client + server) |
| API | Submit may return `SPATIAL_ZONE_REQUIRED` for non-demo |

### Demo skip path (2.18.6)

1. JWT `is_demo_user=true` may submit without spatial zone when setting is on.
2. Client: `canSubmitWithSpatialPolicy({ isDemoUser: true })`.
3. Server: `IsCurrentUserDemo()` skips `SPATIAL_ZONE_REQUIRED`.
4. Production non-demo still enforced.
5. Not an executive KPI; does not invent green zones.

## Capture quality (2.18.7)

`GET /api/projects/{id}/spatial/capture-quality?windowDays=7`

- % of daily reports + progress entries with `SpatialNodeId` in window.
- Empty window ⇒ **null** percent (not 0% failure).
- Label: data quality — **not** an executive KPI.

## E2E twin zone round-trip (2.18.9)

**Spec:** `e2e/tests/twin-zone-roundtrip.spec.ts`  
**Project:** `twin-zone-roundtrip`

| Condition | Behavior |
|-----------|----------|
| API/web down or missing auth | **Self-skip** (honest) |
| `RUN_TWIN_E2E=0` | Explicit skip |
| Live demo + seeded zones | Zone picker + twin shell + capture-quality |

```powershell
$env:RUN_TWIN_E2E = "1"
cd e2e
npx playwright test --project=twin-zone-roundtrip
```

## Integration suite (2.19.0)

```powershell
# Arc D spatial suite
dotnet test tests/Pitbull.Tests.Integration/Pitbull.Tests.Integration.csproj --filter "FullyQualifiedName~SpatialEndpoints"

# Unit slices
dotnet test tests/Pitbull.Tests.Unit/Pitbull.Tests.Unit.csproj --filter "FullyQualifiedName~TwinPhotoPinAggregation|SpatialCaptureQuality|ModelAsset|SpatialCost"

# Web
cd src/Pitbull.Web/pitbull-web
npm test -- --run twin-photo-pins overlay-formula help-twin-overlays help-zone-picker-twin spatial-context twin-surface
```

## Manual QA checklist

1. Twin zone drill → neutral empty photos when no pins  
2. `GET .../spatial/photo-pins`  
3. Model admin: Pending/Processing never shows ready  
4. Cost mode: banner when not allocated  
5. Settings → Projects → Require spatial toggle  
6. Field report zone required vs demo skip  
7. Help: truth legend + zone picker sections  
8. `GET .../spatial/capture-quality`  

## Arc D DoD (target 2.19.2)

- [x] Photo pins MVP or honest empty  
- [x] Upload path (stub conversion; sample glTF skipped honestly)  
- [x] Overlay perf notes + truth banners  
- [x] RequireSpatial optional setting shipped  
- [x] Notes complete (this file)  

Next product arc: **Arc E** (2.19.3+) — AI / CI / close to 2.22.2 per `docs/260712/goal-prompts.md`.
