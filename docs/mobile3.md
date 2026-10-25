# Pitbull Mobile v3 Plan: "I Gotta Have This" Field Experience

**Date:** July 11, 2026  
**Context:** Building on existing role-based mobile navigation (`mobileTabs`, `quickActions` for `field`/`Foreman`), the dedicated `/daily-reports/mobile` route (already seeing real PostHog usage), and project workspace items including "Plans & Specs" (`/projects/[id]/plans-specs`) and Schedule.  
**Goal:** Create a mobile experience so useful and frictionless that field users (supers, foremen, PMs on site walks) say **"I gotta have this"** and actually use it every day on the jobsite instead of paper, texts, Excel, or switching between 3-4 other apps.

---

## Vision: The "I Gotta Have This" Reaction

**Target user on a site walk (superintendent or PM):**

> "I open Pitbull on my phone while walking the pour. I see my active projects and today's schedule in one view. I tap the latest plan revision for the area, confirm the detail, then log progress on three activities with two photos and a 15-second voice note. The AI suggests the right cost codes, estimates % complete, and flags that this activity is slipping the critical path. I check sub status for the electrical crew — green, last update yesterday. I create one quick RFI from the plan markup. Total time: under 4 minutes. No phone calls to the office, no hunting through email for drawings, no logging into a separate document system. This is the only app I actually use on site."

This is the emotional + practical reaction we want. It combines **speed, context, and intelligence** in a way that feels magical on a phone in harsh field conditions (gloves, sun glare, spotty signal, dust).

**Why this wins PMF in construction:**
- Field users are the real adoption gatekeepers. If supers and foremen love it and tell the PM "this actually works on my phone," the office side follows.
- Autodesk/PlanGrid evolution has left many teams with fragmented or clunky mobile document access. A clean, integrated plans + specs + progress loop is a strong wedge.
- Long-term: Mobile is the primary **data capture layer** that feeds a future desktop/AR digital twin of the jobsite (real activity, sensor data, progress heatmaps overlaid on the model). We build the capture engine now.

---

## Current State (Codebase Review – July 2026)

**Strengths already in place:**
- Excellent role-aware mobile foundation in `src/Pitbull.Web/pitbull-web/src/components/layout/workspaces.ts`:
  - `field` and `Foreman` roles have `mobileTabs` and `quickActions` prominently featuring:
    - "Report" → `/daily-reports/mobile`
    - Crew time entry
    - Equipment, Projects
  - Project workspace already defines **"Plans & Specs"** (`/projects/[id]/plans-specs`), Schedule, Daily Reports, Progress, RFIs, etc.
- Dedicated `/daily-reports/mobile` route exists and is actively promoted + used (PostHog shows bursts of autocaptures there).
- Strong modular backend (progress, schedule, documents, AI layer ready).
- Next.js 15 + Tailwind + shadcn/ui stack is well-suited for responsive + mobile-first work.
- AI-native architecture (providers, usage tracking, agents) ready to enhance mobile flows.

**Gaps to close for "I gotta have this":**
- Plans & Specs viewer implementation/details (route exists in nav model but full mobile viewer + deep integration likely needs work).
- Polish on `/daily-reports/mobile`: speed, offline, voice, photo intelligence, touch targets.
- Tight cross-linking: Daily report → relevant plan sheet / spec section / schedule task.
- PWA / offline capabilities (critical for real jobsites with dead zones).
- Performance (recent PostHog showed `n_plus_one_detected` and homepage rage clicks — these kill mobile trust).
- Schedule and sub status views optimized for small-screen site walks.
- Overall "delight" layer (AI assistance that feels proactive, not bolted on).

---

## Prioritized "I Gotta Have This" Features

### 1. Core Daily Progress Reporting – Make it Stupid Fast & Smart (Phase 1 priority)
Field users must be able to report progress in <60-90 seconds on a phone.

**Must-have UX:**
- Single-screen or bottom-sheet entry for progress (activity, % complete or quantity, notes, photos, voice).
- Camera-first photo capture with instant preview + optional AI analysis (suggest cost code, detect safety issues, estimate progress % from image).
- Voice input button → structured output (AI parses "poured 120 yards in east wall, rebar looks good" into schedule update + cost line).
- Offline-first: Queue entries locally, sync when signal returns. Show clear "queued / synced" status.
- One-tap "copy yesterday's crew" or smart defaults based on role/location/schedule.

**"I gotta have this" moment:** Standing in the middle of the job, dictate progress while looking at the work, and it just works — even with no signal.

### 2. Plans & Specs Viewer – The Differentiator (Phase 2 priority)
Many teams are frustrated with document access on mobile after PlanGrid changes and Autodesk fragmentation. This can be a wedge.

**Target experience:**
- Fast-loading, mobile-optimized viewer for current plan revisions (PDF.js or similar with good touch controls: pinch-zoom, quick sheet switcher).
- Search by sheet number, title, or spec section.
- Deep linking: From a daily report or task, one tap opens the exact relevant plan sheet or spec paragraph.
- Simple annotation/markup on plans that creates a linked note, RFI, or progress item (with photo context).
- Offline caching of recent/active plan sets (download on Wi-Fi, use on site).
- Version awareness: "This is Rev 3 – last updated yesterday by PM."

**Why this wins:** Supers and PMs on site walks constantly need to reference drawings/specs. If Pitbull makes that faster and more integrated with progress logging than anything else, they adopt it as the daily driver.

### 3. Schedule Access for Site Walks
PMs and supers do walking the site with schedule in mind.

**Mobile-optimized view:**
- Today's look-ahead + my/crew tasks (card list or simple timeline that works on phone).
- Quick status update that feeds directly into progress entry + AI risk flagging.
- Filter by area, crew, or "critical path only".
- "Start site walk" mode that pulls relevant plans + schedule + open issues in one place.

### 4. Subcontractor Status at a Glance
Quick visibility without calling the office.

- Per-project or portfolio view of key subs: status (on track / at risk / delayed), last update, open RFIs/issues count, recent photos/notes.
- Tap to drill into details or create RFI/message from mobile.

### 5. Supporting Polish & AI Delight
- Role-aware home screen that defaults to field-relevant view (not cluttered executive dashboard).
- Push notifications for approvals, new plan revisions, AI-detected risks from mobile entries.
- End-of-day AI summary generated from mobile activity ("You logged progress on 4 activities, 2 photos, 1 RFI started. Critical path activity X is 15% behind — recommend...").
- Excellent performance and loading states on real field devices.

---

## Technical Approach

**Stack leverage:**
- Next.js 15 App Router + Tailwind (mobile-first CSS with responsive prefixes).
- Existing role system + `mobileTabs` — extend and enforce for field personas.
- AI layer (existing providers) — add specialized prompts for voice parsing, photo analysis, plan Q&A, progress inference.
- Documents module — extend for Plans & Specs viewer.

**Key technical investments:**
- **PWA foundation**: `manifest.json`, service worker for offline caching (plans, recent projects, queued reports), install prompt. This is table stakes for field credibility.
- **Offline data strategy**: IndexedDB + optimistic UI. Background sync. Clear visual feedback.
- **Viewer**: PDF.js (or react-pdf) for plans with custom mobile controls and annotation layer. Specs as searchable text/PDF. Consider future 3D/model viewer hooks for digital twin vision.
- **Performance**: Immediately address N+1 queries (backend). Add mobile skeletons, lazy loading, and image optimization.
- **Testing**: Real-device (iPhone/Android field phones), Chrome DevTools mobile emulation + Playwright. Field user testing sessions.
- **Integration points**: Daily report form → deep link to plans-specs or schedule task. Progress updates should flow to schedule/job cost/risk agents automatically.

**Future-proofing for digital twin:**
Mobile entries (progress, photos with location, issues, voice notes) become the rich, structured data layer. Later phases can add sensor hooks and feed a desktop/AR visualization of the jobsite with live activity overlays. We don't need the twin UI now — we need the capture quality and integration now.

**Shared contract:** see `docs/pitbull-digital-twin-spec.md` §4 (capture fields: optional → encouraged `SpatialNodeId` / `PlanSheetId`, photo placement priority, idempotency). Twin MVP is zones-first; mobile owns offline capture, twin owns spatial graph + overlays.

---

## Phased Roadmap (mobile3)

**Phase 1 – 2-3 weeks: Daily Reports + Time Polish (Foundation)**
- Make `/daily-reports/mobile` and crew time entry feel instant and reliable.
- Add voice input + photo AI assistance.
- Implement basic PWA + offline queue for these flows.
- Fix performance/rage-click issues surfaced in recent analytics.
- Success signal: Field demo users complete reports faster and rate the experience highly.

**Phase 2 – 3-4 weeks: Plans & Specs Viewer + Deep Integration**
- Implement mobile-first `/projects/[id]/plans-specs` viewer with search, offline cache, and basic annotation.
- Add deep links from daily report / tasks → relevant plan or spec.
- Polish version handling and "open latest revision".
- Success signal: Users discover and use the viewer during normal mobile sessions; qualitative feedback on "finally easy to check drawings on site."

**Phase 3 – 3 weeks: Schedule, Sub Status, Site Walk Mode**
- Mobile-optimized schedule view tailored for walking the job.
- Sub status quick view + actions.
- "Site walk" starter flow that surfaces relevant plans + schedule + issues.
- Success signal: PMs and supers using it during actual site visits.

**Phase 4 – Ongoing: AI Delight + Path to Digital Twin**
- Proactive AI (risk flags, summaries, suggestions) surfaced in mobile context.
- Richer media + location tagging.
- Hooks and data model ready for future 3D/jobsite twin visualization (desktop or AR) that consumes mobile-captured activity.

---

## Success Metrics & PMF Signals

**Quantitative:**
- % of field-role sessions that complete at least one progress report on mobile.
- Average time to complete a simple daily report (target: <90 seconds).
- Plans & Specs page views and time spent once launched.
- Mobile retention (daily/weekly active field users).
- Offline usage rate (queued entries that sync successfully).

**Qualitative ("I gotta have this" proof):**
- Field users voluntarily say they prefer it over current tools for on-site work.
- "I don't have to call the office to check the plan anymore."
- Supers/foremen recommending it to PMs or other crews.
- Reduced context-switching (fewer apps/tabs needed on site).

**PostHog tracking to add/enhance:**
- Device type + screen size segmentation on all key flows.
- Funnels: Login/role select → daily-reports/mobile completion.
- Rage clicks + dead ends on mobile.
- Feature usage (plans viewer, voice input, offline queue).

---

## Open Questions & Decisions Needed

1. **Plans viewer depth**: How sophisticated should annotation be initially (simple notes vs full markup that creates RFIs/progress items)?
2. **Offline scope**: Cache full plan sets or prioritize recent + metadata + ability to request specific sheets?
3. **Voice AI accuracy**: Which model/prompt strategy for construction jargon on noisy job sites?
4. **Native vs PWA**: Excellent PWA first. Revisit Capacitor or Trusted Web Activity only if camera/GPS/offline needs exceed web capabilities significantly.
5. **Data model**: Ensure progress entries can cleanly reference plan sheet + spec section + schedule task for downstream AI and reporting.

---

## Immediate Next Steps

1. Review this plan together and lock Phase 1 scope.
2. Audit current implementation of `/daily-reports/mobile` and the plans-specs route/components.
3. Set up or refine PostHog insights for mobile field funnels + device breakdown.
4. Quick win: Add PWA manifest + basic service worker + voice input prototype on daily reports.
5. Performance pass on N+1 queries and homepage (removes friction before new features land).

---

This plan turns the existing strong navigation/role foundation into a genuine field weapon. Mobile stops being "the responsive version" and becomes the primary interface that makes Pitbull the default daily tool for the people who actually build the work.

When field users have that "I gotta have this" reaction, everything else (office adoption, data quality for the future twin, defensibility) gets much easier.

Ready to start executing on Phase 1 or refine any section? Just say the word.