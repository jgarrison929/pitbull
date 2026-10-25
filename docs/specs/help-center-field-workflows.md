# Spec: Help Center — field & mobile workflows

**Status:** Complete (2.12.7�2.12.8)  
**Version band:** 2.12.7 → 2.12.8 (within Arc A)  
**Related:** [`help/page.tsx`](../../src/Pitbull.Web/pitbull-web/src/app/(dashboard)/help/page.tsx), `ROLE-EXPERIENCE.md`

## Problem

Help center is office-centric; mobile FAQ claims **“fully responsive”** without field paths (`/daily-reports/mobile`, PWA, offline, bottom nav).

## Personas

Superintendent, PM on site, any phone user of field features.

## User journey

Field super opens **Help** → finds step-by-step cards → taps deep links to live routes.

## Primary code touchpoints

- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/help/page.tsx`  
- Route sources of truth: `workspaces.ts`, `project-nav.ts`, `mobile-bottom-nav.tsx`  

## API

UI-only.

## Version table

### 2.12.7 — Field workflow cards

**Deliverable:** Section **“Field & mobile workflows”**.

**Acceptance:**
- [x] Card: **Daily Field Report** — steps open Report tab → complete 4-step wizard → submit/offline queue; href `/daily-reports/mobile`  
- [x] Card: **Site Walk** — open project → Site Walk; href pattern `/projects/{id}/site-walk` (use demo project helper or generic projects list)  
- [x] Card: **Offline / PWA** — install prompt, queue indicator, reconnect sync  

**Files:** `help/page.tsx`  

**Tests:** Manual; each href resolves  

---

### 2.12.8 — FAQ accuracy

**Deliverable:** Replace misleading mobile FAQ; add offline + twin/plans pointers.

**Acceptance:**
- [x] Grep: no standalone claim that the whole app is “fully responsive” as the mobile story  
- [x] FAQ answers mention: `/daily-reports/mobile`, bottom nav (Report / Crew / …), offline queue, PWA install  
- [x] Optional cards: Digital Twin (`/projects/[id]/twin`), Plans (`/projects/[id]/plans-specs`) if not in 2.12.7  

**Known bad string (fix/replace):** FAQ body starting with `Yes. The interface is fully responsive. Time tracking includes a dedicated mobile entry view...`

**Files:** `help/page.tsx`  

**Tests:** Manual + string grep  

## Non-goals

- Full office persona rewrite (Arc E `help-center-office-workflows.md`)  
- Video tutorials  

## Truth rules

- Document **actual** routes from nav config — do not invent features not in the app  

## Band DoD

- [x] Field section live  
- [x] Mobile FAQ truthful  
