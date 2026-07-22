# Spec: Product band 3.5 — RFI + Submittal mobile foundation

**Status:** Pending  
**Version band:** `3.4.1` → `3.5.0` (10 stamps)  
**Theme:** Phone-first list/detail for RFIs and Submittals (next-gen PM arc open)  
**Starts after:** `3.4.0` checkpoint  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Program:** [`docs/340-pm-arc/`](../../340-pm-arc/)  
**Research:** [`docs/roadmap/pm-mobile-workflows-and-complaints-2026.md`](../../roadmap/pm-mobile-workflows-and-complaints-2026.md)  
**CI notes (at checkpoint):** `docs/ci/pm-3.5-rfi-submittal-notes.md` (create at 3.5.0)

---

## Problem

PMs and supers manage RFIs and submittals daily, but existing web surfaces (`/rfis`, `/projects/[id]/rfis`, `/projects/[id]/submittals`) are desktop-dense. On a phone, list/detail is slow or incomplete, so field users fall back to SMS/email and the office loses structured records.

**Industry complaint this band closes (P0):** supers cannot check RFI status from the jobsite without calling the office when logs live in spreadsheets/email — called a “1995 workflow in 2026” in public industry guides (see research note §2 rank 3). Mobile field capture for RFIs should include photo/context and status tracking, not desktop table shrink.

## Personas

| Persona | Need |
|---------|------|
| Project Manager | Open RFIs/submittals by job; overdue/due glance; deep link to detail; ball-in-court honesty |
| Superintendent | Status check + light create/respond on site; photo; honest empty; large tap targets |
| Admin | No new invent; existing permissions hold |

## Industry workflow (abbreviated)

**RFI:** identify issue → write one clear question + drawing/spec refs + photo → log number → submit → track due → distribute response → close (cost/schedule impact may spawn CO — out of band).  
**Submittal:** register item → package → review cycle (submitted / in review / approved / AAN / R&R / rejected) → distribute — **not** the same as RFI.  
Do not mix RFI create UI with CO or submittal package assembly on phone.

## User journey (target — phone)

1. Open job or global RFIs on phone in **≤ few taps** from PM/field chrome (pocket-first).  
2. See **paginated** slim list: number, subject, **status**, **due date** (overdue visual), project name — scannable at ~390px.  
3. Tap → detail: question body, drawing refs if present, photos, response narrative, status actions (**confirm-to-submit** only).  
4. Super: optional create path with subject + project + photo (keep short; full desktop package not required).  
5. Same pattern for submittals: type, status, spec/section ref, workflow history glance (real events only).  
6. Empty list = honest empty — **never** “all RFIs clear health” or portfolio rollup.

## Primary code touchpoints

| Area | Paths |
|------|--------|
| API | `src/Pitbull.Api/Controllers/RfisController.cs`, `ProjectManagementControllers.cs` (submittals), optional slim DTO under `Features/` |
| Domain | `src/Modules/Pitbull.RFIs/`, `src/Modules/Pitbull.ProjectManagement/Domain/` (`PmSubmittal*`) |
| Web | `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/rfis/**`, `projects/[id]/rfis/**`, `projects/[id]/submittals/**` |
| Shared UI | mobile shell / bottom nav if deep links added; existing list components |
| Help | `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/help/page.tsx` |
| Tests | API integration tests for list slim DTO; vitest for formatters/empty copy helpers |
| E2E | Prefer unit/integration first; persona smoke path documented at checkpoint |

## API touchpoints

| Route (existing / extend) | Notes |
|---------------------------|--------|
| RFI list/detail (existing `RfisController`) | Add `?view=mobile` **or** dedicated slim list DTO fields; server pagination; no client rollup |
| `GET/POST api/projects/{projectId}/submittals` | Same slim list rules |
| Permissions | Existing RFI/Submittal view/manage claims — do not weaken |

**UI-only rows** must still document which API they consume.

## Mobile list DTO field contract (shipped 3.4.1)

**Scope:** binding field contract for **3.4.2+** slim list APIs (`?view=mobile` or equivalent) and phone list UIs.  
**Runtime:** not required on this stamp — implementers map to these fields only.

### Allowed list item fields

| Field | Required | Notes |
|-------|----------|--------|
| `id` | yes | Entity id (GUID/string as existing API) |
| `number` | yes | Display number (RFI # / submittal #) |
| `subject` or `title` | yes | One primary text line; RFI uses subject; submittal may use title |
| `status` | yes | Server enum string only — no invented intermediate states |
| `projectId` | yes | Owning project |
| `projectName` | optional | For global lists; omit when already scoped to a project |
| `dueDate` | optional | ISO date/datetime when server has one; drive overdue UI from this |
| `updatedAt` | optional | Last activity for sort/recency glance |

### Explicit exclusions (do not add to mobile list DTOs)

- Health scores, “register complete %”, portfolio open-count rollups, average response-time **KPI** tiles  
- Heavy collections (full responses, full attachment blobs, workflow event arrays) — those belong on **detail** endpoints  
- Client-side ledger / multi-project aggregation fields  
- Invented “all clear” / empty-as-health framing fields  

### Empty honesty

Empty list = honest empty (“No RFIs” / “No submittals”). **Never** “all RFIs clear health” or portfolio rollup copy.

### Implementer note (3.4.2 / 3.4.3)

| Entity | List API path (extend) | Contract |
|--------|------------------------|----------|
| RFI | existing `RfisController` list | fields above only |
| Submittal | `GET api/projects/{projectId}/submittals` (and global if any) | same slim rules; status enum serialized honestly |

---

## Version table

| Version | Deliverable | Files (primary) | Acceptance | Tests |
|---------|-------------|-----------------|------------|-------|
| **3.4.1** | Open band: contract note for mobile RFI/Submittal list fields + empty honesty; no broad UI rewrite | this spec § Mobile list DTO field contract; `docs/ci/pm-3.5-rfi-submittal-notes.md` | - [x] Documented fields: id, number, subject/title, status, projectId, projectName?, dueDate?, updatedAt<br>- [x] Explicit: no health/KPI fields<br>- [x] VERSION 3.4.1 stamp set | docs review / no runtime required |
| **3.4.2** | Slim **RFI** list API for mobile (`?view=mobile` or equivalent) | `RfisController`, `RfiMobileListItemDto`, `RfiListViewMapper` | - [x] Paginated response<br>- [x] Omits heavy collections by default<br>- [x] Authz unchanged | Unit: mapper + controller mobile empty/one/forbidden; service empty + unauthorized |
| **3.4.3** | Slim **Submittal** list API for mobile | `SubmittalsController`, `SubmittalMobileListItemDto`, `SubmittalListViewMapper` | - [x] Same slim rules as RFI<br>- [x] Status enum serialized honestly | Unit: mapper entity/DTO + empty list |
| **3.4.4** | Phone-first **RFI list UI** | `rfis/page.tsx`, `lib/rfi-mobile-list.ts` | - [x] Usable at ~390px width (one column list, not desktop grid shrink)<br>- [x] Status + due/overdue visible without horizontal scroll<br>- [x] Loading / empty / error states<br>- [x] Uses slim API when present | Vitest `rfi-mobile-list` (URL, overdue, empty honesty) |
| **3.4.5** | Phone-first **RFI detail** + status/response capture (confirm) | `rfis/[id]/page.tsx`, `lib/rfi-status-confirm.ts` | - [x] Detail readable on phone (subject, body, status, due)<br>- [x] Status change confirm-to-submit<br>- [x] No auto-post without confirm<br>- [x] Photos/attachments openable when present | Vitest `rfi-status-confirm` (guard blocks unconfirmed PUT path) |
| **3.4.6** | Phone-first **Submittal list UI** | `projects/[id]/submittals/page.tsx`, `lib/submittal-mobile-list.ts` | - [x] Loading/empty/error honesty<br>- [x] Type + status + due-ish fields only on phone<br>- [x] No “% register complete” tile | Vitest `submittal-mobile-list` |
| **3.4.7** | Phone-first **Submittal detail** + workflow glance | submittal detail components | - [ ] Workflow history glance (real events only)<br>- [ ] No invented “register complete %” | Unit for workflow display mapper if added |
| **3.4.8** | Help Center: mobile RFI + Submittal cards/FAQ | `help/page.tsx` | - [ ] Routes match real pages<br>- [ ] No offline claims beyond truth | Manual + link paths exist |
| **3.4.9** | **Buffer:** residual honesty + DTO/helper tests only | tests under API/web | - [ ] No new feature scope<br>- [ ] Tests cover shipped slim mappers | `dotnet test` / vitest targeted green |
| **3.5.0** | **Checkpoint** — band complete | `docs/ci/pm-3.5-rfi-submittal-notes.md`; mark this Status Shipped | - [ ] CI notes: persona smoke PM open RFI list on phone width<br>- [ ] Spec Status → Shipped through 3.5.0<br>- [ ] Preflight green | CI notes + preflight evidence |

### Out-of-scope for this band (do not sprawl)

- Plan pin→RFI (already 3.1 — maintenance only)  
- Full desktop parity for bulk register export on phone  
- Submittal AI review rewrite  
- Change orders, schedule, pay apps (later bands)  
- Native shell  

## Non-goals

- Invented RFI/submittal “health scores” or portfolio open-count rollups on phone  
- Client-side aggregation across all projects for executive tiles  
- Replacing desktop dense tables (desktop may keep full columns)  
- Moving RFIs out of existing modules  
- Average response-time **executive KPI productization** on phone (office reports may come later; not this band)  
- Full submittal package upload suite on phone (status + glance first)  
- Treating RFI create as change-order authorization  

## Mobile complaint drivers (research)

| Driver | How 3.5 addresses |
|--------|-------------------|
| No field RFI status without office call | Slim list + detail + due/overdue |
| Desktop-shrunk UX | 390px list, few columns, large taps |
| Field→office lag / SMS | Structured create + confirm status (when online) |
| Offline | Honest: only claim online unless queue already exists; no fake offline RFI log |

## Test plan

| Layer | Command / approach |
|-------|-------------------|
| Unit | Slim DTO mapping; empty copy helpers |
| Integration | RFI/submittal list mobile view auth + empty + seeded item |
| E2E | Optional; checkpoint documents manual persona path if no e2e yet |
| Preflight | `./scripts/preflight.ps1 -FullWeb -DotNet` every PR |

## Help center

- **3.4.8** — “RFIs on phone”, “Submittals on phone”; FAQ: status meanings; deep links to `/rfis` and project submittals.

## Truth rules

- Status labels match server enums — never invent intermediate states.  
- Empty list ≠ “all RFIs resolved health.”  
- Counts only when server returns real filtered totals.  
- Demo users cannot DELETE; middleware unchanged.  

## Deploy safety (band DoD)

Every stamp:

- [ ] Version stamp set (VERSION + package.json + API csproj + Docker ARGs + CHANGELOG)  
- [ ] Preflight green before push  
- [ ] Residual stamps do not add unrelated domains  
- [ ] After checkpoint: health URL smoke (`docs/ci/pm-arc-deploy-safety.md`)

## Band DoD (3.5.0)

- [ ] All rows 3.4.1–3.5.0 shipped or deferred in writing here  
- [ ] Mobile RFI list + detail usable on phone  
- [ ] Mobile Submittal list + detail usable on phone  
- [ ] Slim APIs in place or documented fallback  
- [ ] Help + CI notes  
- [ ] Spec status **Shipped through 3.5.0**  
