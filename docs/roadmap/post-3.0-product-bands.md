# Post-3.0.0 product band themes

**Status:** Post-3.0.0 — **does not block** major `3.0.0`  
**3.0.0 product ends at:** Arc A–E (`2.22.2`) + runway (`2.22.3`→`2.24.2`)  

These themes were the old “G band” expansion (formerly planned as 2.23→2.97). After 3.0.0 ships, product may resume with a **new** version ladder (e.g. 3.0.1+) using `docs/specs/product-bands/` templates.

## Theme rotation (draft)

| Theme cluster | Ideas |
|---------------|--------|
| Financial mobile glance | WIP drill, AR/AP virtualized lists, certified payroll stubs |
| Procurement / portal | PO approval notify, owner payment status |
| Field ops | Equipment utilization, safety incident capture, compliance expiry |
| Estimating / contracts | Bids pipeline, CO mobile approvals |
| GL | Read-only journal mobile views |
| AI | Chat mobile shell + citations |
| Quality | Demo seed per persona, a11y, i18n prep, perf debt |

## Rules

- Write `docs/specs/product-bands/band-*.md` **before** implementing a band  
- Still: one version bump per PR; truth over polish; no invented KPIs  
- Do not re-open 2.x minor numbers after 3.0.0 without an explicit new program doc  

## Related

- [`docs/specs/product-bands/README.md`](../specs/product-bands/README.md)  
- [`docs/260712/VERSION-WORKFLOW.md`](../260712/VERSION-WORKFLOW.md)  
- [`docs/roadmap/mobile-field-demand-stack-and-version-plan.md`](./mobile-field-demand-stack-and-version-plan.md) — 2026 market demand stack, surface gap map, **post-3.0 field bands M1–M5** (`3.0.1+`)  
