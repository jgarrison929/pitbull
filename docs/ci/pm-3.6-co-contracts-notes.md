# CI notes — Band 3.6 CO + Contracts mobile

> **Historical — not the live product.** Describes the removed 3.8.2 app (tag `legacy-3.8.2-final`). Live product is `v5/`.


**Status:** Shipped (3.6.0 checkpoint)  
**Spec:** `docs/specs/product-bands/band-3.6-pm-co-contracts-mobile.md`

## Product evidence

| Surface | Evidence |
|---------|----------|
| Slim CO list API | `GET /api/changeorders?view=mobile` → `ChangeOrderMobileListItemDto` |
| Owner CO mobile | `GET /api/owner-change-orders?view=mobile` |
| Phone list UI | `/change-orders` uses `coMobileListUrl` + honest empty copy |
| Help | `help-pm-co-contracts` section on Help Center |
| Unit | `ChangeOrderMobileListMapperTests`, `co-mobile-list.test.ts` |

## Preflight

Run `./scripts/preflight.ps1 -FullWeb -DotNet` before merge.
