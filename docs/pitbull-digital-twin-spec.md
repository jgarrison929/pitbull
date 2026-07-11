# Pitbull Digital Twin / 3D Viewer Spec

**Status:** Draft v2 — implementable product design  
**Updated:** 2026-07-11  
**Related:** `mobile3.md` (capture engine), `DEMO-COMPANY-PROFILES.md` (seed archetypes), `ROLE-EXPERIENCE.md` (personas), `ARCHITECTURE.md` (stack patterns)  
**Goal:** A web-based spatial viewer that visualizes **existing** construction activity (progress, schedule, cost proxies, RFIs, photos) in project context. Mobile-captured data is the primary fuel.

---

## 1. Vision (unchanged intent)

A live, queryable spatial representation of the jobsite where:

- Field progress, photos, voice notes, and plan references appear as spatial overlays.
- PMs, supers, and stakeholders see where work is happening, what’s on track vs. at risk, and schedule/cost impact without hunting reports.
- The twin is a **visualization and query layer** over ERP + field data — not a perfect geometric replica of the building.

It starts as a project workspace web viewer and may later feed AR/HUD clients that consume the **same spatial API**.

---

## 2. Non-goals (v1)

Explicitly **out of scope** for Phases 0–2:

| Non-goal | Why |
|----------|-----|
| BIM authoring / Revit replacement | We consume models; we don’t design them |
| Clash detection / full VDC coordination | Different product; don’t pretend |
| Facilities digital twin (BMS, sensors, IoT) | Construction progress twin first |
| Photogrammetry / reality mesh pipeline | Optional later; not required for value |
| Multi-project federated “city” model | One project spatial graph at a time |
| Offline desktop/tablet twin caching | Offline is for **mobile capture** (mobile3); viewer is online-first |
| Freeform 3D annotation markup in MVP | Phase 2+; MVP links existing RFIs/reports |
| Invented executive KPIs from thin air | Overlays must be labeled proxies or real aggregations (see §7) |

Competitive fence (scope only, not marketing): we are not building OpenSpace photo-mesh, Autodesk coordination, or Procore Drawings 1:1. We are building **spatial status over Pitbull data**.

---

## 3. MVP decision record (locked)

These answers replace the open-ended “Open Questions” list from v1. Change only via an explicit ADR amendment.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Geometry day one | **Zones-first** (+ optional 2.5D floor footprint). Full BIM/IFC is Phase 2 ingest | Unblocks seed + mobile without converter pipeline |
| D2 | MVP complexity | **One spatial graph per project**: site + buildings + storeys + zones. No federated multi-discipline models | Matches demo projects; keeps overlays simple |
| D3 | Element granularity | **Zone is the primary clickable unit** in MVP. Optional leaf `Element` rows for future IFC GUIDs | Avoids wall-level progress fiction |
| D4 | Updates | **Batch-friendly near-real-time**: overlay refresh on poll (15–60s) or on focus; CAP domain events optional for “dirty” flags | Avoids WebSocket as hard dependency for MVP |
| D5 | Offline twin | **No** offline viewer in MVP. Offline applies only to mobile progress capture (mobile3) | Clear split of concerns |
| D6 | Annotate / edit geometry | **MVP = read-only twin**. Spatial admin (create/edit zones, publish model) = PM/Admin with permission. Field does not edit geometry | Trust + RBAC |
| D7 | Model maintenance | Versioned **ModelAsset** (optional). Spatial tree is editable independently. Soft-delete nodes; never hard-delete if linked history exists | Jobsite changes constantly |
| D8 | Identity | Internal `Guid` primary keys always. Optional `ExternalIfcGuid` / `ExternalKey` for import round-trip | Matches `BaseEntity` pattern |
| D9 | Coordinates | Project site WGS84 already on `Project` (lat/long). Spatial nodes use **local meters** relative to project origin; optional WGS84 pin on zones | Aligns with geofence fields |
| D10 | Cost overlay | **Proxy only** until zone↔cost allocation exists: show job-cost / progress rollups **labeled as proxy** when not zone-allocated | Agents.md truth rules |

### MVP product slice (definition of done)

A user with project access can:

1. Open **Project → Digital Twin** (or Spatial Status) for a seeded project.
2. See a spatial tree (site → building → storey → zones) even with **no** BIM file.
3. Color zones by a **documented** overlay mode (progress / schedule risk / open RFIs).
4. Click a zone and see linked progress entries, daily report photos, RFIs, and plan sheets.
5. Filter by storey, date range, and trade (when data present).
6. See honest empty/insufficient-data states (never default green).

---

## 4. Relationship to mobile3

| Layer | Owner | Responsibility |
|-------|--------|----------------|
| Capture | mobile3 | Offline queue, voice, photos, plan deep-links, fast progress |
| Structure | this spec | Spatial graph + links + overlays + viewer |
| Fuel contract | shared | Progress/daily report rows should carry `SpatialNodeId` and/or `PlanSheetId` |

### 4.1 Capture contract (minimum for twin quality)

| Field | Phase | Required? | Notes |
|-------|-------|-----------|--------|
| `ProjectId` | always | Yes | Existing |
| `SpatialNodeId` (zone preferred) | twin Phase 1 | Strongly encouraged; optional at first | FK to spatial node |
| `PlanSheetId` | mobile3 Phase 2 | Encouraged | Existing `PmPlanSheet`; map sheet → zone via `SpatialPlanLink` |
| `ScheduleActivityId` | when logging activity progress | When using `PmActivityProgress` | Existing |
| Photo lat/long | when available | Optional | Already on `PmDailyReportPhoto` |
| Client-generated `IdempotencyKey` | offline sync | Yes for mobile writes | Survive create-then-sync |

**Enforcement path (product):**

- Phase 1: prompt “Which area?” with zone picker; allow skip.
- Phase 2: project setting `RequireSpatialOnProgress` for field roles.
- Metric: `% of progress entries / daily reports in last 7d with SpatialNodeId OR PlanSheetId` (data quality, not vanity KPI).

### 4.2 Plan sheet ↔ space

```
PmPlanSheet ──< SpatialPlanLink >── SpatialNode
```

- Many sheets can map to one storey/zone (e.g. A2.1, S2.1 both “Level 2”).
- One sheet can map to multiple zones when needed (site plan).
- Deep link from twin → existing plans-specs route:  
  `/projects/{id}/plans-specs?sheet={DrawingNumber}&view=plans`  
  (reuse `buildPlansSpecsHref` patterns in web).

### 4.3 Photo placement

Priority order for pin:

1. Explicit `SpatialNodeId` on parent entry/photo link  
2. Plan-sheet pin / sheet mapping → zone  
3. Photo GPS near project geofence → nearest zone centroid (if computed)  
4. Unplaced (show in project “unlocated media” list — not on map)

---

## 5. Spatial domain model

All new entities: `BaseEntity` + `ICompanyScoped` (`TenantId`, `CompanyId`, soft delete). Controllers inject `I*Service` (no MediatR in controllers). Module home: extend **ProjectManagement** or add **Spatial** module under `src/Modules/` — prefer **ProjectManagement** first to avoid orphan module until Phase 2 BIM pipeline justifies split.

### 5.1 Entity overview

```
Project (existing)
  └── SpatialGraph (1 active graph per project; versioned)
        └── SpatialNode (tree: Site | Building | Storey | Zone | Element)
              ├── SpatialGeometry (optional footprint / mesh ref)
              ├── SpatialPlanLink → PmPlanSheet
              ├── SpatialActivityLink → PmScheduleActivity
              └── SpatialCostCodeLink → CostCode (optional, Phase 2)

ModelAsset (optional BIM/glTF package, versioned)
  └── ModelAssetVersion (blob keys, status, published flag)

SpatialRef (polymorphic link from operational rows → SpatialNode)
```

### 5.2 `SpatialGraph`

| Field | Type | Notes |
|-------|------|--------|
| Id | Guid | PK |
| TenantId, CompanyId | Guid | RLS |
| ProjectId | Guid | FK → Project |
| Name | string | e.g. “Primary” |
| Version | int | Monotonic; publish bumps |
| Status | enum | Draft / Published / Archived |
| LengthUnit | enum | Meters (default) |
| OriginLatitude / OriginLongitude | decimal? | Defaults from Project lat/long |
| PublishedAt / PublishedBy | optional | Audit |

**Rule:** Only one **Published** graph per project at a time (or one “current” pointer on Project: `CurrentSpatialGraphId`).

### 5.3 `SpatialNode`

| Field | Type | Notes |
|-------|------|--------|
| Id | Guid | PK — **stable application ID** |
| GraphId | Guid | Parent graph |
| ProjectId | Guid | Denormalized for queries |
| ParentNodeId | Guid? | Tree |
| NodeType | enum | `Site`, `Building`, `Storey`, `Zone`, `Element` |
| Code | string | Short code e.g. `L2-EAST`, unique per graph |
| Name | string | Display |
| SortOrder | int | Sibling order |
| LevelIndex | int? | Storey index (0 = ground) |
| ExternalIfcGuid | string? | IFC GlobalId when imported |
| ExternalKey | string? | Other import keys |
| CentroidX/Y/Z | decimal? | Local meters |
| BoundingMin/Max* | optional | For culling / pick |
| IsActive | bool | Soft hide without delete |
| RetiredReason | string? | “Removed in model v3” |

**Hierarchy rules:**

- Site → Building → Storey → Zone → (optional) Element  
- Highway/infra (SHD): Site → CorridorSegment (stored as `Zone` with `NodeType` or use `Zone` + metadata `Kind=Segment`) — avoid new types until needed  
- Multi-building: multiple Building nodes under one Site  

**MVP tree depth:** Site + ≥1 Building + ≥1 Storey + ≥3 Zones recommended for demo.

### 5.4 `SpatialGeometry` (optional)

| Field | Notes |
|-------|--------|
| SpatialNodeId | 1:1 or 1:N LODs |
| GeometryKind | `Footprint2D`, `Extrusion`, `MeshRef` |
| GeoJson / PolygonWkt | For 2.5D footprints |
| MeshAssetUrl / BlobKey | glTF chunk |
| Lod | 0..n |

MVP can ship with **no** geometry rows: viewer renders **schematic boxes/list + tree**. Geometry improves UX but is not required for overlays.

### 5.5 `ModelAsset` / `ModelAssetVersion` (Phase 2)

| Field | Notes |
|-------|--------|
| ProjectId, CompanyId | Scope |
| SourceFormat | IFC / glTF / OBJ |
| SourceBlobKey | Immutable source |
| RuntimeFormat | glTF / XKT / internal |
| RuntimeBlobKey | Served to web |
| ConversionStatus | Pending / Succeeded / Failed |
| ConversionError | string? |
| LicenseAttribution | string? | Required for open BIM seeds |
| PublishedGraphId | Optional link after extract |

**No-model path (required):** projects without `ModelAsset` still have a full `SpatialGraph` of zones.

### 5.6 Linking operational data

Prefer **nullable FK columns** on high-traffic tables (clear queries) plus optional join table for many-to-many.

#### A. Direct FKs (Phase 1 — add columns)

| Entity | New column | Notes |
|--------|------------|--------|
| `PmProgressEntry` | `SpatialNodeId?` | Zone of work |
| `PmActivityProgress` | `SpatialNodeId?` | Optional finer pin |
| `PmDailyReport` | `SpatialNodeId?` | Primary area for report day |
| `PmDailyReportPhoto` | `SpatialNodeId?` | In addition to lat/long |
| `PmScheduleActivity` | `PrimarySpatialNodeId?` | Default zone for activity |
| RFI (`Rfi` or PM RFI) | `SpatialNodeId?` | Location of question |
| `PmPunchListItem` | `SpatialNodeId?` | Natural fit |

#### B. Join tables

| Table | Purpose |
|-------|---------|
| `SpatialPlanLink` | `SpatialNodeId` ↔ `PlanSheetId` |
| `SpatialActivityLink` | M:N activity ↔ zones when work spans areas |
| `SpatialCostCodeLink` | Optional Phase 2 allocation weights |

#### C. Soft delete / retired nodes

- Linked history **keeps** `SpatialNodeId` even if node `IsActive = false`.  
- UI: “Zone retired (still shows historical entries)”.  
- Do not cascade-null operational FKs on soft delete.

### 5.7 Coordinates & multi-phase

- **Local CRS:** right-handed, meters, Z up; origin = project pin or first site node.  
- **WGS84:** project-level + optional zone pins for map basemap later.  
- **Multi-phase projects:** same graph; use `Code`/`Name` prefixes or parent “Phase area” zones — do not fork graphs per phase in MVP.

---

## 6. Overlay contracts (truthful metrics)

**Principle:** Every color mode declares **source**, **formula**, **as-of**, and **insufficient-data** behavior. Label proxies in the UI (same spirit as `ROLE-EXPERIENCE.md` truth rules).

### 6.1 Common request params

```
GET .../overlays?mode=progress|schedule|rfi|cost_proxy
  &asOf=2026-07-11
  &from=&to=          // optional window
  &storeyNodeId=
  &trade=             // optional filter via crew/cost code
```

Response per node:

```json
{
  "spatialNodeId": "...",
  "mode": "progress",
  "status": "ok" | "insufficient_data" | "not_applicable",
  "value": 0.72,
  "displayLabel": "72% (latest activity progress)",
  "confidence": "high" | "medium" | "low",
  "sourceSummary": "3 progress lines · last 2026-07-10",
  "colorToken": "progress.high" | "neutral.unknown" | ...
}
```

### 6.2 Mode: `progress` (MVP)

| Item | Definition |
|------|------------|
| Source | `PmActivityProgress` joined through entries with `SpatialNodeId` = zone (or child of zone); fallback: activities linked via `SpatialActivityLink` / `PrimarySpatialNodeId` |
| Aggregation | **Latest** `PercentComplete` per `ScheduleActivityId` in zone, then **simple average** across activities with data in window |
| As-of | `asOf` date: use latest entry with `ProgressDate <= asOf` |
| Conflict | Newer `ProgressDate` wins per activity; same day → higher `UpdatedAt` |
| Insufficient | No progress rows in zone → `insufficient_data` (neutral/gray — **not green**) |
| Label | “Latest field/schedule progress (avg of activities with data)” |

**Not claimed:** overall building % complete from geometry.

### 6.3 Mode: `schedule` (MVP)

| Item | Definition |
|------|------------|
| Source | `PmScheduleActivity` where linked to zone and `IsCritical` / dates present |
| Value | Categorical: `on_track` / `at_risk` / `late` / `unknown` |
| Rules (v1, deterministic) | `late` if `ActualFinish` null and `PlannedFinish < asOf` and status not complete; `at_risk` if critical and remaining duration > float heuristic OR planned finish within 3 days and % &lt; expected linear; else `on_track` if planned dates exist |
| Insufficient | No linked activities → gray |
| Label | “Schedule status from linked activities (rule-based)” |

Critical path: use existing `IsCritical` on activities after schedule engine run — twin does **not** recompute CPM in MVP.

### 6.4 Mode: `rfi` (MVP)

| Item | Definition |
|------|------------|
| Source | RFIs with `SpatialNodeId` in zone (or Open RFIs with drawing refs mapped via plan links — Phase 1.1) |
| Value | Count of open RFIs; color by count thresholds (0 / 1–2 / 3+) |
| Insufficient | No RFIs ever linked → gray; zero open with history → green-ok optional with label “0 open” |

### 6.5 Mode: `cost_proxy` (Phase 2 — optional in MVP UI off by default)

| Item | Definition |
|------|------------|
| Source | Without `SpatialCostCodeLink`, roll up **project-level** job cost / earned value **cannot** be honestly split by zone |
| MVP behavior | **Hide** or show project-level banner: “Cost by zone not allocated” |
| Future | Weight cost codes to zones; show actuals/commitments with label “Allocated proxy” |

### 6.6 Color tokens

| Token | Meaning |
|-------|---------|
| `neutral.unknown` | Insufficient data |
| `neutral.na` | Not applicable |
| `progress.low/mid/high` | Based on % bands (document bands in UI legend) |
| `schedule.on_track/at_risk/late` | Rule-based |
| `rfi.none/some/many` | Counts |

**Never** map null → “healthy green.”

---

## 7. API contracts

Base path suggestion: `/api/projects/{projectId}/spatial/...`  
Auth: JWT + permission checks + tenant/company RLS.  
Pattern: controller → `ISpatialService` / `ITwinOverlayService`.

### 7.1 Graph & nodes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/spatial/graph` | Current published graph + tree summary |
| GET | `/spatial/nodes` | Flat or nested nodes (`?types=Zone&storeyId=`) |
| GET | `/spatial/nodes/{id}` | Node detail + counts of links |
| POST | `/spatial/nodes` | Create node (Manage) |
| PUT | `/spatial/nodes/{id}` | Update |
| POST | `/spatial/graph/publish` | Publish draft version |

Empty states:

- `404` graph → client shows **Create zones** empty state (or auto-seed stub for demo).  
- Graph exists, no geometry → schematic mode.

### 7.2 Overlays

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/spatial/overlays` | §6 payload for all zones (or storey-filtered) |
| GET | `/spatial/nodes/{id}/timeline` | Recent progress, RFIs, photos for side panel |

### 7.3 Search

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/spatial/search?q=` | Nodes by code/name; optional activity/RFI titles in zone |

### 7.4 Model assets (Phase 2)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/spatial/models` | Upload source (multipart / presigned URL) |
| GET | `/spatial/models/{id}` | Status + runtime URL |
| POST | `/spatial/models/{id}/publish` | After conversion success |

### 7.5 Events (optional CAP)

Publish when useful for “dirty” badges (not required for MVP correctness):

- `spatial.graph.published`  
- `progress.entry.created` / `updated` (if not already)  
- `rfi.opened`  

Clients: poll overlays; optionally listen later via SignalR/WebSocket if introduced product-wide.

### 7.6 Idempotency (mobile)

- Header `Idempotency-Key` on progress/daily report create when attaching `SpatialNodeId`.  
- Server stores key per tenant/user for 24–72h.

---

## 8. Model lifecycle (zones + future BIM)

### 8.1 Zones-only path (MVP — always available)

```
PM/Admin → create SpatialGraph (draft)
        → add Site/Building/Storey/Zones
        → optional footprints
        → publish
Viewer → load graph + overlays
```

Seed/demo can create published graphs without UI.

### 8.2 BIM path (Phase 2)

```
Upload IFC/glTF
  → store source blob (tenant-isolated)
  → conversion job (Hangfire): validate → extract storeys/spaces → write SpatialNodes (ExternalIfcGuid)
  → produce runtime glTF/XKT
  → status Succeeded | Failed
  → human review draft graph
  → publish (new graph version)
```

| Concern | Choice |
|---------|--------|
| Runtime format | glTF/GLB preferred for Three.js/R3F; XKT optional if adopting xeokit |
| Conversion host | Hangfire worker; libraries TBD (xBIM on .NET and/or IfcOpenShell sidecar) |
| Size limits | Soft limit e.g. 100MB source MVP; larger = async only |
| Federation | Single file first; multi-discipline later as multiple ModelAssets one graph |
| Attribution | `LicenseAttribution` required when source is third-party open BIM |

### 8.3 Changing jobsite

- Edit zones anytime on draft; publish new graph version.  
- Operational rows keep old node IDs; retired nodes remain queryable.  
- Do not auto-delete nodes present in older IFC but missing in new import — mark inactive + `RetiredReason`.

---

## 9. Permissions & tenancy

### 9.1 New permission constants

Add to `PermissionConstants` (names stable strings):

| Constant | String | Use |
|----------|--------|-----|
| `SpatialView` | `Spatial.View` | View twin + overlays |
| `SpatialManage` | `Spatial.Manage` | Edit graph, publish, upload models |

**Reuse** existing for linked content:

- Progress / daily reports: `PM.DailyReports`, schedule: `PM.Schedule`, RFIs: `PM.RFIs`, docs: `Documents.View` / `Documents.Upload`

### 9.2 Role defaults (seed)

| Role | Spatial.View | Spatial.Manage |
|------|--------------|----------------|
| Admin | ✓ | ✓ |
| Manager / PM | ✓ | ✓ |
| Supervisor / Foreman | ✓ | ✗ |
| User / field | ✓ (project-scoped) | ✗ |
| Viewer | ✓ | ✗ |
| Estimator | ✓ optional | ✗ |

### 9.3 Isolation

- All spatial tables: `TenantId` + `CompanyId` + RLS policies (same as other PM tables).  
- Blobs: path prefix `{tenantId}/{companyId}/spatial/...`.  
- Demo users: respect `IsDemoUser` / `DemoRestrictionMiddleware` (no destructive admin; manage may be limited on demo).

### 9.4 Audit

- Publish graph → audit log entity type `SpatialGraph`.  
- Model upload/publish → audit.  
- MVP annotations N/A; Phase 2 annotation creates audited rows.

### 9.5 External portal

Out of scope for v1 (Portal module remains limited).

---

## 10. UX & role experience

### 10.1 Navigation

- Project workspace item: **Digital Twin** (or **Spatial Status**)  
  - Route: `/projects/[id]/twin`  
  - Permission: `Spatial.View`  
  - Alongside Plans & Specs, Schedule, Daily Reports  

### 10.2 Persona defaults

| Profile | Default mode | Default filter |
|---------|--------------|----------------|
| Field / Superintendent | `progress` | Today’s look-ahead storeys / “my areas” if tagged |
| PM | `schedule` | Critical + at_risk first |
| Executive | Project list entry point only in MVP; optional later portfolio heat — **not** fake portfolio % |
| Controller | Cost mode hidden until allocation exists |
| Estimator | Read-only; limited value until preconstruction models |

### 10.3 Layout (desktop)

- Left: storey switcher + zone tree + filters  
- Center: schematic 3D/2.5D or list-canvas  
- Right: selection panel (links to progress, photos, RFIs, plan sheet CTA)  
- Legend always visible for active mode  

Tablet: collapse tree; prioritize selection panel.

### 10.4 Empty / onboarding

1. No graph → “Set up areas for this project” + Manage CTA  
2. Graph, no links → “Areas ready — log progress with an area on mobile”  
3. Conversion failed → error + retry (Phase 2)

### 10.5 Deep links

| From | To |
|------|-----|
| Zone panel | Daily report, RFI detail, plans-specs sheet |
| Mobile progress | Optional “View in twin” when online |
| Schedule activity | Twin focused on primary zone |

### 10.6 Accessibility

- Full keyboard tree navigation  
- Color not sole signal (icons + text status)  
- Reduced-motion: disable camera spin  

### 10.7 Annotations (Phase 2)

- Sticky note = creates `PmTask` or comment linked to `SpatialNodeId`  
- Markup that opens RFI preferred over freeform 3D graffiti  

---

## 11. Technical approach (viewer)

| Layer | Choice |
|-------|--------|
| Web | Next.js App Router + React Three Fiber / Three.js **or** schematic SVG/Canvas first |
| MVP render | **Schematic**: extruded footprints or zone cards on storey plan — full BIM mesh optional |
| Perf | Load one storey at a time; instancing later; workers for parse |
| Sync | React Query poll overlays; invalidate on focus |
| Hedge | WASM/xeokit only if BIM meshes become primary |

### 11.1 Performance targets (MVP SLOs)

| Metric | Target |
|--------|--------|
| Graph+nodes API | p95 &lt; 300ms for ≤500 nodes |
| Overlay API | p95 &lt; 500ms for ≤200 zones |
| First interactive viewer | &lt; 3s on mid laptop (schematic) |
| BIM runtime (Phase 2) | &lt; 10s to interactive for ≤50MB glTF on desktop |

Degrade: if mesh fails → automatic schematic tree + storey plan.

### 11.2 Observability

- Log conversion job failures  
- Metric: overlay query duration, spatial link coverage %  
- Client: model load error events (PostHog)

---

## 12. Demo / seed strategy

Align with `DEMO-COMPANY-PROFILES.md`. Spatial seed version bumps with `SeedDataVersion` when domain seed changes. **Do not** commit multi‑GB IFC; use synthetic zones + optional small open samples via download script or CDN.

### 12.1 Company mapping

| Company | Archetype | Spatial metaphor | Seed approach |
|---------|-----------|------------------|---------------|
| **02 SCB** | Mid-market commercial | Building storeys + zones (East wing, Level 2, Lobby) | **Primary twin demo** — full graph + linked progress/RFIs/photos |
| **01 SBG** | Enterprise GC | 1–2 buildings, coarser zones | Portfolio of projects with spatial; not one mega-model |
| **03 SHD** | Heavy highway | Site + segment zones (Sta 10+00–12+00), no storeys required | Zones as alignment segments |
| **04 SMH** | Mechanical | Zones = floor + system area (Level 2 – Mech corridor) | Zones + trade filter story |

### 12.2 Flagship project (recommended)

Pick one **SCB** active project as “twin showcase”:

- Graph: Site → Building A → L1, L2, L3 → 4–6 zones per floor  
- Links: recent `PmProgressEntry` / activities, 2–3 RFIs, plan sheet links for L2, daily report photos with `SpatialNodeId`  
- Overlay modes all show non-empty data  

### 12.3 Open BIM (optional Phase 2 seed)

| Model | Use | License action |
|-------|-----|----------------|
| Duplex / Schependomlaan / KIT FZK-Haus | Showcase mesh + extract storeys | Attribute in `LicenseAttribution` + `docs/BIM-SEED-SOURCES.md` |
| KIT road IFC4.3 | SHD experiment | Same |

Synthetic zones remain the **default** so Railway demo never depends on external download.

### 12.4 Binary assets & reseed

- Reseed clears DEMO spatial rows with other DEMO domain data.  
- Blobs either regenerated or skipped (geometry optional).  
- Seed must be idempotent for CI.

---

## 13. AI integration (Phase 3 — guardrails)

When AI touches the twin:

| Rule | Requirement |
|------|-------------|
| Grounding | Only structured spatial + linked ERP rows (+ retrieved docs with IDs) |
| Citations | “Based on N progress entries / RFI-#…” with deep links |
| Empty | “No spatial data for that zone” — no invented % |
| Permissions | Same tenant/company filters as APIs |
| Latency/cost | Prefer rule-based overlays first; AI for NL query & summaries |
| Labels | AI risk = **suggestion**, not schedule of record |

---

## 14. AR / HUD readiness (Phase 4 — data contract only)

Do **not** build AR UI in MVP. Stabilize:

| Contract | Purpose |
|----------|---------|
| Stable `SpatialNodeId` | Anchors and queries |
| Published graph version | Client cache invalidation |
| Overlay DTO (§6) | Same colors/status on glasses |
| Optional `AnchorPose` later | Device-specific; not required now |
| Update rate | Same as web (poll/as-of), not continuous telemetry |

Any web viewer schema that cannot express node IDs + overlay DTO is rejected.

---

## 15. Phased roadmap (with acceptance criteria)

### Phase 0–1 — Foundation (zones + API + schematic viewer)

**Build:**

- Entities + migration + RLS  
- Permissions seed  
- CRUD graph/nodes (API)  
- Overlay modes: progress, schedule, rfi  
- Web route schematic viewer + side panel  
- mobile3: optional `SpatialNodeId` on progress/daily report + zone picker  
- Demo seed for SCB flagship  

**Accept:**

- [ ] Seeded project shows tree + non-gray overlays with fixture-known values in unit tests  
- [ ] Zone click lists at least one linked progress or RFI from seed  
- [ ] Insufficient-data zones render neutral, not green  
- [ ] Unauthorized user cannot `Spatial.Manage`  
- [ ] Project without graph shows empty state, no 500s  

### Phase 2 — Core value

- Plan sheet links + deep link  
- Photo pins  
- Model upload + conversion happy path for one format  
- Performance pass; storey streaming  
- Cost mode only if allocation links exist  
- Feature flag `features.digitalTwin`  

**Accept:**

- [ ] Overlay p95 within SLO on seed scale  
- [ ] IFC or glTF sample publishes runtime asset OR documented skip if converter not ready  
- [ ] Field user can attach zone on mobile and see it on desktop after sync  

### Phase 3 — Intelligence

- NL query over twin with citations  
- Rule-based risk badges refined; AI optional suggestions  
- Multi-user presence optional  

### Phase 4 — AR path

- Document and freeze overlay+node API for external client  
- Pilot only after Phase 2 stable  

---

## 16. Success metrics (honest)

| Metric | Type | Notes |
|--------|------|-------|
| % progress/daily reports with spatial or plan ref (7d) | Quality | Primary twin-fuel signal |
| Twin MAU among PM + field profiles | Adoption | Per company |
| Median time open twin → first zone drill-in | UX proxy | Product analytics |
| Overlay API error rate | Reliability | |
| Qualitative: “I can see status without calling five people” | PMF | Interview / feedback |

**Do not** report “portfolio construction % complete from twin” without a defined, implemented rollup.

---

## 17. Testing strategy

| Layer | What |
|-------|------|
| Unit | Overlay formulas with fixed progress/RFI fixtures |
| Unit | Hierarchy validation (parent types) |
| Integration | Graph publish, RLS company isolation, permission |
| E2E | Open twin on demo project → select zone → see panel |
| Visual | Optional screenshot of schematic legend states |
| Seed | Assert flagship project has ≥ N zones and ≥1 overlay `ok` |

---

## 18. Rollout

1. Feature flag off by default in production tenants.  
2. Enable for demo tenant + internal pilot project.  
3. PM persona first; field zone picker behind same flag.  
4. Expand after seed coverage metric &gt; threshold (e.g. 30% spatial refs on pilot).  

---

## 19. Open items (remaining — non-blocking)

Resolved decisions are in §3. Still open but **do not block Phase 1**:

| Item | Notes |
|------|-------|
| Exact conversion toolchain (xBIM vs sidecar) | Phase 2 spike |
| Whether Spatial is separate module | Start in ProjectManagement; extract if size warrants |
| Portfolio-level executive twin | Explicitly deferred |
| SignalR vs poll | Poll first |
| Zone required on all field progress | Project setting later |

---

## 20. Implementation checklist (engineering)

1. [ ] Migration: `spatial_graphs`, `spatial_nodes`, link tables, nullable FKs on PM entities  
2. [ ] `PermissionConstants` + role seed  
3. [ ] `ISpatialGraphService`, `ITwinOverlayService`  
4. [ ] Controllers under project spatial routes  
5. [ ] Web: `/projects/[id]/twin` + nav item  
6. [ ] Demo seed spatial for SCB (+ minimal SHD segments)  
7. [ ] mobile zone picker wiring  
8. [ ] Unit tests for overlay formulas  
9. [ ] Feature flag  
10. [ ] `docs/BIM-SEED-SOURCES.md` when first third-party model is vendored  

---

## 21. Why this revision

v1 was a vision sketch. v2 locks MVP decisions, defines entities against **existing** PM/Projects/RFI models, specifies truthful overlays, APIs, permissions, seed, non-goals, and acceptance criteria so implementation does not invent product behavior mid-code.

---

*Pitbull Construction Solutions — Digital Twin Spec v2*  
*Builds on mobile3 capture; truth over polish for all spatial metrics.*
