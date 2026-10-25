# Spec: Product band 3.4 — Post-3.3 checkpoint (to 3.4.0)

**Status:** Shipped **3.4.0**  
**Version band:** `3.4.0` only (1 stamp)  
**Theme:** Release checkpoint for security/prod + Today-on-site ladder  

## Problem

Need a clean product checkpoint after 3.2/3.3 bands before further post-3.0 themes (financial mobile, procurement, etc.).

## Version table

| Version | Deliverable |
|---------|-------------|
| **3.4.0** | Checkpoint: mark bands 3.2 + 3.3 shipped in specs/CI notes; VERSION/CHANGELOG/Docker stamps; no new product scope beyond residual verification |

## API / UI touchpoints

- Docs/CI notes only unless residual fix required for deploy health  

## Test plan

- Preflight green; Railway health after deploy  

## Help center

- No required new cards unless residual  

## Truth rules

- No invented KPIs  
- Checkpoint does not re-claim unshipped Deferred items  

## Non-goals

- Starting financial mobile glance band  
- Native app shell  

## Shipped upstream bands

| Band | Spec | CI notes | Status |
|------|------|----------|--------|
| 3.2 security/prod | `docs/specs/product-bands/band-3.2-security-prod.md` | `docs/ci/mobile-3.2-prod-notes.md` | Shipped through 3.2.9 |
| 3.3 Today on site | `docs/specs/product-bands/band-3.3-today-on-site.md` | `docs/ci/mobile-3.3-today-on-site-notes.md` | Shipped through 3.3.9 |
