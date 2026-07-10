# Demo Company Profiles

**Status:** Seed data version 11+  
**Source of truth:** `DemoBootstrapper.cs` (company names/codes) + `SeedDataService.cs` (domain rows)

These four companies share one demo tenant. Switch companies in the header to change the “business world.”

| Code | Company | Archetype | Short |
|------|---------|-----------|-------|
| **01** | Summit Builders Group | Enterprise GC holding (Fortune-scale portfolio, deep org chart) | SBG |
| **02** | Summit Commercial Builders | Mid-market commercial GC (~$50–80M, classic bid→build) | SCB |
| **03** | Summit Highway Division | Small-market heavy highway (many jobs, thin margins, public work) | SHD |
| **04** | Summit Mechanical | Union HVAC / mechanical multi-division specialty contractor | SMH |

## Company 01 — Enterprise GC holding

- Corporate COA, full module seed (projects, bids, contracts, AR/AP, GL, payroll, PM)
- C-suite and corporate staff personas home here; multi-company access
- Story: large portfolio, WIP, bonding, board-level dashboards

## Company 02 — Mid-market commercial GC

- Medical office, tech campus, retail reno, public community center, warehouse, multifamily podium
- Leaner staff, classic PM + superintendent + carpenter crew
- Story: bid hit rate, buyout, owner billing, change orders

## Company 03 — Small-market heavy highway

- Higher project count, smaller average contract ($0.4M–$4M range)
- Fictional public owners (Demo State Highway Agency, Demo County Public Works, etc.) + small private paving
- Story: crew production, equipment, certified payroll, AR slow-pay (Net 45–60)

## Naming policy

All customers, vendors, agencies, and insurers in seed data must be **clearly fictional** (prefer `Demo …` / Summit family brands). Do not use real commercial brands, real school districts/universities, real hospitals, or real government agency names.

## Company 04 — Union HVAC multi-division (seed-first)

Divisions are **simulated** in project name tags and employee titles (no first-class Division entity yet):

- Project Management / Install  
- Commercial Service & Maintenance  
- Pipe Shop Fabrication  
- Sheet Metal Fabrication  
- Design/Assist & Engineering  
- Pre-Construction / Estimating  
- Plumbing, Hydronics, Medical Gas  
- HVAC Controls, Fire/Smoke Damper, IAQ, Backflow testing  
- BIM/VDC  

Union craft titles: UA pipefitter, SMART sheet metal, apprentices.

**Product gap (later goal):** work orders, shop production, first-class org divisions.

## Reseed

Bump `SeedDataVersion` in `SeedDataService` when content changes. With `Demo__SeedOnStartup=true`, old DEMO-* domain data is cleared and reseeded.

## Related

- Role accounts and home UX: `docs/ROLE-EXPERIENCE.md`
- Demo bootstrap: `src/Pitbull.Api/Demo/DemoBootstrapper.cs`
