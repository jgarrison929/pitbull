# Changelog

All notable changes to Pitbull Construction Solutions are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Release headers use ISO-8601 published timestamps. Product version: root `VERSION`.

---

## [Unreleased]

## [2.22.3] - 2026-07-12T18:02:02-07:00

### Added

- **Runway opens** � docs/260712/runway-evidence.md checklist snapshot; no P0 regressions from 2.22.2 product close.

### Notes

- Version **2.22.3**. Verification-only runway to 3.0.0. Next: �1 mobile E2E evidence (2.22.4).

## [2.22.2] - 2026-07-12T17:59:52-07:00

### Added

- **Last product PR (2.22.2)** � AP near-term aging filter (
earTerm=true); persona KPI vitest matrix; office FAQ (title-first roles, demo explore, honest drills); CI mobile/owner required-check notes (jobs optional with continue-on-error).

### Fixed

- **apNearTerm orphan** � drill no longer opens full AP board only; filters Current + 1�30 balances.

### Notes

- **Product band complete at 2.22.2.** Next is runway 2.22.3 (verification/fixes only � no new features).

## [2.22.1] - 2026-07-12T17:56:06-07:00

### Added

- **KPI drill audit matrix** � persona ? KPI ? href ? filter contracts documented; low-severity orphan (pNearTerm proxy) listed for 2.22.2.
- **Office help workflows** � CEO briefing, CFO WIP, PM approvals, Estimator pipeline cards on Help Center.

### Notes

- Version **2.22.1**. Next: orphan KPI fixes + office FAQ + CI notes (2.22.2 last product PR).

## [2.22.0] - 2026-07-12T17:53:28-07:00

### Added

- **Workflow approvals Phase 2 checkpoint** � Status Shipped through 2.22.0; DoD closed (pending aggregate, PM card, mobile time approve, transitions mirror, help, CI smokes).

### Notes

- Version **2.22.0**. Next: KPI drill audit + office help (2.22.1).

## [2.21.9] - 2026-07-12T17:51:51-07:00

### Added

- **Help: approvals workflow** � Help Center cards for PM pending card, mobile time approve, and desktop review; FAQ freezes time-entries lifecycle.

### Notes

- Version **2.21.9**. Next: workflow Phase 2 checkpoint (2.22.0).

## [2.21.8] - 2026-07-12T17:49:34-07:00

### Added

- **Time entry transitions in workflow-transitions.ts** � mirrors C# IsValidTransition (Submitted?Approved/Rejected); vitest + integration tests for review queue / pending aggregate.

### Notes

- Version **2.21.8**. Next: Help approvals workflow (2.21.9).

## [2.21.7] - 2026-07-12T17:47:15-07:00

### Added

- **Mobile time entry approve/reject** � /time-tracking/approval/mobile uses existing review-queue + review APIs (Submitted lifecycle only); large touch targets; reject requires reason. Mobile-field-report already in CI (2.21.5).

### Notes

- Version **2.21.7**. Next: mirror workflow-transitions (2.21.8).

## [2.21.6] - 2026-07-12T17:44:59-07:00

### Added

- **PM home pending approvals card** � live GET /api/approvals/pending totals (time entries + COs); honest empty copy.
- **CI owner-signup-smoke** � Playwright owner-signup project (continue-on-error: true).

### Notes

- Version **2.21.6**. Next: mobile approve/reject time entries (2.21.7).

## [2.21.5] - 2026-07-12T17:42:07-07:00

### Added

- **CI job mobile-smoke** � Playwright mobile-field-report project; continue-on-error: true until branch-protection hardening.

### Notes

- Version **2.21.5**. Next: owner-signup in CI + PM pending card (2.21.6).

## [2.21.4] - 2026-07-12T17:38:51-07:00

### Added

- **GET /api/approvals/pending** � real DB counts for submitted time entries + pending change orders; company-scoped; honest zeros. Expanded lifecycle: timeEntries.

### Notes

- Version **2.21.4**. Next: PM home pending card / CI mobile-smoke (2.21.5).

## [2.21.3] - 2026-07-12T17:36:42-07:00

### Changed

- **Workflow approvals Phase 2 freeze** � mobile approve lifecycle locked to **time entries**; aggregate route GET /api/approvals/pending planned; RFIs/POs deferred. Spec workflow-approvals-phase2.md.

### Notes

- Version **2.21.3**. Next: pending approvals aggregate API (2.21.4).

## [2.21.2] - 2026-07-12T17:34:09-07:00

### Added

- **Intelligence band checkpoint** � mobile-ai-intelligence Status **Shipped through 2.21.2**; DoD closed; notes updated.

### Notes

- Version **2.21.2** closes AI band 2.19.3?2.21.2. Next: workflow Phase 2 freeze 2.21.3.

## [2.21.1] - 2026-07-12T17:32:25-07:00

### Added

- **AI trust boundary docs** � docs/ARCHITECTURE.md section + docs/architecture/AI-TRUST-BOUNDARY.md (confirm-to-apply, sanitizer, demo rate limits, offline honesty).

### Notes

- Version **2.21.1**. Next: intelligence band checkpoint 2.21.2.

## [2.21.0] - 2026-07-12T17:30:37-07:00

### Added

- **Vitest voice + AI merge helpers** � mergeVoiceAndAiSuggestions applies voice transcript then optional AI fill-empty only after confirm.

### Notes

- Version **2.21.0**. Next: AI trust boundary docs (2.21.1).

## [2.20.9] - 2026-07-12T17:28:33-07:00

### Added

- **Integration tests field AI endpoints** � auth required; suggestion DTO never AutoApplied (honest when AI unconfigured).

### Notes

- Version **2.20.9**. Next: vitest voice + AI merge (2.21.0).

## [2.20.8] - 2026-07-12T17:26:37-07:00

### Changed

- **Error boundary on field AI panel** � AI suggestion UI fails soft with manual-entry copy; submit still works.

### Notes

- Version **2.20.8**. Next: integration test mock provider (2.20.9).

## [2.20.7] - 2026-07-12T17:24:45-07:00

### Changed

- **AI rate limits for demo users** � AiRateLimitPolicy applies stricter per-minute permits on i-chat / i-suggest / i-document when JWT is_demo_user=true.

### Notes

- Version **2.20.7**. Next: error boundary AI panel (2.20.8).

## [2.20.6] - 2026-07-12T17:21:04-07:00

### Added

- **Unit tests prompt sanitization** � expanded AiInputSanitizer coverage (injection strip, length/collection limits, context keys).

### Notes

- Version **2.20.6**. Next: rate limit demo users (2.20.7).

## [2.20.5] - 2026-07-12T17:18:54-07:00

### Added

- **Help: AI on mobile FAQ** � mobile FAQ covers field AI confirm-to-apply, offline disabled, optional LLM EOD flag, and photo safety as non-compliance suggestion.

### Notes

- Version **2.20.5**. Next: unit tests prompt sanitization (2.20.6).

## [2.20.4] - 2026-07-12T17:15:37-07:00

### Added

- **PostHog i_suggestion_applied** � diagnostic event when user confirms Apply on field voice or photo safety suggestions (not a vanity KPI).

### Notes

- Version **2.20.4**. Next: Help AI on mobile FAQ (2.20.5).

## [2.20.3] - 2026-07-12T17:13:51-07:00

### Added

- **Schedule slip risk flag (proxy labeled)** � field report shows Watch/Risk chip when linked activity plannedFinish is before report date; insufficient data when no plan date (not all-clear). No invented % complete.

### Notes

- Version **2.20.3**. Next: PostHog ai_suggestion_applied (2.20.4).

## [2.20.2] - 2026-07-12T17:11:58-07:00

### Added

- **AI MVP core checkpoint** � notes docs/ci/mobile-ai-mvp-notes.md; mobile-ai-intelligence status through 2.20.2 (voice ? EOD rule/flag paths).

### Notes

- Version **2.20.2**. Next: risk flag schedule slip proxy (2.20.3).

## [2.20.1] - 2026-07-12T17:09:57-07:00

### Added

- **Optional LLM end-of-day summary behind flag** � NEXT_PUBLIC_FEATURE_FIELD_LLM_EOD defaults **OFF** in prod; rule-based summary always available. When enabled, Review can request POST /api/ai/field-eod-summary as a labeled suggestion only.

### Notes

- Version **2.20.1**. Next: AI MVP core checkpoint (2.20.2).

## [2.20.0] - 2026-07-12T17:07:25-07:00

### Added

- **End-of-day field summary (rule-based)** � Review step shows a form-derived bullet summary (activities, crew, delays, safety, photos/zone). No LLM; not an executive KPI; no invented %/cost/green.

### Notes

- Version **2.20.0**. Next: optional LLM summary behind flag (2.20.1).

## [2.19.9] - 2026-07-12T17:05:18-07:00

### Changed

- **Offline AI disabled with honest copy** � field AI suggest is disabled offline; copy states narratives must be entered manually (no silent pretend success).

### Notes

- Version **2.19.9**. Next: end-of-day field summary rule-based (2.20.0).

## [2.19.8] - 2026-07-12T17:03:27-07:00

### Changed

- **AI suggestion label on all field AI surfaces** � shared AI_SUGGESTION_REVIEW_LABEL (�Suggestion � review before submit�) on notes AI, photo safety, and Review step banner.

### Notes

- Version **2.19.8**. Next: offline AI disabled honest copy (2.19.9).

## [2.19.7] - 2026-07-12T17:01:38-07:00

### Added

- **Photo assist optional safety suggestion (labeled)** � mobile Photos step can offer a caption-heuristic safety note; labeled �Suggestion � review before submit�; apply requires confirm; never auto-posts.

### Notes

- Version **2.19.7**. Next: UI label consistency (2.19.8).

## [2.19.6] - 2026-07-12T16:59:42-07:00

### Added

- **AI usage tracking per company** � AiUsageRecord.CompanyId + GetCompanyRequestCountAsync; field-voice-suggestion logs successful completions with active company for metering.

### Notes

- Version **2.19.6**. Next: photo assist safety suggestion (2.19.7).

## [2.19.5] - 2026-07-12T16:56:52-07:00

### Added

- **Field report Apply AI suggestion chip** � mobile daily report can request structured AI suggestions from notes; chip shows �Suggestion � review before submit�; **Apply** only after user confirm (never auto-applies).

### Notes

- Version **2.19.5**. Next: AI usage tracking per company (2.19.6).

## [2.19.4] - 2026-07-12T16:54:22-07:00

### Changed

- **Construction jargon ? structured narratives prompt** � FieldVoicePrompts.ConstructionJargonSystemPrompt maps field slang (pour, strip forms, rain day, toolbox) into work/delays/safety suggestions; still forbids invented costs/% complete/green.

### Notes

- Version **2.19.4**. Next: Apply AI suggestion chip (2.19.5).

## [2.19.3] - 2026-07-12T16:52:19-07:00

### Added

- **AI field voice suggestion scaffold** � POST /api/ai/field-voice-suggestion (auth + rate limit). Returns structured work/delays/safety suggestion DTO labeled �Suggestion � review before submit�; never auto-applies. When AI unconfigured, honest empty scaffold (no invented narratives).

### Notes

- Version **2.19.3**. Next: construction jargon prompt (2.19.4).

## [2.19.2] - 2026-07-12T16:50:14-07:00

### Added

- **Arc D checkpoint** � digital twin Phase 2 Status **Shipped through 2.19.2**; DoD checkboxes closed; twin-phase2 notes status final.

### Notes

- Version **2.19.2** closes Arc D (2.15.3?2.19.2). Next: Arc E AI / product close 2.19.3?2.22.2.

## [2.19.1] - 2026-07-12T16:48:35-07:00

### Changed

- **docs/ci/twin-phase2-notes.md complete** � full Arc D version map (photo pins ? require spatial close), truth rules, demo skip, capture quality, E2E, integration commands.

### Notes

- Version **2.19.1**. Next: Arc D checkpoint 2.19.2.

## [2.19.0] - 2026-07-12T16:46:24-07:00

### Changed

- **Arc D integration suite tidy** � SpatialEndpointsTests tagged Arc/TwinPhase2; added capture-quality + RequireSpatialOnProgress default integration cases.

### Notes

- Version **2.19.0**. Next: twin-phase2-notes complete (2.19.1).

## [2.18.9] - 2026-07-12T16:44:34-07:00

### Added

- **E2E twin zone round-trip (flag-gated)** � Playwright project 	win-zone-roundtrip covers field zone picker + twin shell + capture-quality when stack/auth available; self-skips honestly otherwise. Documented in twin-phase2 notes.

### Notes

- Version **2.18.9**. Next: Arc D integration suite tidy (2.19.0).

## [2.18.8] - 2026-07-12T16:42:40-07:00

### Added

- **Help: field zone picker + Digital Twin** � Help Center section on where the zone picker lives, optional vs required, demo skip, twin fuel, and capture-quality as labeled data quality (not a KPI).

### Notes

- Version **2.18.8**. Next: E2E twin zone round-trip (2.18.9).

## [2.18.7] - 2026-07-12T16:40:11-07:00

### Added

- **Spatial capture quality metric (labeled)** � GET /api/projects/{id}/spatial/capture-quality returns last-7d % of daily reports + progress entries with SpatialNodeId. Explicitly labeled data quality, not an executive KPI. Empty window ? null percent (honest). Unit tests for calculator.

### Notes

- Version **2.18.7**. Next: Help zone picker + twin (2.18.8).

## [2.18.6] - 2026-07-12T16:38:04-07:00

### Added

- **Demo skip for RequireSpatialOnProgress** � demo JWT (is_demo_user) may submit field progress without a zone; production still enforces. Documented in docs/ci/twin-phase2-notes.md. Honest UI copy on mobile daily report.

### Notes

- Version **2.18.6**. Next: % reports with spatial ref quality metric (2.18.7).

## [2.18.5] - 2026-07-12T16:35:51-07:00

### Added

- **Field report zone prompt when required** � mobile daily report labels zone required when company RequireSpatialOnProgress is on and project has zones; blocks non-draft submit/offline queue with honest toast. Drafts still save without a zone. API submit returns SPATIAL_ZONE_REQUIRED as server-side guard.

### Notes

- Version **2.18.5**. Demo skip path is 2.18.6. Not an executive KPI.

## [2.18.4] - 2026-07-12T16:32:38-07:00

### Added

- **PM setting UI for RequireSpatialOnProgress** � Project Settings desktop card + company setup switch. Optional, default off; honest copy that enforcement lands next. Not an executive KPI.

### Notes

- Version **2.18.4**. Next: field report zone prompt when required (2.18.5).

## [2.18.3] - 2026-07-12T16:30:25-07:00

### Added

- **RequireSpatialOnProgress schema** — company `ProjectSettings` column `ProjRequireSpatialOnProgress` (default **false**). Exposed on project settings GET/PUT and module settings aggregate. Optional; field enforcement is later 2.18.x. Not an executive KPI.

### Notes

- Version **2.18.3**. Migration `AddRequireSpatialOnProgress`. Next: PM setting UI 2.18.4.

## [2.18.2] - 2026-07-12T16:26:34-07:00

### Added

- **Performance / overlays band checkpoint** - shipped through 2.18.2; notes + twin phase2 status updated.

### Notes

- Version **2.18.2** closes perf/overlays band. Next: RequireSpatialOnProgress 2.18.3+.
## [2.18.1] - 2026-07-12T16:24:51-07:00

### Added

- **Overlay SLO evidence (diagnostic)** - table in `docs/ci/twin-overlay-load-scale.md` (batch loads, formula tests, cost honesty). Not an executive KPI.

### Notes

- Version **2.18.1**
## [2.18.0] - 2026-07-12T16:23:08-07:00

### Added

- **Overlay load seed scale doc** - `docs/ci/twin-overlay-load-scale.md` (demo scale + batch query notes).

### Notes

- Version **2.18.0**
## [2.17.9] - 2026-07-12T16:20:57-07:00

### Added

- **Overlay formula vitest regression** - frontend `overlay-formula` mirrors RFI/progress/schedule/cost band thresholds (aligned with API calculator truth rules).

### Notes

- Version **2.17.9**
## [2.17.8] - 2026-07-12T16:18:45-07:00

### Added

- **Cost not-allocated banner** - shown in cost mode when all zones are InsufficientData (`COST_NOT_ALLOCATED_BANNER`).

### Notes

- Version **2.17.8**
## [2.17.7] - 2026-07-12T16:15:40-07:00

### Added

- **Cost overlay honesty** - mode `cost` stays Insufficient unless allocation links; twin UI option + banner. No fake cost heat.

### Notes

- Version **2.17.7**
### Fixed

- **Railway web `npm ci` (package-lock corruption)** - ladder version stamps used global string Replace on `package-lock.json`, rewriting real dep `is-core-module@2.16.x` into non-existent `2.17.x` tarballs. Restored `is-core-module@2.16.2`. Preflight now fails if product VERSION leaks into that package.

## [2.17.6] - 2026-07-12T16:01:36-07:00

### Changed

- **Mobile twin read-only polish** - stack controls on small screens; zone panel full-width under board; touch-friendly min heights preserved for 390×844.

### Notes

- Version **2.17.6**
## [2.17.5] - 2026-07-12T15:59:39-07:00

### Added

- **Overlay fuel timing diagnostics** - `OverlayPerfMetrics` log line + p95 helper (diagnostic only, not a health KPI).

### Notes

- Version **2.17.5**
## [2.17.4] - 2026-07-12T15:57:35-07:00

### Changed

- **Twin storey lazy schematic** - default first storey; schematic zones filtered via `zonesForStorey` (load on demand, not all floors at once).

### Notes

- Version **2.17.4**
## [2.17.3] - 2026-07-12T15:54:39-07:00

### Changed

- **Overlay query batch perf** - RFI/progress/schedule zone-link fuel loads run in parallel via `Task.WhenAll` (GroupBy SQL; no per-zone N+1).

### Notes

- Version **2.17.3**
## [2.17.2] - 2026-07-12T15:52:53-07:00

### Added

- **Model upload band checkpoint** - notes updated; twin phase2 model upload **Shipped through 2.17.2**.

### Notes

- Version **2.17.2** closes model upload band. Next: performance/overlays 2.17.3+.
## [2.17.1] - 2026-07-12T15:51:19-07:00

### Changed

- **Digital Twin feature flag prod default** - documented: `NEXT_PUBLIC_FEATURE_DIGITAL_TWIN` unset/empty = **ON** in production (same as demo/dev). Opt-out via false/0/off.

### Notes

- Version **2.17.1**
## [2.17.0] - 2026-07-12T15:49:49-07:00

### Added

- **Model upload integration happy path** - register → start conversion (Processing, not ready) → fail with error → retry; set-active rejected while not Succeeded.

### Notes

- Version **2.17.0**
## [2.16.9] - 2026-07-12T15:47:01-07:00

### Added

- **Spatial.Manage on model upload** - unit tests assert register/conversion/retry/set-active require `Spatial.Manage`; list requires `Spatial.View`. Integration: anonymous POST 401.

### Notes

- Version **2.16.9**
## [2.16.8] - 2026-07-12T15:44:29-07:00

### Added

- **Model conversion error + retry UX** - fail-conversion with clear error copy; retry-conversion Failed→Processing (still not ready). Twin UI shows error text + Retry button.

### Notes

- Version **2.16.8**
## [2.16.7] - 2026-07-12T15:41:59-07:00

### Added

- **Runtime model version pointer** - `POST .../model-assets/{id}/set-active` selects active runtime version; only **Succeeded** assets may be active (Pending/Processing rejected).

### Notes

- Version **2.16.7**
## [2.16.6] - 2026-07-12T15:40:01-07:00

### Notes

- **Sample glTF/IFC seed skipped** - no bundled open BIM sample in-repo yet (license + size). Model upload remains admin register + conversion stub; demo uses zones-first twin without a 3D package. Honest skip per band acceptance.
- Version **2.16.6**
## [2.16.5] - 2026-07-12T15:37:56-07:00

### Added

- **Model conversion job stub** - `POST .../model-assets/{id}/start-conversion` moves Pending → Processing only; never marks Succeeded/ready.

### Notes

- Version **2.16.5**
## [2.16.4] - 2026-07-12T15:35:26-07:00

### Added

- **Twin model assets admin UI (desktop)** - register Pending models via Spatial.Manage; phone shows read-only status. Never labels Pending/Processing as Ready.

### Notes

- Version **2.16.4**
## [2.16.3] - 2026-07-12T15:33:08-07:00

### Added

- **ModelAsset upload API scaffold** - entity + migration `pm_model_assets`; `GET/POST /api/projects/{id}/spatial/model-assets` (View list / Manage register). Register starts **Pending** — never ready until conversion Succeeded.

### Notes

- Version **2.16.3**
## [2.16.2] - 2026-07-12T15:29:55-07:00

### Added

- **Photo pins MVP checkpoint** - `docs/ci/twin-phase2-notes.md`; digital-twin-phase2 spec status **Shipped through 2.16.2** for photo pins band.

### Notes

- Version **2.16.2** closes photo pins MVP (2.15.3–2.16.2). Next: model upload 2.16.3+.
## [2.16.1] - 2026-07-12T15:27:49-07:00

### Added

- **PostHog `twin_zone_drill` timing** - diagnostic event with `duration_ms` + `pins_empty` when a twin zone is drilled (not a health KPI).

### Notes

- Version **2.16.1**
## [2.16.0] - 2026-07-12T15:25:17-07:00

### Added

- **Integration tests zone + photo pins** - `SpatialEndpointsTests` covers honest empty `photo-pins` (project + zone filter) and auth gate.

### Notes

- Version **2.16.0**
## [2.15.9] - 2026-07-12T15:22:55-07:00

### Added

- **Photo pin aggregation unit tests** - expanded coverage: GPS+zone preference, partial GPS honesty, order/thumbnails, empty zone filter (2.15.9).

### Notes

- Version **2.15.9**
## [2.15.8] - 2026-07-12T15:20:57-07:00

### Added

- **Help twin overlays truth legend** - Help Center section documents overlay bands honestly (gray/insufficient is not all-clear; never all-green default).

### Notes

- Version **2.15.8**
## [2.15.7] - 2026-07-12T15:15:46-07:00

### Changed

- **Twin mobile loading skeleton** - structured board + panel placeholders (`twin-loading-skeleton`) so phones never flash blank white while twin loads.

### Notes

- Version **2.15.7**
## [2.15.6] - 2026-07-12T15:13:50-07:00

### Added

- **Twin overlay poll interval** - default 30s via `resolveTwinOverlayPollMs`; override with `NEXT_PUBLIC_TWIN_OVERLAY_POLL_MS` (`0`/`off` disables).

### Notes

- Version **2.15.6**
## [2.15.5] - 2026-07-12T15:11:46-07:00

### Changed

- **Twin photo pins from daily report GPS/zone** - `ListPhotoPinsAsync` joins `PmDailyReportPhoto` + report `SpatialNodeId`; places pins only when GPS and/or zone exist (no invented coordinates).

### Notes

- Version **2.15.5**
## [2.15.4] - 2026-07-12T15:09:21-07:00

### Added

- **Twin zone panel photo thumbnails** - zone drill fetches `photo-pins` and shows a neutral empty state or thumbnail grid when URLs exist (no fake green / all-clear).

### Notes

- Version **2.15.4**

## [2.15.3] - 2026-07-12T15:02:22-07:00

### Added

- **Twin photo pin API stub** - `GET /api/projects/{id}/spatial/photo-pins` returns honest empty pins (no fake green). `TwinPhotoPinAggregation` pure helpers + unit tests. Real GPS/zone aggregation continues 2.15.5+.

### Fixed

- Residual Arc C wire-ups: `buildSiteWalkHref` / plans mobile search import, progress `activityId` query preselect, site-walk analytics import, offline-store zone/plan types, voice `useCallback` deps (React Compiler).

### Notes

- Version **2.15.3** (Arc D start).

## [2.15.2] - 2026-07-12T15:01:07-07:00

### Added

- **Arc C checkpoint** - `docs/ci/mobile-phase3-notes.md`; site walk/schedule band **Shipped through 2.15.2**.

### Notes

- Version **2.15.2** closes Arc C. Next: Arc D (2.15.3+).

## [2.15.1] - 2026-07-12T15:00:58-07:00

### Changed

- **Mobile schedule empty states** - honest copy when no activities / no critical-path rows (`schedule-empty-copy.ts`).

### Notes

- Version **2.15.1**

## [2.15.0] - 2026-07-12T15:00:24-07:00

### Added

- **Field report schedule activity deep link** - optional `activityId` / `activityName` query on `/daily-reports/mobile` shows banner + progress link.

### Notes

- Version **2.15.0**

## [2.14.9] - 2026-07-12T14:59:58-07:00

### Added

- **PostHog `site_walk_started`** - fired on site walk open with `project_id`; `viewport_class` via `captureProductEvent`.

### Notes

- Version **2.14.9**

## [2.14.8] - 2026-07-12T14:59:36-07:00

### Changed

- **Help site walk workflow** - Site Walk help card references field home **Today on this job** entry path.

### Notes

- Version **2.14.8**

## [2.14.7] - 2026-07-12T14:59:15-07:00

### Changed

- **Site walk twin link** - Digital Twin CTA gated with `shouldShowSiteWalkTwinLink(isDigitalTwinEnabled())` (hidden when flag off).

### Notes

- Version **2.14.7**

## [2.14.6] - 2026-07-12T14:58:51-07:00

### Added

- **Sub status → RFIs** - site walk sub cards deep-link to project RFIs with real `search=` filter (proxy status labels retained; no fake health scores).

### Notes

- Version **2.14.6**

## [2.14.5] - 2026-07-12T14:58:01-07:00

### Added

- **Critical-path filter** on mobile schedule look-ahead cards (`filterCriticalPathTasks` + honest empty copy).

### Notes

- Version **2.14.5**

## [2.14.4] - 2026-07-12T14:57:36-07:00

### Added

- **Schedule look-ahead → progress draft** - mobile schedule cards deep-link to progress with `activityId` / `activityName` preselect banner.

### Notes

- Version **2.14.4**

## [2.14.3] - 2026-07-12T14:57:01-07:00

### Added

- **Today on this job entry** - unified `SITE_WALK_ENTRY_LABEL` on field home last-job card and project hub quick actions via `buildSiteWalkHref`.

### Notes

- Version **2.14.3** (Arc C start).

## [2.14.2] - 2026-07-12T14:56:27-07:00

### Added

- **Arc B checkpoint** - `docs/ci/mobile-phase2-notes.md`; plans viewer band marked **Shipped through 2.14.2**.

### Notes

- Version **2.14.2** closes Arc B. Next: Arc C (2.14.3+).

## [2.14.1] - 2026-07-12T14:56:06-07:00

### Added

- **SW plan metadata cache** - service worker network-first caches `GET /api/projects/{id}/plan-sets` (metadata only; not PDF binaries). `CACHE_VERSION` `v2.14.1`. Contract + vitest in `plan-metadata-cache.ts`.

### Notes

- Version **2.14.1**

## [2.14.0] - 2026-07-12T14:55:39-07:00

### Added

- **Field report PlanSheetId picker** - optional plan sheet select on `/daily-reports/mobile` (loads plan-sets catalog); value flows through `formSnapshot` into online submit and offline queue `PlanSheetId` (existing builders).

### Notes

- Version **2.14.0** (minor roll after 2.13.9).

## [2.13.9] - 2026-07-12T14:54:26-07:00

### Added

- **Plans mobile layout vitest** - composite coverage for field mode, touch targets, admin hide classes, revision labels, and site-walk deep links (`plans-specs-mobile-layout.test.ts`).

### Notes

- Version **2.13.9** — last patch of minor 13 before 2.14.0.

## [2.13.8] - 2026-07-12T14:53:36-07:00

### Added

- **Help: Plans on site** - Field & mobile workflows card with real `/projects/{id}/plans-specs` path and site-walk deep-link note.

### Notes

- Version **2.13.8**

## [2.13.7] - 2026-07-12T14:53:14-07:00

### Added

- **Plan revision label** - `formatPlanRevisionLabel` shows API revision only (never invents `latest`). Used in plans-specs viewer.

### Notes

- Version **2.13.7**

## [2.13.6] - 2026-07-12T14:52:52-07:00

### Added

- **Site walk → Plans deep link with filter** - Plans action uses `buildPlansSpecsHref` + `resolveSiteWalkPlansFilter` (sheet or look-ahead keyword `q`). Plans-specs seeds search from `?q=` / `?sheet=`.

### Notes

- Version **2.13.6**

## [2.13.5] - 2026-07-12T14:52:02-07:00

### Changed

- **Plans mobile touch + search** - codified 44px touch targets and one-handed search input classes (`PLANS_MOBILE_SEARCH_INPUT_CLASS`) for plans-specs.

### Notes

- Version **2.13.5**

## [2.13.4] - 2026-07-12T14:51:36-07:00

### Changed

- **Plans field viewer on phone** - Plans & Specs hides primary admin create/edit/delete CTAs below `lg`; field mode hint + tap-to-view remains. Tokens in `plans-specs-mobile.ts` + vitest.

### Notes

- Version **2.13.4**

## [2.13.3] - 2026-07-12T14:50:51-07:00

### Added

- **Plans field-mode wireframe notes** - `mobile-phase2-plans-viewer.md` documents viewer-default `<lg` vs admin CRUD desktop; Arc B starts.

### Notes

- Version **2.13.3**

## [2.13.2] - 2026-07-12T14:50:27-07:00

### Added

- **Arc A checkpoint** - `docs/ci/mobile-phase1-notes.md` with test commands and manual QA. Mobile Phase 1 band marked **Shipped through 2.13.2**.

### Notes

- Version **2.13.2** closes Arc A (2.12.3–2.13.2). Next: Arc B plans viewer (2.13.3+).

## [2.13.1] - 2026-07-12T14:49:11-07:00

### Added

- **Slim mobile projects list** - `GET /api/projects?view=mobile` returns `ProjectMobileListItemDto` (id, name, number, status only). Field report + time-tracking mobile pickers use it. Unit test proves JSON smaller than full `ProjectDto`. Desktop default shape unchanged.

### Notes

- Version **2.13.1**

## [2.13.0] - 2026-07-12T14:48:11-07:00

### Added

- **Mobile list virtualization** - project RFIs mobile card list uses pure windowing (`list-virtualization.ts`) so only a viewport of rows mounts; server `pageSize` unchanged. Vitest covers 200+ row windows.

### Notes

- Version **2.13.0** (minor roll after 2.12.9).

## [2.12.9] - 2026-07-12T14:47:15-07:00

### Added

- **PostHog field funnel** - `field_report_step` on wizard next/back; `field_report_submitted` (online/offline) continues via `captureProductEvent` which always attaches `viewport_class` (phone/tablet/desktop). Pure builders in `field-report-analytics.ts` + vitest.

### Notes

- Version **2.12.9** — last patch of minor 12 before 2.13.0.

## [2.12.8] - 2026-07-12T14:45:28-07:00

### Fixed

- **Help mobile FAQ accuracy** - removed `fully responsive` blanket claim; FAQ documents field paths (`/daily-reports/mobile`, bottom nav Report/Crew), offline queue + PWA install, and Digital Twin / Plans routes.

### Notes

- Version **2.12.8**

## [2.12.7] - 2026-07-12T14:41:55-07:00

### Added

- **Help Center field workflows** - section "Field & mobile workflows" with Daily Field Report (/daily-reports/mobile), Site Walk (via Projects ? `/projects/{id}/site-walk`), and Offline/PWA cards (3�5 steps + deep links). Shared data in `help-field-workflows.ts` with vitest coverage.

### Notes

- Version **2.12.7**

## [2.12.6] - 2026-07-12T09:40:00-07:00

### Fixed

- **Mobile field report submit workflow** - create always as server-assigned Draft; "Submit" then calls `POST .../daily-reports/{id}/submit` (sending `Submitted` on create returned `INVALID_STATUS_TRANSITION`). Offline client + SW create body omit status the same way.
- **Turbopack monorepo root** - set `turbopack.root` to the web package so local `next dev` resolves `tailwindcss` when a parent `package-lock.json` exists.

### Added

- **Playwright mobile field report E2E complete** - `fieldEng` at 390×844 drives Project → Field → Photos → Review → Submit with demo seed project and asserts daily-report create **200/201**. Wizard action buttons use `data-testid` hooks.

### Notes

- Version **2.12.6**

## [2.12.5] - 2026-07-12T09:20:00-07:00

### Added

- **Playwright mobile field-report scaffold** - `e2e/tests/mobile-field-report.spec.ts` with field persona (`field-eng@demo.local` / Foreman) auth via existing role fixtures, viewport **390×844**, project `mobile-field-report` in `playwright.config.ts`.
- **npm scripts** - `test:mobile-field` / `test:mobile-field:list` under `e2e/package.json`.
- **openAsPersona viewport option** - optional phone viewport on browser context for mobile E2E.

### Notes

- Full 4-step submit E2E deferred to **2.12.6** (`test.skip` placeholder). Scaffold skips cleanly when web/API/auth state unavailable so the suite does not crash.
- Version **2.12.5**

## [2.12.4] - 2026-07-12T09:05:00-07:00

### Fixed

- **Offline daily-report SW sync parity** - service worker POST now includes `FieldActivities`, `TruckConditions`, `TruckNotes`, and optional `SpatialNodeId` / `PlanSheetId` matching client `syncDailyReport` (previously thin payload dropped field chips and twin fuel).

### Added

- **`buildOfflineDailyReportSyncBody`** in `daily-report-offline.ts` — shared pure builder used by client sync; SW mirrors the same keys (plain JS cannot import TS). Vitest covers queue → SW-shaped body with activities + spatial + plan.

### Notes

- Version **2.12.4** — daily-report offline path only; time-entry sync unchanged.

## [2.12.3] - 2026-07-12T08:30:00-07:00

### Fixed

- **Field report mobile chrome** - hide `MobileBottomNav` and quick-action FAB on `/daily-reports/mobile` so the wizard owns a single bottom action bar (no double fixed bars at 390×844).
- **PWA install prompt** - position above bottom nav + `safe-area-inset-bottom` via shared `MOBILE_PWA_PROMPT_POSITION` (was raw `bottom-4` under the nav).

### Added

- **SW shell precache** - `/daily-reports/mobile` in `public/sw.js` `PRECACHE_URLS`; `CACHE_VERSION` bumped to `v2.12.3`.
- **Shared chrome tokens** - `MOBILE_FIELD_WIZARD_ACTION_BAR`, `isFieldReportMobilePath`, PWA offset in `mobile-shell.ts` with vitest coverage.

### Notes

- Version **2.12.3**

## [2.12.2] - 2026-07-12T12:00:00-07:00

### Added

- **3.0.0 program firm path (Arc A–E)** - product ends at `2.22.2` (~101 PRs); runway `2.22.3`→`2.24.2` (20 PRs); major `2.24.2`→`3.0.0` (≈122 PRs total). Old 878-PR / 2.97–2.99 ladder retired for 3.0.0.
- **Agent-ready specs** under `docs/specs/` for mobile Phase 1–3, twin Phase 2, AI, approvals, KPI drills, help, CI smoke.
- **Copy-paste `/goal` prompts** for every version step in `docs/260712/goal-prompts.md`.
- **Post-3.0 product band themes** parked in `docs/roadmap/post-3.0-product-bands.md` (do not block major).
- **PR template** — spec link, version stamp checklist, preflight, help center.

### Changed

- **VERSION-WORKFLOW / plan1 / AGENTS** — single source of truth for Arc A–E → 3.0.0 autonomous loop.
- **AGENTS.md** — required reading by task type; mobile perf rule (no client ledger aggregation).

### Fixed

- **MediatR license warnings in tests/CI** - resolve Lucky Penny community key from `MediatR:LicenseKey` / `MEDIATR_LICENSE_KEY` / `LUCKYPENNY_LICENSE_KEY`; apply in unit `ModuleInit` and on every `AddMediatR` registration; CI injects repo secret `MEDIATR_LICENSE_KEY`.
- **Employees KPI not drillable** - restore Workforce/Employees home cards (executive + overview KPIs) linking to `/employees?isActive=true`; employees-page summary cards filter/scroll to the directory; project labor “Employees” opens team on the job.

### Notes

- **PostHog .NET SDK** - `PostHog` / `PostHog.AspNetCore` **2.2.2 → 2.6.0** (server analytics client) carried from unreleased.
- Version **2.12.2** — docs/agent infrastructure only; mobile chrome and SW parity start at 2.12.3.

## [2.12.1] - 2026-07-12T04:00:00-07:00

### Fixed

- **Role summary N+1** - batch portfolio aggregates in `GetRoleSummary` (projects, COs, bids, employees, compliance) so CEO/estimator home no longer trips `n_plus_one_detected` (~26 queries).
- **RFI list 403 for office/demo roles** - `ProjectAccessService` grants company-wide access to Identity **Manager** (and Admin), matching demo CEO/CFO/PM/Estimator; field User/Supervisor still need an active project assignment.
- **Digital Twin discoverability** - Twin is a primary project nav item (sidebar + mobile hub after Site Walk) and a field home last-job action; no longer buried under "More on this job".
- **Schedule activities/dependencies GET** - site walk / Gantt called list endpoints that only had POST (405); add `ListActivities` / `ListDependencies`.
- **Pay period current 404 noise** - missing period returns **204** (optional UI) instead of 404 that spammed PostHog `api_error`.
- **Admin users list N+1** - batch role load for paged users (and role filter path).
- **pm_daily_reports.Title** - defensive `ADD COLUMN IF NOT EXISTS` after migrate for envs that lagged migration history (Postgres 42703).
- **PM project scope** - Manager company-wide access aligned with RFI gate for schedule/PM create paths.
- Version **2.12.1**

### Added

- **Product funnel events** - `twin_opened`, `field_report_submitted` (online/offline), `workspace_switched` for PostHog analysis beyond pageviews.

## [2.12.0] - 2026-07-11T20:30:00-07:00

### Changed

- **Role UX A-C (simplify workflows)** - role-scoped workspace switcher (field/estimator see My Work + Projects only; CEO drops Admin; CFO/PM trimmed); open-job sidebar is 5 primary links + collapsible More groups; role homes refocused (CEO exceptions first, PM needs-you + approvals, estimator real pipeline dollars, field last-job CTAs).
- Nav schema `2.12.0` re-seeds favorites.
- Field report trucks/material chips only when Pour is selected.
- Version **2.12.0**

## [2.11.0] - 2026-07-11T19:38:59-07:00

### Changed

- **Role UX nav redesign** - workspace menus cleaned for every persona: People is workforce-only (employees, time, payroll, fleet); **Cost Codes** moved to Projects under Estimating (with Bids); finance lands on WIP and leads with AR/billing before GL; operations groups contracts; role favorites/mobile tabs re-seeded for CEO/CFO/PM/field/estimator.
- People workspace landing is **Employees** (was Cost Codes). Nav schema `2.11.0` re-seeds local favorites so demo roles pick up the new IA.
- Version **2.11.0**

### Fixed

- Cost codes no longer appear under People sidebar (misplaced "Day-1 Setup" group removed).

## [2.10.0] - 2026-07-12T02:20:00-07:00

### Added

- **Jobsite Digital Twin MVP** - zones-first spatial graph, truthful overlays (RFI/progress/schedule with linked fuel), zone detail panel, storey/as-of filters, plan-to-zone links, schematic board, Spatial.View/Manage permissions, optional mobile zone+plan fuel, feature flag. Ships the MVP definition of done from `docs/pitbull-digital-twin-spec.md` section 3 without inventing green health or portfolio % complete.
- Version **2.10.0**

### Changed

- Twin ships as a first-class workspace surface (continued 2.8.4-2.9.2 path; product stays 2.x - not a major).

## [2.9.2] - 2026-07-12T02:05:00-07:00

### Added

- **Digital Twin feature flag** - `NEXT_PUBLIC_FEATURE_DIGITAL_TWIN` (default on); hides project nav Twin entry when off
- **Twin to site walk** cross-link from zone panel
- Version **2.9.2**

## [2.9.1] - 2026-07-12T01:55:00-07:00

### Added

- **Schematic twin board** - 2.5D zone card grid colored by overlay bands with explicit Insufficient/Watch/Risk/OnTrack legend (no invented green)
- Version **2.9.1**

## [2.9.0] - 2026-07-12T01:40:00-07:00

### Added

- **Mobile twin fuel round-trip** - pure helpers for optional zone + plan sheet on field reports; offline/online payloads carry SpatialNodeId/PlanSheetId when applied; last-zone remember per project
- Version **2.9.0**

## [2.8.9] - 2026-07-12T01:20:00-07:00

### Added

- **Spatial permissions** - `Spatial.View` / `Spatial.Manage` policies on twin APIs; seeded for Admin, Project Manager (view+manage), Foreman/Executive (view)
- Version **2.8.9**

## [2.8.8] - 2026-07-12T01:00:00-07:00

### Added

- **Plan sheet to zone links** - `SpatialPlanLink` join table; zone detail returns plan sheets with deep links into Plans & Specs
- Version **2.8.8**

## [2.8.7] - 2026-07-12T00:45:00-07:00

### Added

- **Twin storey + as-of filters** - overlay API accepts `storeyNodeId`, `from`, `to`, `asOf`; pure `SpatialGraphFilter` scopes zones under a storey; twin UI storey select + as-of date
- Version **2.8.7**

## [2.8.6] - 2026-07-12T00:30:00-07:00

### Added

- **Zone detail API + twin panel** - `GET /api/projects/{id}/spatial/zones/{nodeId}` returns linked RFIs, daily reports, progress, and schedule activities (or honest empty copy); Digital Twin side panel loads links on zone select
- Version **2.8.6**

## [2.8.5] - 2026-07-12T00:10:00-07:00

### Added

- **Twin overlay fuel from real links** - `SpatialNodeId` on RFI / progress entry / activity progress; `PrimarySpatialNodeId` on schedule activities; overlay modes aggregate open RFIs, progress %, and schedule delay by zone
- **Demo seed fixture bands** - ensure-seeded attaches known RFIs/progress/schedule to named zones so overlays paint Risk/Watch/OnTrack; unlinked zones stay InsufficientData (not invent green)
- Version **2.8.5**

## [2.8.4] - 2026-07-11T23:55:00-07:00

### Added

- **Jobsite Digital Twin (zones-first)** - project spatial graph (Site -> Building -> Storey -> Zone) with authenticated APIs (`/api/projects/{id}/spatial/*`), honest empty/insufficient overlay bands (never invent default-green health), demo seed tree, and project workspace **Digital Twin** page with overlay modes (RFI / progress / schedule proxies)
- **Field report zone context** - optional zone picker on mobile field report (and twin deep-link `?zoneId=`) feeds `SpatialNodeId` on daily reports; skip-safe offline

### Fixed

- **Field home Daily Report** - quick action pointed at `/projects` instead of the mobile field report flow (`/daily-reports/mobile`); restores the path PostHog already shows field users actually use
- Version **2.8.4**

## [2.8.3] - 2026-07-11T23:15:00-07:00

### Fixed

- **Signup dark mode** - Create Account used hardcoded light shell (`bg-white` / `slate-*`) so dark login -> signup looked broken; now theme tokens + amber brand, matching login; verify-email aligned; pre-paint theme script avoids flash
- Version **2.8.3**

## [2.8.2] - 2026-07-11T22:20:00-07:00

### Fixed

- **Mobile home briefing cards** - morning briefing metrics were cramped (3-across), hard to read, and not tappable; now 2-up with larger type, drill-through links, and chevrons; executive/field KPI cards get the same touch-friendly treatment
- **Project Portfolio overflow** - labor $ / % no longer run off-screen on narrow phones (compact $K/$M + wrapping layout)
- **Welcome tour tap-stealing** - on-page tour chip no longer uses full-width fixed layer that blocked dashboard taps

### Added

- **Hard refresh on version change** - when API product version advances past the shell the client has loaded, unregister SW caches and reload once (plus SW `controllerchange` reload); stops field phones stuck on stale PWA shells
- Version **2.8.2**

## [2.8.1] - 2026-07-11T21:40:00-07:00

### Fixed

- **Field report project smart lookup** - pick list was empty because status filter compared numeric enums to API string values (`"Active"`). Coerces status correctly; shows Active / PreConstruction / OnHold jobs; clearer empty-catalog message
- **Field report defaults current job** - when opened with `?projectId=` (site walk, project-context mobile tab) or from recent job context, pre-fills the project; deep-links skip straight to Field capture

### Changed

- **Project mobile nav** - replaced horizontal scroll tabs with a field hub (Site walk, Field report, Plans, Schedule) + searchable "More on this job" sheet; Site walk promoted in sidebar/workspace order
- Version **2.8.1** (patch: field report pick list + project mobile hub; stamps VERSION / package.json / csproj / Docker / compose)

## [2.8.0] - 2026-07-11T16:20:00-07:00

### Added

- **Field / pour capture on mobile daily report** - short path Project -> Field -> Photos -> Review; work chips (Pour / Form / Rebar / Finish / Dirt); truck/material chips (too wet, too dry, rejected, held); crew counts; optional weather; voice notes
- **Offline photos with report queue** - up to 5 images ≤~1.2MB embedded as data URLs; sync uploads them after the report posts; oversized photos honestly skipped
- **Plans drawing files** - plans-specs loads project documents (Plans/PDF/image), View iframe / Open full-screen for field use

### Changed

- Mobile report titled "Field report"; weather demoted to optional fold-in; Review can skip photo step
- Version **2.8.0** (vision-gap field truth after 2.7.x plumbing)

## [2.7.2] - 2026-07-11T15:55:00-07:00

### Fixed

- **PostHog Error Tracking** - `capture_exceptions` enabled; `reportError` dual-writes via `captureException` (not only ad-hoc `$exception`); 5xx fetch path uses same helper; boundaries use single path

### Changed

- **Site walk truth** - renamed to "Today on this job"; shows **crew assigned to this project**, near-term work, and **subs ranked by trade language from the look-ahead** (pour/form before electrical); health badges labeled as proxies (`OK*` / `Watch*` / `Risk*`)

## [2.7.1] - 2026-07-11T15:05:00-07:00

### Changed

- **Cost types match job-cost language** - `CostType` now includes **Sub Labor / Sub Material / Sub Third Party** (+ existing Labor, Material, Equipment, Overhead). Legacy `Subcontract` kept for old rows; API `CostTypeName` uses super-facing labels via `CostTypeLabels`
- **Web cost-codes UI** aligned: filter/create options, badges, summary cards (Sub* + Overhead); shared `lib/cost-type.ts` wire values stable with API
- **Seed / CSI template** remapped so sub codes use splits instead of one generic Subcontract bucket; Overhead present in CSI seed

## [2.7.0] - 2026-07-11T14:15:00-07:00

### Added

- **Mobile3 Phase 1 - Daily report offline + voice** - `/daily-reports/mobile` queues submits via `enqueueDailyReportForSync` when offline or network fails (visible queued badge + OfflineIndicator); SpeechRecognition voice control maps transcripts into work/delays/safety narratives via pure helpers
- **Mobile3 Phase 2 - Plans & Specs field view** - searchable plan/spec filter (`filterPlanSets` / `filterSpecSections`), tap-to-view surface, deep links (`?planId` / `sheet` / `section` / `view`) from daily report
- **Mobile3 Phase 3 - Site walk** - `/projects/[id]/site-walk` composes plans entry, 7-day schedule look-ahead cards, sub status, open RFIs; schedule page gains mobile look-ahead cards; portfolio `/sub-status` at-a-glance

### Changed

- Version bumped to **2.7.0** (mobile3 Phases 1-3 MVP field experience)

## [2.6.0] - 2026-07-11T13:23:44-07:00

### Added

- **Searchable entity lookups (mobile-first)** - shared `EntityLookupField` + pure `filterAndRankEntities` / `selectEntity` helpers with recent-match ranking for project, cost code, phase, and equipment
- **Crew time entry** - project picker is searchable with recent projects (no free-form id typing); mobile crew cards use lookups for cost code / phase / equipment and apply-to-all
- **Mobile daily report** - project step uses searchable + recent project lookup; narratives/weather remain free text by design
- **New RFI** - project field uses the same find-and-match lookup pattern (secondary high-traffic form path)

### Changed

- Version bumped to **2.6.0** (mobile data-entry + role shell continuity after 2.5.0)

## [2.5.0] - 2026-07-10T14:42:00-07:00

### Added

- **Billing applications mobile cards** - AIA G702 list stacks as tappable cards under `sm` (payment due / completed / retainage readable without horizontal page scroll)
- **Owner contracts mobile cards** - contract list same pattern for field/finance phone use
- **AR/AP aging scroll containers** - intentional horizontal swipe + min-width tables so page chrome no longer blows out sideways
- **Demo-role mobile paths** - CEO/CFO/PM/Estimator bottom-nav + FAB evaluated: role-aware FAB (`quickActions`), longest-match active tab, CFO WIP + journal list cards, CEO aging tab

### Changed

- CEO mobile tabs prioritize **Aging** over Bids; CFO tabs use specific billing/WIP paths (no dual-highlight on `/accounting/*`)
- Version bumped to **2.5.0** (second mobile iteration after 2.4.0 shell)

## [2.4.0] - 2026-07-10T14:41:00-07:00

### Added

- **Mobile shell tokens** - shared `mobile-shell` clearance for main content, FAB, and version badge (safe-area aware)
- **Exported `isMobileTabActive`** - pure path matching for role bottom-nav tabs (prefix-safe; no `/projects` vs `/project-management` collision)

### Fixed

- **Dashboard bottom chrome** - main content clears fixed bottom nav + safe-area; content column `min-w-0` / `overflow-x-hidden` stops page-level horizontal scroll
- **Quick Action FAB** - aligns with `lg` bottom nav breakpoint and sits above the nav band
- **Header breadcrumbs** - collapse middle crumbs + truncate on narrow viewports
- **Crew entry weekly grids** - contained horizontal scroll + swipe hint; submit row not covered by nav
- Version bumped to **2.4.0**

## [2.3.0] - 2026-07-10T12:58:16-07:00

### Added

- **PM soft-delete (complete the loop)** - project tasks, daily reports (draft only), job-cost budgets, submittals (not approved/closed), meetings (not completed), narratives (not approved/published), communications, monthly cost projections (draft only), **plan sets / spec sections**, and **RFIs** (`DELETE /api/projects/{id}/rfis/{id}` -> `IRfiService.DeleteRfiAsync`) now soft-delete via service + `DELETE` API; UI no longer hits dead ends
- **Field dashboard active equipment** - role field home shows real active fleet count from `GET /api/equipment?isActive=true` (removed "Coming soon" placeholder)

### Changed

- Docs hygiene: living architecture notes at v2.3+; demo environment doc points at live `demo.pcserp.app` + `deploy/`; ROADMAP-2.1 marked historical; BEST-PRACTICES domain-events section no longer steers toward MediatR-in-controllers
- Version bumped to **2.3.0**

### Fixed

- **Integration migrate** - `20260709140618_AddPmDailyReportTitle` is idempotent (`ADD COLUMN IF NOT EXISTS`) so fresh DBs no longer 42701 after June's `pm_daily_reports.Title` add
- Professionalized public documentation (README, VISION, SECURITY, agent instructions); removed historical planning archive from the tree

## [2.2.1] - 2026-07-10T11:03:00-07:00

### Added

- **Changelog published timestamps** - release headers support date **and** time (ISO-8601); About `/settings/about#changelog` shows local date + time for when each release was published
- **`docs/architecture/README.md`** - explains living vs frozen design docs so agents stop treating Feb 2026 Alpha design notes as current architecture

### Changed

- Version policy: ship **incremental** semver on every user-visible deploy (`VERSION` + CHANGELOG header + Docker defaults together). Same-day minors/patches are distinguishable by version **and** timestamp
- Version bumped to **2.2.1**

### Fixed

- **Railway web deploy after v2.2 KPI drills** - time-tracking page used undefined `viewParam` (Next.js typecheck failed); use `drill.viewEntries`
- Architecture unit test: public `ChangelogController` excluded from required `[Authorize]` (same pattern as `VersionController`)

## [2.2.0] - 2026-07-10T09:10:40-07:00

### Added

- **Role KPI drill-through (answer why)** - pure `roleKpiDrillHref` maps every executive/controller/PM/estimator KPI card to a filtered destination (not bare generic lists)
- **Unbilled backlog list** - `GET /api/projects?unbilled=true` returns active projects with remaining G702 unbilled value (billed/unbilled columns on projects page)
- **Budget alert filter** - `budgetAlert=true&budgetAlertPercent=75|90` filters projects by labor-to-contract proxy and sorts by severity
- **Safety YTD report** - `GET /api/dashboard/safety-incidents` + `/reports/safety` for executive Safety KPI drill
- **Compliance report (non-admin)** - `/reports/compliance?status=attention` for expiring/expired docs without Identity Admin gate

### Changed

- Executive/controller/PM/estimator dashboard card links use metric-true query contracts
- Bids `pipeline=open`, change-orders `status=open`, billing apps `scope=progress`, employees `isActive` honor URL drills
- Version bumped to **2.2.0**

### Fixed

- **Aging page applies `focus` / `overdue`** - AR/AP KPI drills no longer land on unfiltered dual boards; 31+ overdue lines filtered when `overdue=true`
- **Hours This Week drill** - uses `view=entries&period=thisWeek` so list stays on entries with this-week date range (no silent redirect to crew entry)
- **AR − AP Net drill** - lands on full aging board (both AR and AP + net), not `focus=ar` alone
- **RFI drill parity** - Open RFIs KPI uses `status=notClosed` (Open+Answered) to match `Status != Closed` headline count
- **Active projects drill** - `excludeCompleted=true` matches portfolio count (`Status != Completed`)
- **Drill contract table** - `role-kpi-drill-contracts.ts` + parity tests tie each KPI href to its server predicate

## [2.1.0] - 2026-07-10T08:54:03-07:00

### Added

- **Role-native home experience** - shared `RoleProfileResolver` (title-first) for morning briefing, dashboard layout defaults, and JWT `role_profile` / `job_title` claims; CEO no longer receives a PM briefing when Identity role is only `Manager`
- **`GET /api/dashboard/role-summary`** - truthful portfolio metrics (G702 billed-to-date, unbilled backlog, AR/AP aging, safety YTD, compliance, bid pipeline, workforce hires/terms)
- **Executive & Controller dashboards** - wired to role-summary (real AR/AP; honest labels; labor-vs-contract marked as proxy)
- **Estimator dashboard layout** - bid-centric home + estimator morning briefing section (pipeline / due this week)
- **Expanded executive briefing** - contract value, labor over-budget count, open COs, bid pipeline, AR overdue 31+
- **Docs hygiene** - root `AGENTS.md`, `docs/ROLE-EXPERIENCE.md`, `docs/ROADMAP-2.1.md`; refreshed ARCHITECTURE / docs README / BEST-PRACTICES services-first note
- **In-app changelog** - `GET /api/changelog` parses root `CHANGELOG.md` (Keep a Changelog); version badge opens "What's new" dialog for the current app version; About page shows current release notes + recent history
- **Root `VERSION` file** - single documented product version; Docker API/web defaults stamp product version
- **Differentiated demo company archetypes** - seed v12: 01 enterprise GC holding (Summit Builders Group), 02 mid-market commercial GC (Summit Commercial Builders), 03 small-market heavy highway (Summit Highway Division), 04 union multi-division HVAC (Summit Mechanical); see `docs/DEMO-COMPANY-PROFILES.md`
- **Fictional-only demo parties** - seed customers/vendors/agencies/insurers use clearly fictional names (no real brands or real public agencies)
- **Demo role login on `/login`** - one-click CEO / CFO / Project Manager / Estimator buttons call `POST /api/auth/demo-role-login` (password stays server-side); catalog via `GET /api/auth/demo-roles` when `Demo:Enabled`; demo personas skip company-setup gate so they land in the product
- **Always-visible app version** - `AppVersionBadge` in root layout (every page, including login); sidebar About link uses the same `getAppVersion()` helper

### Security

- **Demo admin is read-only** - `DemoRestrictionMiddleware` allows GET on admin/system APIs but blocks POST/PUT/PATCH/DELETE; secrets stay fully blocked; seeded personas are flagged `IsDemoUser` (including backfill) so JWT + email fallback enforce restrictions

### Changed

- **.NET 10 LTS upgrade (#218)** - all projects target `net10.0`; SDK pin (`global.json` 10.0.100 rollForward), CI `DOTNET_VERSION` 10.0.x, Docker `sdk:10.0`/`aspnet:10.0`; Microsoft ASP.NET/EF packages 10.0.9 and Npgsql EF 10.0.2; OpenAPI document transformer updated for Microsoft.OpenApi 2.x; pin `Microsoft.OpenApi` 2.7.5 (GHSA-v5pm-xwqc-g5wc)
- Version bumped to **2.1.0** across API, frontend, Docker defaults, and `VERSION`
- Nav/workspace defaults keyed by JWT `role_profile` (not only Identity role display names)

### Fixed

- **Demo User01 (CEO) is not Identity Admin** - c-suite personas seed as Manager; bootstrap re-syncs exclusive roles so existing `ceo@demo.local` loses Admin on next deploy
- **Demo seed on Railway** - add missing `pm_daily_reports.Title` migration so `DemoBootstrapper` domain seed (projects/bids/etc.) can complete when `Demo__SeedOnStartup=true`
- **Post-signup onboarding gate** - `isSetupComplete` derives from company setup checklist (4 wizard steps), not company name heuristic; new owners with a named company no longer bypass `/settings/company/setup`; wizard marks checklist on completion
- **Dashboard reset** - `ResetToDefaultAsync` re-detects persona layout instead of forcing generic Overview

## [2.0.0] - 2026-07-07T10:06:02-07:00

### Added

- **Unified workflow approval engine (Phase 1)** - tenant admins configure approval chains for change orders (`UnderReview`) and owner billing applications (`PmReview`) via `POST /api/workflow-definitions`
- **Cross-entity My Approvals dashboard** - `GET /api/workflow-approvals/pending` aggregates pending actions; approve/reject via dedicated endpoints with domain transition enforcement (no status bypass)
- **Workflow orchestration layer** - `WorkflowDefinition`, `WorkflowApprovalStep`, and `WorkflowApprovalAction` entities with sequential step progression, pending-action blocking, and `WorkflowTransition` audit on completion
- **Admin UI** - `/admin/workflow-definitions` to create chains; `/my-approvals` for approvers
- **Integration + unit tests** - `WorkflowApprovalServiceTests`, `WorkflowApprovalTests` driving real API transitions end-to-end

### Changed

- Change order and billing application services hook into the approval layer when entering trigger statuses; direct approve/reject blocked while pending workflow actions exist
- Version bumped to **2.0.0** across API, frontend, and docker defaults

### Fixed

- **Owner self-service signup** - login page links to `/signup`; middleware only redirects signup to `/demo` when `NEXT_PUBLIC_DISABLE_REGISTRATION=true`; `pitbull_token` cookie omits `Secure` on HTTP localhost; `buildOwnerRegisterPayload()` trims wizard state to match API validators; idempotent `handleSubmit`; `RoleSeeder` checks `PitbullDbContext` with `IgnoreQueryFilters`; Playwright wizard E2E + Vitest/RTL contract tests
- Workflow approval blocking now covers **all** outbound transitions while pending (including withdraw bypass)
- Approve/reject completion is atomic - entity status is applied before persisting approval action on final approve; reject completes entity transition before marking action rejected
- `EntityRelationship` approver resolution (`ProjectManager`, `Superintendent`) via project -> employee -> user lookup
- Role-based approvers scoped to active company via `UserCompanyAccess`
- Workflow definition validation ensures approved/rejected targets are valid per entity `*StatusTransitions` graphs

## [0.15.0] - 2026-05-01T11:46:04-07:00

### Added

- **Trial Balance, Balance Sheet, and Income Statement** financial reports with drill-down (#0315e8c)
- **AP Payment Processing** with GL integration - partial payments, status workflow, auto journal entries (#cbafeac)
- **Real Estate Development Partnership** COA template with 40 accounts and company provisioning service + admin UI (#e731544)
- **Punch List module** - backend entities, API, migration, seed data, summary cards, filterable table, CRUD dialogs (#d173ff7, #3fb6ae3)
- **Progress -> Schedule -> Cost** foundation and frontend - progress entry, earned value dashboard, cost code mapping, WIP integration (#c0eed35, #0d15015, #0d0100b)
- **Owner-side payment tracking** for pay applications (#d5441c1)
- **Delivery ticket OCR** for daily reports using Vision API (#a1c20e2)
- **Hangfire background job infrastructure** (#36e3bb8)
- **Playwright PR demo video recording** infrastructure (#39df0ff)
- **Blob storage abstraction** with local filesystem and S3/MinIO providers (#e0cb37b)
- **Weather API integration** for daily reports (#1228a5f)
- **Dashboard KPI drill-down** - all cards clickable with filtered URLs (#573ea87, #07696f8)
- **Multi-company demo seed data** - Companies 02, 03, 04 with full data (#140d06b)
- **Public demo self-service signup** with permission lockdown (#7d75717)
- **Seed data versioning** + company profile renames (redacted internal profiles) (#be03406)
- **Comprehensive seed data** for all modules and roles (#de6f7fc)
- **Role-adaptive welcome tour** steps based on user title and role (#208ca12)
- **Secure Swagger API docs** for all environments (#362eaab)
- **O3 offline PWA** with service worker, IndexedDB sync, and offline fallback (#f696828)
- **F4 multi-currency & sales tax** support (#8b16884)
- **Encrypted secrets vault** - entity, CRUD API, admin UI (#9d0921d)
- **Workflow status indicators** - StatusBadge, StatusTimeline, transition tracking (#faacc5b)
- **Cost-to-complete predictions** - per-cost-code linear regression (#2af9706)
- **AI invoice extraction** - Vision API, fuzzy vendor matching, PO lookup (#2116aef)
- **Response caching** extended to read-heavy endpoints (#d56c4bd)
- **Bid-to-project conversion** with Converted status (#072fe20)
- **Stale submittal review notifications** (48h+) (#3e459d5)
- **PDF reports** - WIP Schedule, AR Aging, Project Cost, Submittal Log, Punch List (#77cef80)
- **Enhanced feedback widget** (#b3065e9)
- **Realistic bank reconciliation seed data** for demo (#0b25725)
- **Version API endpoint** (`GET /api/version`) returning version, build date, and commit hash
- **Version display** in sidebar footer and `/settings/about` page
- **Changelog** (this file) updated with full release history

### Fixed

- TypeScript errors in recharts charts blocking deployments since April 4 (#2060897)
- Stale `eslint-plugin-react` patch breaking all frontend builds (#6eea551)
- Token refresh - 30-min JWT, 30-day refresh, session expiry toast (#7146999)
- Mobile navigation visible up to lg breakpoint (#f0cc54f)
- Retention model corrected - hold on contract value from execution, not per-billing (#10e2fa2, #faa3dc9)
- P1 404s - companies list, users/me, contracts, WIP, glossary (#37ad609)
- Dashboard 404 - GET /api/dashboard returns analytics (#b8530c4)
- PostHog error tracking - intercept all fetch() calls, global tracking with session flag (#de234e6, #b0c63f0)
- React hydration mismatch on /employees and /time-tracking/audit (#3e2c92b)
- WipReportLine PercentComplete overflow - numeric(8,6) cannot hold 100 (#5ab50f7)
- BulkDeleteAsync uses SAVEPOINT to prevent transaction poisoning (#ee07ebd)
- Demo signup UX - company switcher 403, wrong default company (#85a6285)
- Company switcher dropdown now functional in header (#d4a8e3a)
- Welcome tour persists across page navigation (#3b83922)
- RBAC policy authorization added to Jobs, PaymentApplications, PaymentApplicationSettings controllers (#410ccad)
- P0 production bugs - workspace switcher, progress entry save, date mapping (#9fd045f)
- Change Orders 404 when navigating from project workspace (#567d9db)
- CI integration fixes - execution strategy, deadline disposal, orphan migration (#cf14552)
- Demo users see pre-seeded employees in crew timecard grid (#2149cac)
- Demo users get wildcard permission in JWT for API policy gates (#5afd576)
- Password validation UI on demo registration page (#6b0e454)
- System health raw SQL column name casing (#583597d)
- Time entry CostCode includes on all queries (#b224b50)

### Security

- Pinned `System.Security.Cryptography.Xml` to 9.0.15 (2 HIGH advisories) (#b678235)
- Updated Next.js -> latest (HTTP smuggling, CSRF bypass, DoS fixes) (#b678235)
- Fixed dompurify, protobufjs, postcss vulnerabilities - 0 npm audit findings (#b678235)
- MEDIUM security - 7 findings + email enumeration fix (#8032d19)

### Changed

- Upgraded Swashbuckle 7.2.0 -> 10.1.4 (#35b7b60)
- Bumped recharts, posthog-js, vitest, UI group, Microsoft packages, AWSSDK.S3, Hangfire.PostgreSql, QuestPDF, coverlet.collector
- Bumped React 19.2.4 -> 19.2.5, eslint-config-next updates
- Version bumped to 0.15.0 across frontend (package.json) and backend (.csproj)

### Tests

- Coverage wave 3 - 43 tests for 5 billing services (#995f34e)
- Punch list report tests use PunchListPriority enum (#abb53ca)

---

## [0.14.4] - 2026-02-21

### Fixed

- Flaky SystemAdmin tests - register module assembly in ModuleInit + sequential collection (#dca3616)

---

## [0.14.3] - 2026-02-21

### Security

- CRITICAL + HIGH - JWT key validation, admin seed gate, pageSize clamp, CORS hardening (#0b35709)

---

## [0.14.2] - 2026-02-21

### Added

- Test coverage wave 2 - EmployeeOnboarding, Employee, AiUsage, TenantSettings (22 tests) (#0044bca)
- Test coverage - PaymentApplicationService + ApiKeyService tests (#bf4244f)

### Security

- HIGH - JWT claim parity + admin route guard (#c109591)
- Open redirect, CSPRNG tokens, constant-time compare, security headers (#73b6e13)

---

## [0.14.1] - 2026-02-21

### Fixed

- Middleware security - tenant enforcement, response sanitization, health check auth (#3309a36)
- Frontend security - Secure cookie flag, no localhost fallback, omit empty auth header (#6650aa4)
- Middleware pipeline ordering - security headers and correlation before exception handler (#b778248)
- Program.cs architecture - auth before rate limiter, Redis health check, gate dev tools (#b778248)
- MEDIUM middleware findings - 404 rate limit, seed timeout gate, company fallback warning (#422f76d)

---

## [0.14.0] - 2026-02-21

### Added

- **AI morning briefing** - role-adaptive personalized dashboard landing (#6c67c78)
- **Workspace navigation** - 7 focused workspaces replace 78-item flat sidebar (#472c9e6)
- **AIA G702/G703 billing system** with owner contracts and SOV (#0b9c46e)
- **Prevailing wage determinations**, PM review workflow, and export system (#52e9ee7)
- **Payroll compliance runs** and certified reports (#51d28d3)
- **Retention & Lien Waiver tracking** + pay period test mocks (#94c774f)
- **Purchase order and invoice matching** workflows (#2a6c1fa)
- **WIP Schedule Phase 1** (#c7e567e)
- **GL Module Phase 1** - journal entries and accounting periods (#5de4b28)
- **Chart of accounts** CRUD and tree UI (#04dce10)
- **AP/AR foundation** entities and vendor/customer CRUD (#20e612a)
- **Bank reconciliation module** - entities, migration, services, controllers, frontend, 24 tests (Sprint 4) (#89960b5)
- **Feature-level RBAC** with 45 permissions and 8 role templates (Sprint 3) (#839cc29)
- **Punch list module**, Gantt chart, submittal PDF (Sprint 2) (#13b3c1d)
- **WH-347 certified payroll** PDF export and AI usage dashboard (Sprint 5) (#ffddc5b)
- **Secrets management**, AI confidence scoring, migration testing (Sprint 6) (#a97da4a)
- **Cost-to-complete prediction**, AI data entry, deadline notifications (Sprint 7) (#efd5232)
- **Integration exports**, AI invoice extraction, notification expansion (Sprint 8) (#265f0d5)
- **Mobile daily reports** with photo capture, dedicated mobile views (Sprint 9) (#a8e34c9)
- **Dashboard customization**, vendor portal, field encryption (Sprint 10) (#98d86df)
- **Migration accelerator**, offline PWA, GPS geofencing, AI service decomposition (Sprint 11) (#647156a)
- **PDF report generation** with QuestPDF + enhanced seed data (#bd88119)
- **AP/AR aging dashboard** + bid-to-project conversion wizard (#febc518)
- **PM module polish** - domain validation, FK fix, Gantt chart, 200+ new tests (#f02b789, #33c7172, #e178ef8)
- **Structured logging** (Serilog), admin health dashboard, in-app feedback widget (#de47645)
- **File upload security validation** (#6a1aea1)
- **UX overhaul** - PM dashboard, help panel, glossary, dashboard preferences (#f8b0438)
- Comprehensive design specs: GL, WIP, AP/AR, payroll compliance, retention, AIA billing, PO matching, Vista migration, schedule module, job cost, document management, workflow engine

### Fixed

- 3 CRITICAL stability bugs - WIP GL double-posting, payment app delta logic, journal entry number races (#69539c3)
- 14 HIGH severity stability bugs - financial integrity, payroll, vendor, time entry (#42ee327)
- 8 MEDIUM severity stability bugs - validation, rounding, security (#9ee73d8)
- Billing carry-forward double-counting and voided app handling (#cd0a319)
- WIP GL posting - account type validation and entry number generation (#00856b1)
- Aging report date arithmetic (#50bea40)
- DemoBootstrapper crash-loop (#4e8a3dc)
- ajv ReDoS vulnerability (#ba9b349)
- Time entry draft hours, PO approval flow, meeting service types (#7da8b6f)

---

## [0.13.0] - 2026-02-19

### Added

- **DotNetCore.CAP event bus** - replaced MassTransit with CAP (MIT-licensed) using PostgreSQL outbox + Redis Streams transport, with in-memory fallback for local dev (#221).
- **Resend transactional email** - verification, password reset, and invitation emails via Resend with example.com domain (#206).
- **Per-user AI rate limiting** - individual user quotas on AI endpoints to prevent abuse (#204).
- **CSI cost code seeding** - new tenants receive standard CSI division codes out of the box (#234).
- **Email notification decorator** - notification service wired to send emails on key events (#234).
- **Approval audit trail page** - dedicated UI for reviewing time entry approvals and rejections (#235).
- **AI chat context awareness** - AI chat detects current page and injects relevant system context (#235).
- **Dashboard quick actions + activity feed** - one-click shortcuts and recent activity on the main dashboard (#237).
- **Pay app print view** - print-friendly layout for G702/G703 payment applications (#237).
- **File upload** on RFI create and daily report pages (#229).
- **Project management page enhancements** - document categories, meeting attendees/minutes, submittal ball-in-court tracking (#249).
- **Vista import UX improvements** - better error display, help center link, footer links (#248).
- **Dark mode consistency + accessibility** - ARIA labels, app version footer, consistent dark theme (#247).
- **404 page** for dashboard routes, onboarding celebration state, keyboard shortcuts (#245).
- **CSV exports** for all report pages (labor cost, profitability, equipment) (#244).
- **Bid-to-project conversion** preview and contract billing progress bar (#243).
- **Crew entry UX** - recent search history, settings status indicators (#242).
- **Empty states** for 6+ list pages with inline form validation (#240).
- **Loading skeletons** on 16 routes (#239).
- **Breadcrumbs** standardized across 22 pages (#252).
- **823 new unit tests** - CSI seeding, email decorator, system health, audit controller (#254).

### Security

- **SQL injection fix** - `SystemHealthService.SafeCountAsync` now uses table name whitelist instead of string interpolation (#250).
- **API error handling hardening** - controllers no longer leak exception messages in production; standardized ProblemDetails responses (#253).
- **Bootstrap-admin privilege escalation** - disabled admin bootstrap endpoint once an admin exists (#203).
- **AI prompt injection sanitization** - zero-width character bypass, metadata sanitization, collection bounds (#201, carried from v0.12.0 sprint).

### Changed

- **MassTransit -> CAP migration** - MassTransit v9 requires commercial Massient license; migrated to CAP (MIT) with PostgreSQL outbox (#221).
- **ESLint 9 -> 10** upgrade (#207).
- **Microsoft packages** upgraded to latest 9.0.x patches (#208).
- **Tailwind CSS 4.1 -> 4.2** with posthog-js and types/node bumps (#251).
- **Sidebar navigation** reordered to match user workflow: daily use -> resources -> financial (#250, #230).
- **Toast error patterns** standardized to title + description format across 28 call sites (#252).
- **Dialog modals** - added max-height and overflow-y-auto to prevent viewport overflow (#251).

### Fixed

- **5 production 500 errors** - systemic `DateTime UTC normalization` converts all `DateTimeKind.Unspecified` to UTC before save (#238).
- **DataProtection key persistence** - keys stored in PostgreSQL instead of ephemeral container filesystem (#222).
- **Same-day bid validation** - bids with due date = today no longer rejected (#223).
- **Bid categories** payload mismatch resolved (#222).
- **Integration test enum deserialization** - 83 test failures fixed with shared `JsonStringEnumConverter` options (#225).
- **MassTransit 9 production crash** - reverted to 8.3.6, then migrated to CAP (#221).
- **5 PostHog-reported API bugs** - enum serialization, RFI DTO, AI 503, employee certifications (#219).
- **Dashboard analytics** - sequential DbContext queries (thread-safety fix) (#218).
- **Sidebar active-link detection** and cost-codes sorting/pagination (#226).
- **Projects pagination**, bid validation, pay app dates, change order status transitions (#227).
- **Loading skeletons**, CSV import parser, verify-email page (#228).
- **Overtime settings** wired to backend API, removed localStorage usage (#231).
- **Signup data persistence** - industryType and employeeRange saved from registration (#231).
- **Setup gating redirect**, pay period date validation, company switch reload (#236).
- **CI repair** - unit test constructor mismatches, architecture exclusions, npm audit scope (#241).
- **Zero build warnings** - removed 12 unused parameters, fixed XML docs, cleaned lint (#246).

### Stats

- **PRs merged (Feb 18-19):** 50+
- **Unit tests:** 1,686 passing
- **Integration tests:** 263 passing
- **Build warnings:** 0 (C# and TypeScript)
- **Lint warnings:** 0
- **Open issues:** 0
- **Open PRs:** 0

---

## [0.12.0] - 2026-02-17

### Added

- Project Management module scaffold with API + data model for schedule, job cost, daily reports, submittals, RFIs, communications, meetings, documents, progress, tasks, and narratives.
- AI module with provider abstraction (OpenAI + Anthropic), tenant-scoped API key management, provider routing, and secure key storage/retrieval.
- Crew-to-payroll Phase 2 PM review flow with review queue, bulk approve/reject decisions, and approval/rejection event publishing.
- PM web experience expanded with 12+ project dashboard pages under `projects/[id]` (schedule, submittals, documents, meetings, communications, daily reports, job cost, tasks, narratives, plans/specs, progress, projections).
- 135+ new unit tests added across PM and AI services, including child-entity scope enforcement and AI provider/key-management behavior.

### Security

- JWT hardening in PM review workflows: reviewer identity is resolved from JWT claims instead of trusting request-body approver IDs.
- Project-scoped bulk review enforcement: PM review queue and review actions are restricted to entries in projects where the reviewer has active manager/supervisor assignment.
- Self-approval guard: reviewers cannot approve or reject their own submitted time entries.
- Child entity project ownership validation for PM endpoints now enforces that referenced parent records belong to the route `projectId`, reducing cross-project/IDOR exposure.
- JWT email fallback support improved for employee resolution (`Identity.Name` with `email` claim fallback) in approval and review flows.

### Fixed

- Stabilized flaky MassTransit consumer unit tests by replacing harness-dependent assertions with deterministic consumer-level verification.
- Fixed PM narrative revision listing to enforce project ownership checks and soft-delete filtering (`!IsDeleted`) before returning revisions.

---

## [0.11.3] - 2026-02-15

### 🚀 Features

- **Crew Timecard Settings** - Company-configurable time entry with daily or weekly modes, detailed or simple weekly entry, default project, and phase/equipment requirements (#67)
- **Auto-Assign Labor Cost Codes** - Crew grid entries automatically receive the default labor cost code, eliminating manual selection for field workers (#68)
- **Streamlined Crew Entry Grid** - Removed cost code column, added equipment hours column, and made crew entry the default time tracking view with navigation tabs (#69)
- **Default Cost Code Seeding** - New tenants receive 7 standard cost codes (LAB, EQP, MAT, SUB-LAB, SUB-MAT, SUB-EQP, OVH) out of the box

### 🐛 Bug Fixes

- **Nullable CostCodeId** - Time entry creation no longer requires an explicit cost code, supporting auto-assignment from crew grid
- **Enum validation on timecard settings** - Invalid TimecardMode or WeeklyEntryMode values now return clear 400 errors instead of silently accepting bad data
- **DefaultProjectId validation** - Settings endpoint verifies the referenced project exists before saving

### 🧪 Testing

- **Controller unit test coverage expansion** - Added tests for 4 more controllers (13/22 total):
 - CostCodesController, DashboardController, EquipmentController, PayPeriodsController
- **Timecard settings test hardening** - Fixed 4 tests to properly seed project data, added invalid DefaultProjectId test
- **Unit test count:** 1,189 (up from 1,063)
- **Total test count:** 1,414 (unit + integration)

---

## [0.11.2] - 2026-02-15

### 🔒 Security

- **Bootstrap-admin privilege escalation fix** - Anonymous endpoint could promote any user to Admin; now guarded so only first-time setup allows unauthenticated access, existing tenants require authenticated Admin caller
- **Rate limiting on admin and user controllers** - All administrative endpoints now enforce request rate limits to prevent enumeration and abuse

### 🧪 Testing

- **Controller unit test coverage expansion** - Added comprehensive unit tests for 9 of 22 API controllers:
 - AuthController (37 tests) - login, register, change-password, profile, bootstrap-admin
 - TimeEntriesController (38 tests) - all 9 endpoints including approval workflows and Vista export
 - ProjectsController (28 tests) - CRUD, AI summary, stats, RFI cost summary
 - EmployeesController (27 tests) - CRUD, project assignments, stats
 - BidsController (29 tests) - CRUD, bid-to-project conversion
 - RfisController (26 tests) - CRUD with cross-project isolation, cost impact
 - SubcontractsController (29 tests) - CRUD with status transitions
 - ChangeOrdersController (34 tests) - CRUD with approval/rejection workflows
 - Middleware (38 tests) - request/response logging, correlation ID, exception handling
- **Unit test count:** 1,063 (up from 815)
- **Total test count:** 1,288 (unit + integration)

---

## [Unreleased] - Multi-Company Architecture (feature/multi-company)

### 🚀 Features

- **Multi-Company Support** - Single tenant, multiple legal entities
 - Company entity with code, name, tax ID, address, fiscal year, branding
 - Vista-style company switcher in navigation - switch without page reload
 - Company admin page with full CRUD (create, edit, deactivate companies)
 - Per-user company access controls with optional role overrides
 - X-Company-Id header on every API request for company-scoped data filtering
 - Auto-creates default company for existing tenants (zero-friction migration)
 - Single-company tenants see no UI changes - fully transparent

### 🏗️ Infrastructure

- **1,184-line architecture design document** covering industry research (Vista, Sage 300, NetSuite), data model, RLS changes, migration strategy, and phased implementation plan
- **ICompanyScoped interface** - clean separation between company-scoped and tenant-scoped entities
- **13 entities upgraded** with CompanyId (Projects, Bids, Subcontracts, Change Orders, Payment Applications, RFIs, Time Entries, Pay Periods, Phases, Projections, Project Budgets, Project Assignments, Bid Items)
- **8 entities remain tenant-scoped** (Employees, Cost Codes, Users - shared across companies)
- CompanyMiddleware, CompanyContext service, and EF Core migration

---

## [0.11.1] - 2026-02-13

### 🚀 RFI Management

- **RFI Management UI** - Complete RFI workflow in the web interface
 - List view with search, status/priority filters, and result count
 - Detail view with tabbed interface (Details + Cost Impact)
 - Create/edit forms with all fields
 - CSV export for RFI lists

- **RFI Cost Impact Tracking** - Full financial visibility
 - New database fields: `EstimatedCost`, `ActualCost`, `DelayDays`, `DelayCost`
 - Document references: `SpecSection`, `DrawingSheet`
 - AI-ready fields: `SuggestedAnswer`, `AiConfidence`
 - Link Change Orders to originating RFIs

- **RFI Cost Impact API** - New endpoints for cost analysis
 - `GET /api/projects/{id}/rfis/{rfiId}/cost-impact` - Single RFI cost breakdown with linked change orders and timeline
 - `GET /api/projects/{id}/rfi-cost-summary` - Project-level aggregates: total costs, delay days, top 5 costly RFIs

- **RFI Cost Impact UI** - Visual cost tracking
 - Tabbed detail view with cost breakdown
 - Linked change orders table with status badges
 - Timeline of events showing RFI lifecycle

- **RFI -> Change Order Workflow** - Seamless cost tracking
 - "Create Change Order" button on RFI detail page
 - Pre-fills description with RFI context
 - Automatically links CO back to originating RFI
 - Full traceability: RFI -> Change Order -> Cost Impact

### 📊 Dashboard Improvements

- **Recently Viewed Section** - Quick access to your recent work
 - Shows last 5 projects, bids, and RFIs you've viewed
 - Click to jump back instantly
 - Persisted in localStorage

- **RFIs Needing Attention Widget** - Never miss critical RFIs
 - Shows overdue RFIs and those assigned to you
 - Sorted by urgency (overdue first)
 - Direct links to RFI detail pages
 - Color-coded priority badges

- **Notification Center** - Stay informed
 - Bell icon in header with unread count badge
 - Dropdown panel with recent notifications
 - Mark as read/unread functionality

### ⚡ User Experience Improvements

- **Global Command Palette** - Keyboard-first navigation (Cmd/Ctrl+K)
 - Search projects, bids, RFIs, and employees
 - Quick actions: create new items, navigate to pages
 - Fuzzy search with keyboard navigation
 - Recent searches remembered

- **Keyboard Shortcuts** - Power user productivity
 - `?` or `Cmd+/` opens help modal with all shortcuts
 - `g p` - Go to Projects
 - `g b` - Go to Bids
 - `g r` - Go to RFIs
 - `g t` - Go to Time Tracking
 - `g d` - Go to Dashboard
 - `c p` - Create new Project
 - `c b` - Create new Bid
 - `Esc` - Close modals/dialogs

- **Dark Mode** - Easy on the eyes
 - Toggle in Settings page
 - Persists across sessions
 - Smooth transition animations
 - Full theme support across all components

- **Breadcrumb Navigation** - Always know where you are
 - Added to all detail pages (Projects, Bids, RFIs, Employees)
 - Clickable navigation back to parent lists
 - Shows current item name

- **Quick Project Switcher** - Fast context switching
 - Dropdown in sidebar header
 - Search/filter your projects
 - One-click to switch active project context

- **Loading Skeletons** - Better perceived performance
 - Shimmer animations on list pages
 - Cards and tables show placeholder content
 - Reduces perceived wait time

- **Copy Link Buttons** - Easy sharing
 - Added to RFIs, Projects, and Bids detail pages
 - One-click copy URL to clipboard
 - Toast confirmation on copy

- **Icon Button Tooltips** - Better accessibility
 - All icon-only buttons now have descriptive tooltips
 - Helps new users discover functionality
 - ARIA labels for screen readers

### 📱 Mobile Improvements

- **Floating Action Button (FAB)** - Quick actions on mobile
 - Fixed position bottom-right on small screens
 - Expandable menu with context-aware actions
 - Create Project, Bid, RFI, Log Time
 - Smooth animations

### 📄 Reporting & Export

- **Printable Project Summary** - Professional reports
 - Print-optimized layout at `/projects/{id}/print`
 - Includes project details, budget, timeline
 - Clean formatting for client presentations

- **RFI CSV Export** - Data portability
 - Export filtered RFI list to CSV
 - Includes all fields and metadata
 - Compatible with Excel and other tools

### ⏱️ Time Tracking Improvements

- **Bulk Approve/Reject** - Faster supervisor workflow
 - Checkbox selection on individual entries
 - "Select All" with indeterminate state
 - Bulk approve/reject with confirmation dialogs
 - Shows success/failure counts

- **Improved Form Validation** - Better feedback
 - Inline validation messages
 - Required field indicators with asterisks
 - Real-time validation as you type
 - Clear error states with recovery hints

### 🐛 Bug Fixes

- Fixed flaky health check integration test (non-serializable HealthReport)
- **Role auto-assignment** - New users now automatically get roles on registration (Admin for first user, User for subsequent). Existing users without roles get backfilled on login.
- **Employee form submission** - Fixed double-quoting bug in request logging middleware that made form data appear corrupted
- **PostgreSQL case sensitivity** - Fixed raw SQL column aliases being lowercased (quote aliases to preserve case)
- **Dark mode consistency** - Improved text contrast and notification center styling in dark theme
- **Database resilience** - Wrapped transactions in execution strategy for Npgsql retry support

### 🧪 Testing

- 19 unit tests for RfisNeedingAttention endpoint
- 8 integration tests for RFI cost impact endpoints
- **Total: 683 unit tests, 198 integration tests (881 total)**

### 🏗️ Code Quality

- Formatted 138 files with `dotnet format`
- Removed 5 stale "Known Issues" from documentation
- Moved BidDto/BidMapper to Features/Shared folder

---

## [0.11.0] - 2026-02-13

### 🚀 Features

- **RFI Cost Impact Tracking** - Track the full financial impact of RFIs through the project lifecycle
 - Link Change Orders to originating RFIs
 - Track delay costs separately from direct costs
 - Document references (spec sections, drawing sheets)
 - AI assistance fields for future answer suggestions
 - *"This RFI cost us $45K in delays"* - now trackable end-to-end

- **RFI Cost Impact API** (Phase 2) - New endpoints for cost analysis
 - `GET /api/projects/{id}/rfis/{rfiId}/cost-impact` - Single RFI cost breakdown with linked change orders and timeline
 - `GET /api/projects/{id}/rfi-cost-summary` - Project-level aggregates: total costs, delay days, top 5 costly RFIs
 - Enables dashboards and reports showing true RFI financial impact

### 🏗️ Infrastructure

- **Architecture:** 🎉 **MediatR removal COMPLETE** - Entire codebase is now MediatR-free!
 - Removed MediatR from ALL 12 controllers (Issue #118)
 - Final batch: DashboardController, RfisController, TimeEntriesController, ProjectAssignmentsController, PayPeriodsController
 - TimeEntriesController: 9 handler usages consolidated into TimeEntryService
 - ProjectAssignmentsController: -307 lines of code
 - PayPeriodsController: 7 handlers deleted
 - Direct service injection improves testability and debugging
 - Preserves CQRS patterns without message bus overhead
 - New `IEmployeeService` with full CRUD + stats operations

- **Demo Environment:** Fixed PostgreSQL session variable handling
 - `SET LOCAL` replaced with `set_config()` function for parameterized queries
 - Resolves Railway demo startup crash

- **ci:** Switched from self-hosted to GitHub-hosted runners (`ubuntu-latest`)
 - Self-hosted runners were offline 23+ hours
 - CI now completes in ~4 minutes (was stuck indefinitely)

### 🐛 Bug Fixes

- **EF Core LINQ:** Fixed `StringComparison.CurrentCultureIgnoreCase` translation errors across 12 files
- **Web UI:** Added missing `date-fns` package and `Switch` component for pay periods page
- **Web UI:** Fixed CostCode import paths in crew entry components
- **Migrations:** Added missing Designer.cs files for PayPeriods and RFI Cost Impact migrations
- **RLS Policies:** Fixed column references from snake_case to PascalCase (`TenantId`)

### Planned

- RFI Cost Impact API endpoints (Phase 2)
- Document management module
- Billing/invoicing module
- Client portal
- Subdomain-based tenant resolution

---

## [0.10.17] - 2026-02-10

### 📊 Test Coverage

- **Bids integration tests** (+2 tests)
 - Delete nonexistent bid returns 404
 - Update bid with mismatched ID returns 400
- **Subcontracts integration tests** (+2 tests)
 - Delete nonexistent subcontract returns 404
 - Update subcontract with mismatched ID returns 400

**Total tests:** 1017 (834 unit + 183 integration)

---

## [0.10.16] - 2026-02-10

### 🐛 Bug Fixes

- **fix(projects):** V2 service methods now filter by `!IsDeleted` - soft-deleted records were being returned
- **fix(projects):** Stats endpoint SqlQueryRaw scalar mapping - added wrapper DTOs to fix EF Core mapping

### 📊 Test Coverage

- **Contracts module validator tests** (+57 tests)
 - CreateSubcontractValidator (22 tests)
 - CreateChangeOrderValidator (19 tests)
 - CreatePaymentApplicationValidator (16 tests)
- **Security middleware tests** (+9 tests)
 - SecurityHeadersMiddleware header verification
- **Bids integration tests** (+3 tests)
 - Convert to project workflow
- **Projects V2 integration tests** (+5 tests)
 - Full CRUD coverage for V2 endpoints
- **RFI integration tests** (+2 tests)
 - Nonexistent RFI edge cases
- **Various module integration tests** (+10 tests)
 - Tenants, SeedData, TimeEntries, Dashboard

**Total tests:** 1013 (834 unit + 179 integration) 🎉 **Crossed 1000 tests milestone!**

---

## [0.10.15] - 2026-02-10

### 📊 Test Coverage

- **Integration tests for PaymentApplications endpoints** (+6 tests)
 - Update payment application
 - Update nonexistent payment application returns 404
 - Update with mismatched ID returns 400
 - Delete draft payment application
 - Delete nonexistent payment application returns 404
 - Cannot delete submitted payment application
- **Integration tests for TimeEntries approval workflow** (+8 tests)
 - Approve/reject auth checks
 - Project-based time entry filtering
 - Labor cost report endpoint
- **Integration tests for Dashboard** (+3 tests)
 - Weekly hours endpoint coverage
- **Integration tests for Users** (+6 tests)
 - Role assignment endpoints

### 📝 Documentation

- Updated README with accurate test counts (924 passing)
- Updated Alpha 0 roadmap with module list

### 🔧 Infrastructure

- Fixed Testcontainers deprecation warning (CS0618)

**Total tests:** 930 (768 unit + 162 integration)

---

## [0.10.14] - 2026-02-10

### 🐛 Bug Fixes

- **fix(employees):** Corrected `CreateEmployeeCommand` argument order in controller - was passing parameters in wrong order
- **fix:** Corrected raw SQL column names in stats queries - changed from snake_case to PascalCase to match EF Core conventions
- **fix(timetracking):** Corrected `Result.Failure` parameter order in `CreateEmployeeHandler`

---

## [0.10.13] - 2026-02-09

### 🏗️ Infrastructure

- **Module cleanup complete**: Removed incomplete HR and Payroll modules that were blocking production deployments
- **CI reliability improvements**: Added workspace cleanup to self-hosted runner to prevent stale file issues
- **Database migration cleanup**: Removed orphaned migration files to ensure clean schema state

### 🐛 Bug Fixes

- Fixed Railway deployment failures caused by incomplete module references
- Fixed CI build failures from cached test files on self-hosted runner
- Fixed EF Core migration warnings that were failing integration tests

### 📊 Test Coverage

- **Total tests**: ~900 (reduced from 1244 after removing HR/Payroll test suites)
- Test count decreased as a result of module removal - actual coverage of active modules remains complete

---

## [0.10.12] - 2026-02-09

### 📊 Test Coverage Milestone

- **Total tests**: 1244 (1000 unit + 244 integration)
- **New integration tests**: +24
 - EmployeesEndpointsTests (+24): Comprehensive coverage including auth, CRUD, tenant isolation, filtering by department/employment status, search, soft-delete behavior

### 🏗️ Infrastructure

- Added `.dockerignore` to optimize Docker builds and exclude incomplete modules
- Commented out HR/Payroll project references until modules are production-ready
- Faster build times by excluding test files, documentation, and build artifacts from Docker context

---

## [0.10.11] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1220 (1000 unit + 220 integration)
- **New integration tests**: +9
 - ProjectAssignmentsEndpointsTests (+9): Auth tests (4), CRUD tests (2), error handling tests (3)

### 🐛 Bug Fix

- Fixed `ProjectAssignmentsController` returning 400 instead of 404 for nonexistent assignments
 - Handler returned `ASSIGNMENT_NOT_FOUND` but controller only checked for `NOT_FOUND`

---

## [0.10.10] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1211 (1000 unit + 211 integration)
- **New integration tests**: +7
 - ProjectsEndpointsTests (+7): Update, delete, filter by type, search by name, stats 404, cannot update nonexistent, cannot delete nonexistent

### 📝 Documentation

- Updated README with current test counts (1211)
- Updated recent wins section

---

## [0.10.9] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1204 (1000 unit + 204 integration)
- **New integration tests**: +9
 - SubcontractsEndpointsTests (+5): Update, delete, filter by project, search by name, nonexistent update
 - ChangeOrdersEndpointsTests (+4): Delete, filter by subcontract, filter by status, nonexistent delete

### 📝 Documentation

- Updated README with current test counts (1204)
- Updated recent wins section - Contracts module test coverage expanded

---

## [0.10.8] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1195 (1000 unit + 195 integration)
- **New integration tests**: +18
 - HRWithholdingElectionsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, tax jurisdiction filtering, current elections by employee, auto-expiration of previous elections, W-4 fields
 - HREVerifyCasesEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, by-employee endpoint, needs-action endpoint, status updates (TNC, authorized, etc.)
- **HR Module 100% Complete!** All 10 HR controllers now have integration test coverage

### 📝 Documentation

- Updated README with current test counts (1195)
- Updated recent wins section - HR module test coverage complete!

---

## [0.10.7] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1177 (1000 unit + 177 integration)
- **New integration tests**: +9
 - HRUnionMembershipsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, union local filtering, by-employee endpoint, dispatch tracking, fringe rates

### 📝 Documentation

- Updated README with current test counts (1177)
- Updated recent wins section

---

## [0.10.6] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1168 (1000 unit + 168 integration)
- **New integration tests**: +44
 - HRPayRatesEndpointsTests (+9): Auth, CRUD, tenant isolation, fringe benefits, employee filtering, active rates endpoint
 - HRCertificationsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, type code filtering, expiring certs endpoint
 - HREmergencyContactsEndpointsTests (+8): Auth, CRUD, tenant isolation, employee filtering, by-employee endpoint
 - HRDeductionsEndpointsTests (+9): Auth, CRUD, tenant isolation, garnishments, employee filtering, active deductions endpoint
 - HREmploymentEpisodesEndpointsTests (+9): Auth, list/get, tenant isolation, employee filtering, termination workflow, delete
 - HRI9RecordsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, eligibility verification workflow

### 📝 Documentation

- Updated README with current test counts (1168)
- Updated recent wins section with comprehensive HR module coverage

---

## [0.10.5] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1150 (1000 unit + 150 integration)
- **New integration tests**: +35
 - HRPayRatesEndpointsTests (+9): Auth, CRUD, tenant isolation, fringe benefits, employee filtering, active rates endpoint
 - HRCertificationsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, type code filtering, expiring certs endpoint
 - HREmergencyContactsEndpointsTests (+8): Auth, CRUD, tenant isolation, employee filtering, by-employee endpoint
 - HRDeductionsEndpointsTests (+9): Auth, CRUD, tenant isolation, garnishments, employee filtering, active deductions endpoint

### 📝 Documentation

- Updated README with current test counts (1150)
- Updated recent wins section with full HR sub-module coverage

---

## [0.10.4] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1133 (1000 unit + 133 integration)
- **New integration tests**: +18
 - HRPayRatesEndpointsTests (+9): Auth, CRUD, tenant isolation, fringe benefits, employee filtering, active rates endpoint
 - HRCertificationsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, type code filtering, expiring certs endpoint

### 📝 Documentation

- Updated README with current test counts (1133)
- Updated recent wins section with HR module test coverage

---

## [0.10.3] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1115 (1000 unit + 115 integration)
- **New integration tests**: +18
 - AdminAuditEndpointsTests (+6): Auth, listing, pagination, filters, resource types, action types
 - AdminCompanyEndpointsTests (+5): Auth, default settings, update, minimal update, persistence
 - UsersEndpointsTests (+7): Auth, listing, user details, roles, search, pagination

### 📝 Documentation

- Updated README with current test counts (1115)
- Updated recent wins section with admin panel test coverage

---

## [0.10.2] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1097 (1000 unit + 97 integration)
- **New integration tests**: +41 (from 56 to 97)
 - Dashboard endpoints (+3): Auth, response validation, tenant isolation
 - CostCodes endpoints (+8): Pagination, filters, search
 - Monitoring endpoints (+7): Version, health, security status
 - Auth endpoints (+9): Login, register, profile, change-password
 - Health endpoints (+3): Liveness, readiness, combined health
 - Tenants endpoints (+5): Current tenant, access control, cross-tenant security
 - Admin Users endpoints (+6): List, get, roles, search

### 📝 Documentation

- Updated README with current test counts (1097)
- Updated recent wins section

---

## [0.10.1] - 2026-02-08

### 🔒 Security

- **Payroll RLS Policies**: Multi-tenant isolation for pay_periods, payroll_batches, payroll_entries, payroll_deduction_lines
- **HR RLS Policies**: Multi-tenant isolation for all 10 HR schema tables
- All tenant-scoped tables now have database-level row security

### 🐛 Bug Fixes

- Fixed BidNumber -> Number column reference in dashboard raw SQL query
- Fixed Payroll module registration in Program.cs (was causing PendingModelChangesWarning)

### 📊 Test Coverage

- **Total tests**: 1056 (1000 unit + 56 integration)
- **New integration tests**: 18 (10 Payroll + 8 HR Employees)
- Tests verify tenant isolation, CRUD operations, auth requirements, and unique constraints

---

## [0.10.0] - 2026-02-08

### 🎉 HR Module Complete!

Full HR Core module with 10 entities, 10 controllers, 55+ endpoints.
Foundation for Payroll -> Job Costing -> Accounting pipeline.

### ✨ New Entities (this release)

- **EmploymentEpisode CRUD**: Rehire tracking for construction's 60%+ turnover
 - Auto-incrementing episode numbers per employee
 - Separation reason tracking
 - Prevents duplicate active episodes

- **WithholdingElection CRUD**: Federal W-4 and state tax elections
 - 2020+ W-4 fields (filing status, multiple jobs, dependents, extra withholding)
 - All 50 states + DC + PR validation
 - Effective dating (new elections auto-expire previous)

- **Deduction CRUD**: Payroll deductions management
 - Benefits (health, dental, vision, 401k with employer match)
 - Garnishments with court case tracking (child support, tax levies)
 - Union dues, charity contributions
 - Pre-tax vs post-tax handling
 - YTD tracking for annual limits

- **UnionMembership CRUD**: Union labor management
 - Union local and membership tracking
 - Apprentice level tracking (1-10)
 - Dispatch tracking (number, date, list position)
 - Fringe benefit rates (H&W, pension, training)
 - Dues paid status and expiration

- **I9Record CRUD**: Employment eligibility verification
 - Section 1: Employee information + citizenship status
 - Section 2: Employer document verification (List A/B/C)
 - Section 3: Reverification for work auth expiration
 - `/reverification-needed` endpoint for compliance dashboard

- **EVerifyCase CRUD**: DHS employment verification
 - Case submission and status tracking
 - SSA and DHS verification results
 - TNC (Tentative Non-Confirmation) workflow
 - `/needs-action` endpoint for pending cases

### 📊 Test Coverage

- **Total tests**: 991 unit tests passing
- **Test growth**: +20 tests from 0.9.0

---

## [0.9.0] - 2026-02-08

### ✨ New Features

- **HR Module Certification CRUD**: Full certification tracking for compliance
 - `POST /api/hr/certifications` - Create employee certification
 - `GET /api/hr/certifications/{id}` - Get certification details
 - `GET /api/hr/certifications` - List with filtering (status, type, expiring)
 - `PUT /api/hr/certifications/{id}` - Update certification
 - `DELETE /api/hr/certifications/{id}` - Soft-delete certification
 - `GET /api/hr/certifications/expiring` - Compliance dashboard convenience endpoint
 - Supports expiration tracking, verification status, warning notifications
 - 39 new tests (validators + handlers)

- **HR Module PayRate CRUD**: Construction-specific pay rate management
 - `POST /api/hr/pay-rates` - Create pay rate
 - `GET /api/hr/pay-rates/{id}` - Get pay rate details
 - `GET /api/hr/pay-rates` - List with filtering (type, project, shift, state)
 - `PUT /api/hr/pay-rates/{id}` - Update pay rate
 - `DELETE /api/hr/pay-rates/{id}` - Soft-delete pay rate
 - `GET /api/hr/pay-rates/employee/{id}/active` - Active rates for employee
 - Supports effective dating, project-specific rates, shift differentials
 - Union fringe benefits (H&W, pension, training) with TotalHourlyCost calculation
 - Priority-based rate selection for complex scenarios
 - 34 new tests (validators + handlers)

- **HR Module DeleteEmployee**: Soft-delete endpoint for HR employees
 - `DELETE /api/hr/employees/{id}`
 - 3 new tests

### 📊 Test Coverage

- **Total tests**: 971 (933 unit + 38 integration)
- **Test growth**: +72 tests from 0.8.6

---

## [0.8.6] - 2026-02-08

### 🐛 Bug Fixes

- **TimeTracking Soft-Delete Filtering**: Completes consistency across ALL modules
 - `GetEmployeeHandler`, `ListEmployeesHandler` now filter deleted records
 - `GetTimeEntryHandler`, `ListTimeEntriesHandler` now filter deleted records
 - All 5 modules now have proper soft-delete filtering

---

## [0.8.5] - 2026-02-08

### 🐛 Bug Fixes

- **Soft-Delete Filtering Consistency**: Fixed data integrity across all modules
 - **Bids**: `GetBidHandler`, `ListBidsHandler` now filter deleted records
 - **Projects**: `GetProjectHandler`, `ListProjectsHandler` now filter deleted records
 - **Contracts**: All handlers (Subcontracts, Change Orders, Payment Applications) filter deleted records
 - **RFIs**: `GetRfiHandler`, `ListRfisHandler` now filter deleted records
 - Ensures proper data lifecycle management across the platform

### 🏗️ Infrastructure

- **Railway Deployment Fix**: Resolved multi-service deployment issues
 - Moved from root `railway.toml` to service-specific `railway.json` configs
 - Fixed web Dockerfile to use relative paths with Root Directory
 - API: `src/Pitbull.Api/railway.json`
 - Web: `src/Pitbull.Web/pitbull-web/railway.json`
 - Production deploys now working correctly

- **CI Migration Safety**: Added automated checks for dangerous migration patterns
 - Detects `DROP TABLE`, `DROP COLUMN`, `DELETE FROM` without safeguards
 - Prevents accidental data loss in production deployments

### 🧪 Test Coverage

- **Integration Tests**: +24 new integration tests
 - Bids: +4 (CRUD, status workflow, soft-delete)
 - RFIs: +6 (auth, CRUD, status, numbering, multi-tenant)
 - Contracts: +14 (Subcontracts, Change Orders, Payment Applications)
- **Total tests:** 806 (768 unit + 38 integration)

---

## [0.8.4] - 2026-02-08

### 🧪 Test Coverage

- **RFI Handler Tests** (PR #147): +36 comprehensive handler tests for RFI module
 - CreateRfiHandler (14 tests): RFI creation, sequential numbering, ball-in-court defaults
 - GetRfiHandler (5 tests): retrieval, project isolation, all field mapping
 - ListRfisHandler (14 tests): status/priority/user filtering, search, pagination
 - UpdateRfiHandler (18 tests): field updates, status transitions (Open->Answered->Closed), timestamp logic

### 📊 Test Stats

- **Total tests:** 782 (768 unit + 14 integration)
- All modules now have comprehensive handler test coverage

---

## [0.8.3] - 2026-02-08

### 🧹 Quality Improvements

- **EF Core Query Diagnostics** (PR #146): Development-only diagnostics to catch performance issues early
 - Enable detailed errors and sensitive data logging in dev
 - Log N+1 query warnings (MultipleCollectionIncludeWarning)
 - Throw on potential unintended Equals() usage in queries
- **Connection Pool Configuration**: Added production-ready pool settings documentation
 - Maximum Pool Size: 50 (prevents exhaustion)
 - Connection Idle Lifetime: 300s
 - Updated .env.example with pool documentation

### 📊 Quality Strategy

- **v0.2.0 Checklist: 4/7 items complete**
 - ✅ N+1 query detection in dev
 - ✅ Missing database indexes
 - ✅ Multi-SaveChanges transaction rule (documented + verified)
 - ✅ DB connection pool configuration

---

## [0.8.2] - 2026-02-08

### 🔒 Security

- **Optimistic Concurrency for TimeTracking**: Added PostgreSQL `xmin` concurrency tokens to prevent "last write wins" data corruption
 - Employee entity: concurrent edit protection
 - TimeEntry entity: concurrent edit protection
 - ProjectAssignment entity: concurrent edit protection
 - CostCode entity: concurrent edit protection

### 📊 Quality Milestone

- **v0.1.0 Quality Checklist: 13/13 COMPLETE** ✅
 - All P0 security items done
 - All P1 architecture items done
 - Foundation ready for Beta Demo phase

### 🗄️ Database

- Migration `20260208071202_AddOptimisticConcurrencyToTimeTracking`
- Uses PostgreSQL system column `xmin` (no additional storage overhead)

---

## [0.8.1] - 2026-02-08

### 🧪 Test Coverage

- **Contracts Handler Tests**: +45 comprehensive handler tests
 - GetChangeOrderHandler (4 tests): retrieve, not found, approval/rejection details
 - ListChangeOrdersHandler (9 tests): filtering, search, pagination, ordering
 - UpdateChangeOrderHandler (11 tests): field updates, duplicate detection, status transitions
 - GetPaymentApplicationHandler (4 tests): retrieve, not found, approval/paid details
 - ListPaymentApplicationsHandler (8 tests): filtering, pagination, ordering
 - UpdatePaymentApplicationHandler (9 tests): recalculation, status transitions, subcontract sync

### 📚 Documentation

- **README.md**: Updated test count (733), Contracts module status
- **RfisController**: Added full OpenAPI documentation (ProducesResponseType, XML docs, examples)
- 16/16 API controllers now have comprehensive Swagger documentation

### 📈 Stats

- **Test count: 733** (719 unit + 14 integration)
- +45 handler tests from PR #141

---

## [0.8.0] - 2026-02-08

### ✨ New Module: Contracts Management

The Contracts module provides comprehensive subcontract lifecycle management:

#### Subcontracts (#138)
- **Subcontract entity** linked to projects with full CRUD
- Contract values: original, current, billed, paid, retainage tracking
- Subcontractor info: name, contact, email, phone, address
- Scope of work and trade code classification
- Status workflow: Draft -> Active -> Completed -> Closed
- Insurance/compliance tracking with expiration dates

#### Change Orders (#139)
- **Change order entity** linked to subcontracts
- Financial impact tracking (positive/negative amounts)
- Schedule impact (days extension)
- Approval workflow: Pending -> Approved/Rejected/Void
- Automatic subcontract value updates on approval
- Audit trail: submitted/approved/rejected dates, approver tracking

#### Payment Applications (#140)
- **AIA G702-style billing** with full pay app workflow
- Auto-calculated amounts from previous applications
- Retainage calculations matching subcontract terms
- Status workflow: Draft -> Submitted -> UnderReview -> Approved/PartiallyApproved/Rejected -> Paid
- Automatic subcontract totals sync when marked Paid
- 26 new validator tests for comprehensive coverage

### 📈 Stats

- **Test count: 688** (674 unit + 14 integration)
- +137 tests from Contracts module
- 3 new API controllers: SubcontractsController, ChangeOrdersController, PaymentApplicationsController

### 🗄️ Database

- Migration `20260208030543_AddContractsModule` - Subcontracts and ChangeOrders
- Migration `20260208050611_AddPaymentApplications` - Payment Applications

---

## [0.7.8] - 2026-02-07

### 🔒 Security

- **RLS Policies for TimeTracking**: Added missing Row-Level Security policies for `employees`, `time_entries`, and `employee_project_assignments` tables
 - Migration `20260207120000_AddMissingRLSPolicies` ensures tenant isolation
 - Critical fix: tables added after initial RLS migration were unprotected

### 🧪 Test Coverage

- **TimeEntries Integration Tests**: 5 new integration tests for TimeTracking API
 - Authentication requirements
 - CRUD operations
 - Multi-tenant isolation
 - Duplicate employee number validation

### 📈 Stats

- **Test count: 551** (537 unit + 14 integration)
- +5 integration tests for TimeTracking security verification

---

## [0.7.7] - 2026-02-07

### 🧪 Test Coverage

- **RFI Validators**: CreateRfiValidator (19 tests), UpdateRfiValidator (26 tests)
 - ProjectId, Subject, Question, Priority validation
 - Answer length validation for updates
 - Status enum validation (Open/Answered/Closed)
 - All edge cases and workflow scenarios covered

### 📈 Stats

- **Test count: 546** (537 unit + 9 integration)
- +45 tests from RFI validator coverage

---

## [0.7.6] - 2026-02-07

### 🛠️ Infrastructure

- **CI Fix for Self-Hosted Runner**: Removed `setup-dotnet` step from `ci-self-hosted.yml` that was failing with permission denied errors when trying to write to `/usr/share/dotnet`. Self-hosted runner has .NET pre-installed.

### 🧪 Test Coverage

- **Auth Validators**: LoginRequest (12 tests), RegisterRequest (25 tests) 
- **TimeTracking Handlers**: Complete coverage for ListTimeEntries, ListEmployees, ApproveTimeEntry, RejectTimeEntry, GetTimeEntry, CreateEmployee handlers

### 📈 Stats

- **Test count: 502** (493 unit + 9 integration)
- All CI workflows passing

---

## [0.7.4] - 2026-02-07

### 🔧 Code Quality

- **User Context for Soft Deletes**: `ProjectService` now captures actual user ID for `DeletedBy` field instead of hardcoded "system"
 - Injected `IHttpContextAccessor` into service
 - Added `GetCurrentUserId()` helper method (same pattern as DbContext)
 - Provides proper audit trail for soft delete operations

- **Improved Error Logging**: Enhanced domain event error messages in `PitbullDbContext` to include exception type

### 📈 Stats

- **Test count: 413** (no change - code quality fix only)

---

## [0.7.3] - 2026-02-07

### 🔒 Data Validation Sprint

Comprehensive FluentValidation coverage for all command types across TimeTracking, Projects, and Bids modules.

#### TimeTracking Validators
- `CreateTimeEntryValidator` - Date, hours, required field validation (18 tests)
- `UpdateTimeEntryValidator` - Approval workflow rules, hours validation (18 tests)
- `CreateEmployeeValidator` - Required fields, email, rate limits (22 tests)
- `UpdateEmployeeValidator` - Termination date logic, all field validation (20 tests)
- `AssignEmployeeToProjectValidator` - Role, date range validation (13 tests)
- `RemoveEmployeeFromProjectValidator` - Both ID variants covered (8 tests)
- `ApproveTimeEntryValidator` - Approver required, comments length (6 tests)
- `RejectTimeEntryValidator` - Reason required with length limit (7 tests)

#### Projects/Bids Validators
- `DeleteProjectValidator` - Project ID required (2 tests)
- `DeleteBidValidator` - Bid ID required (2 tests)

### 📈 Stats

- **Test count: 413** (404 unit + 9 integration) 🎉
- **Hit 400 unit tests milestone!**
- +116 new tests in one overnight session
- All Commands in TimeTracking, Projects, and Bids modules now have validators

---

## [0.7.2] - 2026-02-06

### 🔧 Code Quality

- Fixed 5 compiler warnings across tests and API docs
- Added 7 tests for `ConvertBidToProjectValidator`
- **Test count: 297** (288 unit + 9 integration)

#### Warning Fixes
- CS1998: Removed unnecessary async from sync test methods
- CS8625: Fixed null reference warnings in mock setup
- CS1573: Added missing CancellationToken param documentation

---

## [0.7.1] - 2026-02-06

### 🧪 Test Coverage Sprint

Massive test coverage expansion with 58 new tests added in a focused sprint.

#### Handler Tests
- `GetProjectHandler` - 5 tests for project retrieval
- `GetBidHandler` - 5 tests for bid retrieval with items
- `UpdateBidHandler` - 4 tests for bid updates and status changes
- `UpdateProjectHandler` - 4 tests for project updates

#### Validator Tests
- `CreateProjectValidator` - 9 tests covering required fields, email format, date logic
- `CreateBidValidator` - 11 tests including bid item validation
- `UpdateProjectValidator` - 10 tests for update validation rules
- `UpdateBidValidator` - 10 tests for bid update validation

### 📈 Stats

- **Test count: 281** (was 223 in v0.7.0, +58 tests)
- **Test coverage increase: +26%** in one sprint session
- All validators and handlers now have comprehensive test coverage
- RFI module tests deferred (not yet integrated in DbContext)

---

## [0.7.0] - 2026-02-06

### 📊 Dashboard Analytics

- **Weekly Hours Chart** - Visual labor trends on dashboard
 - Stacked bar chart showing regular/OT/DT hours by week
 - 8-week rolling history with hover tooltips
 - Average hours per week displayed
 - Uses recharts library for interactive visualization
 - New GET `/api/dashboard/weekly-hours` endpoint
- **Project Labor Summary** - Comprehensive stats on project detail pages
 - Total hours with reg/OT/DT breakdown
 - Labor cost with average $/hr calculation
 - Assigned employee count
 - Time entry counts with status badges
 - Activity date range
 - Uses new GET `/api/projects/{id}/stats` endpoint

### 🔌 New API Endpoints

- `GET /api/dashboard/weekly-hours` - Weekly hours aggregation for charts
- `GET /api/projects/{id}/stats` - Fast project statistics (no AI)
- `GET /api/employees/{id}/stats` - Fast employee statistics (hours, earnings, projects)

### 🧩 New Components

- `WeeklyHoursChart` - Dashboard chart component (integrated)
- `ProjectLaborSummary` - Project detail labor card (integrated)
- `EmployeeHoursSummary` - Employee detail hours card (integrated)

### 🧪 Tests

- 10 new tests for GetWeeklyHoursHandler
- 6 new tests for GetProjectStatsHandler
- 6 new tests for GetEmployeeStatsHandler
- Test count: 223 (was 201)

### 📈 Stats

- Dashboard now shows labor trend visualization
- Project pages show real-time labor cost data

---

## [0.6.2] - 2026-02-06

### 🛡️ Error Handling & Polish

- **Error Boundaries** - Graceful error handling throughout the app
 - `error.tsx` - Route-level error catching with retry functionality
 - `global-error.tsx` - Root layout error boundary for critical failures
 - Mobile-responsive error UI with helpful recovery options
- **Custom 404 Page** - User-friendly "not found" experience
 - Clear messaging with helpful navigation links
 - Quick access to Projects, Bids, Time Tracking, and Employees
 - Consistent branding and design
- **SEO & PWA Enhancements**
 - Comprehensive metadata with Open Graph and Twitter cards
 - Web manifest for PWA installability ("Add to Home Screen")
 - Viewport configuration with theme color support
 - robots.txt for search engine guidance
 - Construction management SEO keywords

### 📈 Stats

- Production ready for UAT
- Error handling coverage: 100% of routes
- PWA installable on mobile devices

---

## [0.6.1] - 2026-02-06

### 📚 API Documentation

- **Complete OpenAPI Documentation** - All 13 API controllers now have comprehensive Swagger docs
 - TimeEntriesController: 9 endpoints with full request/response schemas
 - EmployeesController: 5 endpoints with classification enum docs
 - CostCodesController: 2 endpoints with cost type documentation
 - ProjectAssignmentsController: 5 endpoints with role permission details
 - Detailed XML comments with `<remarks>`, `<param>`, and `<response>` tags
 - `[ProducesResponseType]` attributes for all response codes
 - Sample requests and business logic explanations
- **Swagger UI** - Interactive API explorer ready for demos and UAT
 - Complete endpoint documentation visible at `/swagger`
 - Try-it-out functionality for all authenticated endpoints
 - Request/response examples for complex operations

### 📈 Stats

- All 13 controllers documented with OpenAPI specs
- Swagger UI ready for investor demos and customer UAT
- Alpha 0 Week 2 + Week 3 complete, 11 days ahead of schedule

---

## [0.6.0] - 2026-02-06

### 📤 Vista Export Integration

- **Vista Export API** - GET `/api/time-entries/export/vista`
 - Exports approved time entries in Vista/Viewpoint compatible CSV format
 - RFC 4180 compliant CSV with proper escaping for special characters
 - Supports date range and project filtering
 - Includes all payroll fields: employee, date, project, cost code, hours, amounts
 - Calculates regular, OT (1.5x), and DT (2.0x) wage amounts
 - Admin/Manager role authorization required
 - 12 comprehensive unit tests covering all scenarios
- **Vista Export UI** - New reporting page at `/reports/vista-export`
 - Date range selection with quick presets (This Week, Last Week, This Month, etc.)
 - Project filter dropdown
 - Preview mode shows export metadata before download
 - Stats cards: entry count, total hours, employees, projects
 - CSV download with automatic filename
 - Help section with Vista import instructions
 - Responsive design for desktop and mobile

### 📈 Stats

- Test count: 210 (201 unit + 9 integration)
- Vista export completes Week 3 deliverable (Issue #122)

---

## [0.5.0] - 2026-02-06

### 📊 Job Costing & Reporting

- **Labor Cost Calculator** - Server-side job costing engine
 - Base wage calculation with OT (1.5x) and DT (2.0x) multipliers
 - Configurable burden rate (default 35%)
 - Batch calculation support for reporting
 - 16 unit tests covering all calculation scenarios
- **Cost Rollup API** - GET `/api/time-entries/cost-report`
 - Aggregates approved time entries into cost summaries
 - Groups by project and cost code
 - Date range and project filtering
 - 10 comprehensive handler tests
- **Labor Cost Report UI** - Interactive reporting page at `/reports/labor-cost`
 - Summary cards: total cost, hours, projects, burden rate
 - Date range presets (this week, last week, this month, last month, YTD)
 - Project filter dropdown with approved-only toggle
 - Desktop: expandable table with project rows showing cost code breakdown
 - Mobile: responsive card layout with project summaries
 - Loading skeleton for better UX
- **Cost Codes Management UI** - Cost code directory at `/cost-codes`
 - Searchable, filterable list with summary cards
 - Badge indicators for cost type (Labor, Material, Equipment, Subcontract)
 - Desktop table and mobile card responsive layouts

### 🎨 UI Components

- **Collapsible** - New expandable/collapsible component using @radix-ui/react-collapsible

### 📈 Stats

- Test count: 198 (189 unit + 9 integration)
- Week 2 milestones (Issue #122) completed 4 days ahead of schedule

---

## [0.4.0] - 2026-02-05

### 🤖 AI Features

- **AI Project Health Insights** - Claude-powered analysis at `/api/projects/{id}/ai-summary`
 - Health score (0-100) with color-coded status
 - Executive summary with natural language overview
 - Highlights, concerns, and actionable recommendations
 - Key metrics: hours logged, labor costs, budget utilization, pending approvals
- **Interactive AI Insights UI** - Beautiful frontend integration on project detail pages
 - Animated circular health gauge with color transitions
 - Metrics grid with key project statistics
 - Categorized insights cards (highlights, concerns, recommendations)
 - Loading skeleton with shimmer animations

### 🔒 Security & Access Control

- **Role-Based Access Control (RBAC)** - Complete permission system
 - Four built-in roles: Admin, Manager, Supervisor, User
 - Automatic Admin role assignment for first user per tenant
 - JWT tokens include role claims for API authorization
 - Role-protected endpoints for sensitive operations
- **User Management Dashboard** - Admin panel at `/admin/users`
 - View all users with roles and status
 - Assign and remove roles via UI
 - Search and filter capabilities
 - Prevents self-demotion (can't remove own Admin role)
- **Frontend Role Enforcement** - UI adapts to user permissions
 - Admin-only navigation section
 - `hasRole()`, `isAdmin`, `isManager` helper functions
 - Conditional rendering based on user roles

### 🚀 Features

- **Enhanced Dashboard** - Real-time project insights
 - Personalized greeting with user name
 - Clickable stat cards for quick navigation
 - Quick actions panel (create project, bid, employee, log time)
 - Live activity feed showing recent changes
 - Portfolio summary with total values
- **Settings Page** - User profile management at `/settings`
 - View profile info, roles, and tenant details
 - Change password functionality
 - Admin link to user management
- **Employee Management** - Complete CRUD workflow
 - Employee directory with search and filters
 - Create employee form with validation
 - Employee detail page with assignments and time entries
 - Employee edit form with status toggle
 - Clickable list rows for quick navigation
- **Onboarding Experience** - Guide new users
 - Getting Started checklist on dashboard
 - Progress tracking for first project, employee, bid, time entry
 - Dismissible with localStorage persistence

### ⚡ User Experience

- **Form Improvements**
 - Phone number auto-formatting `(XXX) XXX-XXXX`
 - Loading buttons with spinner during submission
 - Disabled forms while submitting
 - Required field indicators
 - Inline validation messages
- **Accessibility Enhancements**
 - ARIA labels on all icon-only buttons
 - Screen reader support for form errors
 - Keyboard navigation improvements
 - Focus management in dialogs
- **Confirmation Dialogs** - Prevent accidental actions
 - Danger/warning/info variants
 - Loading states during operations
- **Tooltips & Help Text**
 - Tooltips for complex form fields
 - Help text for business concepts (Classification, Cost Code)

### 🏗️ Infrastructure

- **Demo Data Seeder** - Investor-ready demonstration data
 - 60 standard construction cost codes (CSI divisions)
 - 15 realistic employees (PMs, superintendents, tradespeople)
 - Project assignments linking workers to projects
 - 30 days of time entries with realistic patterns
- **Code Quality**
 - 172 tests passing (163 unit + 9 integration)
 - ESLint errors resolved across all components
 - Repository cleanup (40 stale branches removed)

---

## [0.3.0] - 2026-02-05

### 🔒 Security & Reliability

- **Fixed critical Row-Level Security issues** - Resolved database tenant isolation failures affecting all create operations
- **Enhanced database connection stability** - Added connection interceptor to ensure tenant context persists across connection pooling
- **Improved API authentication** - Confirmed production API returns proper 401 status codes instead of redirects
- **Added comprehensive integration testing** - All 9 integration test suites now passing consistently

### 🚀 Features 

- **Enhanced deployment monitoring** - Added database health scripts and deployment status tracking ([PR #135](https://github.com/jgarrison929/pitbull/pull/135))
- **HTTP response caching** - Implemented read endpoint caching for improved performance ([PR #134](https://github.com/jgarrison929/pitbull/pull/134))
- **Domain event dispatching** - Added MediatR-based event system for future module integration ([PR #132](https://github.com/jgarrison929/pitbull/pull/132))
- **Cost code management** - Added foundation for job cost tracking and accounting ([PR #129](https://github.com/jgarrison929/pitbull/pull/129))

### 🐛 Bug Fixes

- **Frontend build stability** - Resolved duplicate import errors in error boundary components
- **Dashboard statistics** - Fixed SQL query compatibility issues with EF Core SqlQueryRaw
- **Docker build reliability** - Added missing RFIs module to container build process
- **Architecture test resilience** - Improved null safety in test failure reporting

### ⚡ Performance

- **API security headers** - Comprehensive security header implementation with monitoring ([PR #133](https://github.com/jgarrison929/pitbull/pull/133))
- **Request timeout protection** - Added configurable timeouts to prevent slow loris attacks
- **Rate limiting enhancements** - Refined authentication endpoint rate limits for better UX

### 🏗️ Infrastructure

- **CI/CD improvements** - Enhanced test reliability and failure diagnostics
- **Documentation updates** - Added comprehensive design docs for cost codes and time tracking
- **Pull request workflow** - Added standardized PR template with goal/risk/test checklist ([PR #128](https://github.com/jgarrison929/pitbull/pull/128))

### Technical Notes

- Tenant sanitization research completed for future white-label opportunities
- Architecture tests now provide actionable failure information
- Integration test coverage expanded across all major API endpoints
- Database migrations pipeline enhanced for production stability

---

## [0.1.0] - 2026-01-xx

Initial feature-complete MVP for construction project and bid management.

### Authentication & Multi-Tenancy

- **JWT authentication** with login and registration endpoints
- **Multi-tenant architecture** with shared database, shared schema model
- Tenant resolution from JWT claims and `X-Tenant-Id` header
- Automatic `TenantId` stamping on entity creation
- **PostgreSQL Row-Level Security (RLS)** policies for database-level tenant isolation
- Parameterized tenant SET to prevent SQL injection
- JWT returns 401 (not 302) on protected endpoints

### Projects Module

- Full CRUD (create, read, update, soft delete) for construction projects
- **Server-side pagination** with configurable page size
- Project detail view with phases, budgets, and status tracking
- Project types: Commercial, Residential, Infrastructure, Industrial, Renovation
- Project status workflow: Planning, Pre-Construction, Active, On Hold, Completed, Cancelled
- Client information fields (name, email, phone)
- Contract amount and budget tracking

### Bids Module

- Full CRUD for bids/estimates
- **Bid line items** with quantity, unit price, and calculated totals
- **Server-side pagination** with status filtering and search
- Bid status workflow: Draft, Submitted, Under Review, Won, Lost, Withdrawn
- Bid-to-project conversion (won bids only, prevents duplicate conversion)
- Estimated value tracking and bid numbering

### API Infrastructure

- **Rate limiting** on auth and API endpoints to prevent abuse
- **Correlation ID middleware** for request tracing across services
- **Global exception handling** with structured error responses and trace IDs
- **Deep health checks** with database connectivity verification
- Consistent error response format (`{ error, code }`)
- **Serilog** structured logging

### Frontend

- **Next.js** App Router with TypeScript
- **Mobile-responsive UI** audit and fixes across all views
 - Minimum 375px viewport support (iPhone SE)
 - Touch-friendly tap targets (44px minimum)
 - Collapsible navigation on small screens
 - Responsive tables and card layouts
- **Dashboard with real statistics** (project counts, bid win rates, contract totals)
- Project list, detail, and create/edit views
- Bid list, detail, and create/edit views with line item management
- **shadcn/ui** component library with Tailwind CSS
- Auth context with automatic token management
- API client with auto-auth headers and 401 redirect handling

### Data & Database

- **Seed data generator** for realistic construction demo data
- PostgreSQL 17 with EF Core migrations (auto-apply on startup)
- snake_case table naming convention
- Soft delete with global query filters
- Audit fields (CreatedAt, UpdatedAt) auto-populated on save
- Composite unique indexes with TenantId for multi-tenant safety

### DevOps & CI/CD

- **GitHub Actions CI** pipeline for backend (.NET build + tests) and frontend (build + lint)
- **Railway deployment** with three environments: dev, staging, production
- Three-branch promotion model: `develop` -> `staging` -> `main`
- PostgreSQL 17 service container for CI integration tests

### Documentation

- Best practices and patterns guide (`docs/BEST-PRACTICES.md`)
- Module creation guide (`docs/ADDING-A-MODULE.md`)
- Team protocol and quality strategy (internal process docs, now archived)
- Vision document (`docs/VISION.md`)
- RLS implementation documentation
- Release plan

### Known Issues

- Domain events collected but not yet dispatched (MediatR integration pending)
- `CreatedBy`/`UpdatedBy`/`DeletedBy` audit fields not auto-populated from user context
- `PagedResult<T>` defined in Projects module but used cross-module (should move to Core)
- Subdomain tenant resolution placeholder (not yet implemented)
