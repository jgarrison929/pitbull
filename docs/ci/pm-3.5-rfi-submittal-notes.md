# CI notes — Band 3.5 RFI + Submittal mobile

**Status:** In progress (open at **3.4.1**; full evidence at **3.5.0** checkpoint)  
**Spec:** [`docs/specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md`](../specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md)

## Version map

| Version | Notes |
|---------|--------|
| **3.4.1** | **Shipped** — mobile list DTO field contract documented (id, number, subject/title, status, projectId, optional projectName/dueDate/updatedAt); **explicit ban** on health/KPI fields; empty honesty; no runtime API/UI on this stamp |
| **3.4.2** | **Shipped** — `GET /api/projects/{id}/rfis?view=mobile` → `RfiMobileListItemDto` (paginated; no question/drawings/cost/KPI); unit tests mapper + empty/one/forbidden |
| **3.4.3** | **Shipped** — `GET /api/projects/{id}/submittals?view=mobile` → `SubmittalMobileListItemDto`; status as enum string; no register % |
| **3.4.4** | **Shipped** — `/rfis` phone-first list via slim API; overdue visual; honest empty/error; vitest helpers |
| **3.4.5** | **Shipped** — `/rfis/[id]` phone detail; ConfirmDialog before status PUT; attachments openable in view; `evaluateRfiStatusTransition` tests |
| **3.4.6** | **Shipped** — phone submittal list via slim API + type; honest empty; no % register tile |
| 3.4.7–3.4.9 | See band table (submittal detail, help, buffer) |
| 3.5.0 | Checkpoint — fill persona evidence when shipped |

## Mobile list DTO contract (3.4.1) — checkable summary

**Allowed:** `id`, `number`, `subject`|`title`, `status`, `projectId`, optional `projectName`, `dueDate`, `updatedAt`.  
**Forbidden on list DTOs:** health scores, % complete / register KPIs, portfolio rollups, heavy collections.  
**Empty:** honest empty — never “all clear health.”

Full table: band spec § **Mobile list DTO field contract (shipped 3.4.1)**.

## Persona smoke (at 3.5.0)

| Persona | Path | Expect |
|---------|------|--------|
| PM | `/rfis` at phone width | Slim list loads; empty honesty |
| PM/Super | Project submittals | List + detail workflow glance |

## Required checks

- Preflight green on last PR  
- No invented KPI fields in mobile DTOs  

