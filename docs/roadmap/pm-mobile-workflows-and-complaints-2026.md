# Research note: CM/CPM workflows + mobile complaints (PM arc 3.4→4.0)

**Status:** Living research for implementers  
**Product ladder:** [`pm-nextgen-3.4-to-4.0.md`](./pm-nextgen-3.4-to-4.0.md)  
**Prior field stack:** [`mobile-field-demand-stack-and-version-plan.md`](./mobile-field-demand-stack-and-version-plan.md) (G1–G5 largely shipped in 3.1/3.3)  
**Date:** 2026-07-17  

This note **improves** the live PM arc. It does **not** invent a second version ladder or product KPIs.

---

## 1. CM / CPM workflow map (by arc domain)

Industry workflow shapes (not Pitbull invents). Map each domain to **phone job**: capture | glance | filtered drill.

### 1.1 RFI (Request for Information)

**Canonical steps:** identify conflict/gap → write specific question with drawing/spec refs + photo → log unique number → submit to reviewer → track due date / overdue → distribute response → close; flag cost/schedule impact → CO if needed.

**RFI is not a submittal or CO.** RFI asks clarification; submittal proposes product/method for approval; CO changes scope/price/schedule.

**Phone mandate:** create + status glance on site without calling the office (spreadsheet/email logs fail here).

**Sources:** [Projul RFI management guide (2026)](https://projul.com/blog/construction-rfi-management/); [Layer — effective RFI process](https://layer.team/blog/how-to-create-a-more-effective-rfi-process); [Autodesk RFI field/mobile](https://construction.autodesk.com/tools/construction-rfi-tracking/); [InEight — standardize RFIs/submittals](https://ineight.com/article/standardize-rfis-and-submittals-for-faster-more-accurate-reviews/).

### 1.2 Submittals

**Canonical steps:** schedule/register items by spec → sub/GC prepare package (shop drawings, product data, samples) → submit for review → status cycle (submitted / in review / approved / AAN / R&R / rejected) → distribute approved set to field.

**Phone mandate:** status glance + due/overdue; not full desktop package assembly. No invented "register complete %" KPI.

**Sources:** same RFI/submittal guides above; [Bluebeam RFI & submittals workflow](https://www.bluebeam.com/workflows/rfis-and-submittals/); [Autodesk PM workflow demo (2026)](https://construction.autodesk.com/resources/project-management/construction-workflow-project-management-demo/).

### 1.3 Schedule (Gantt + Kanban) + CPM

**Canonical steps:** WBS/activities → dependencies → durations → critical path / float → data date → baseline → variance; field progress feed; constraints board (Kanban-style "what's blocking").

**Phone mandate:** critical path / today / delayed glance; task status board — **not** full desktop Gantt edit on 390px.

**Sources:** [Projul construction schedule (2026)](https://projul.com/blog/how-to-create-a-construction-schedule-in-5-steps/); [LCMD field-tested CPM guide](https://www.lcmd.io/en/blog/top-construction-project-management-software-field-tested-guide-2025); [Fieldwire CM software day-in-life](https://www.fieldwire.com/blog/what-is-construction-management-software/).

### 1.4 Contracts, change orders, pay apps

**Owner contract:** prime agreement + SOV → progress billing (AIA G702/G703) → retainage → certification.  
**Subcontract:** issue → execute → SOV → sub pay apps up the chain → COs.  
**CO:** pending → under review → approved/rejected; RFI response may *lead* to CO but is not a CO.  
**Pay app:** draft → submit → review → approve → pay; backup (waivers, stored materials, invoices) often blocks certification.

**Phone mandate:** status + deep link for CA/PM; not full G702 line edit on phone.

**Sources:** [Procore AIA G702 library](https://www.procore.com/library/aia-g702-application-for-payment); [Projul AIA billing guide (2025)](https://projul.com/blog/construction-aia-billing-guide/); [Trimble G702/G703 overview](https://www.trimble.com/en/blog/construction/article/a-quick-guide-to-g702-g703-aia-documents); [AIA how-to G702](https://learn.aiacontracts.com/articles/how-to-complete-the-g702-payment-application/).

### 1.5 Compliance, insurance, safety

**Compliance:** COI / GL / WC / licenses on **subcontractor** and **company** entities → expiry tracking → block work/pay when expired (process, not invent a "compliance score" product KPI unless labeled proxy).  
**Safety:** incident / near-miss capture → list → daily report narrative; OSHA field risk high.

**Phone mandate:** capture + expiry glance; honest empty.

**Sources:** [OSHA construction industry](https://www.osha.gov/construction); compliance linked to billing in industry tooling writeups e.g. [AIA billing software comparisons (2026)](https://constructionbids.ai/blog/best-aia-billing-software-contractors-2026).

### 1.6 Vendors, procurement, materials

**PO → receipt → invoice → pay**; materials stored (pay app) vs installed; daily report **deliveries** as field capture of material arrival.

**Phone mandate:** project-scoped PO/delivery glance + capture; not full AP desk.

**Sources:** industry CM software roundups emphasizing field materials/docs ([Kraaft field tools 2025](https://www.kraaft.com/en/articles/best-construction-software-2025); [PermitFlow pocket-first mobility 2026](https://www.permitflow.com/blog/construction-project-management-software)).

---

## 2. Ranked mobile / field complaints (2024–2026)

Ordered by **severity severity for crews/supers/PMs on phone** (reconciles prior Pitbull demand stack: adoption > offline > capture > field→office > drawings > AI).

| Rank | Complaint | Evidence (sources) | Phone product implication (truthful) |
|------|-----------|--------------------|--------------------------------------|
| **1** | **Desktop-shrunk / not pocket-first** — too many taps, unreadable tables, abandoned for SMS | Projul: Smartsheet mobile is "desktop shrunk"; crews won't use it ([Smartsheet alternatives](https://projul.com/blog/best-smartsheet-alternatives-construction/)). PermitFlow: "pocket-first… loads in seconds… couple of taps" ([2026 PM software](https://www.permitflow.com/blog/construction-project-management-software)). LCMD: mobile usability decides daily adoption ([field-tested guide](https://www.lcmd.io/en/blog/top-construction-project-management-software-field-tested-guide-2025)). | Slim list/detail DTOs; ~390px; large targets; role mobile tabs — not invent health scores |
| **2** | **No true offline** — basements, high-rise cores, rural dead zones; "sync later" = never | Projul field apps 2026: offline not optional ([best field apps](https://projul.com/blog/best-construction-apps-field-teams-2026/)). Kraaft: offline that actually works ([2025 field software](https://www.kraaft.com/en/articles/best-construction-software-2025)). ScanManifold: common fake offline patterns ([offline guide 2026](https://www.scanmanifold.com/blog-posts/offline-construction-app-guide)). | Honest queue/cache claims only; residual offline already partial in 3.1 |
| **3** | **Field cannot check RFI/submittal status without calling office** | Projul RFI guide: "No field access… call the office… 1995 workflow in 2026" ([RFI management](https://projul.com/blog/construction-rfi-management/)). Layer: mobile field capture + photo/location ([RFI process](https://layer.team/blog/how-to-create-a-more-effective-rfi-process)). | **Band 3.5** primary — list/status/detail on phone |
| **4** | **Drawings/docs not usable on phone (or offline)** | Projul docs: mobile access non-negotiable; multi-menu = call office ([document management](https://projul.com/blog/best-construction-document-management-software/)). Procore mobile degrades on large plan sets in bad signal ([Procore vs Buildertrend](https://projul.com/competitors/procore-vs-buildertrend/)). | Prior 3.1 offline sheets + pin→RFI; this arc **does not** re-open full Bluebeam |
| **5** | **Slow capture / multi-step logs abandoned** | Daily log "most hated" for supers ([Wispa CM software](https://wispa.us/blog/best-project-management-software-for-construction/)). Fieldwire day-in-life assumes fast tablet log ([Fieldwire CM](https://www.fieldwire.com/blog/what-is-construction-management-software/)). | Quick paths already 3.1; keep confirm-to-submit; no auto-post AI |
| **6** | **Field→office lag (SMS photo chaos)** | Same RFI/docs sources: verbal RFIs + no distribution fail projects. Fieldwire/PermitFlow: live field updates to HQ. | Structured entities + Today-on-site (3.3); continue honest operational counts |
| **7** | **Schedule invisible / not field-updatable** | Projul schedule: Excel on phone is painful; mobile access table stakes ([schedule guide](https://projul.com/blog/how-to-create-a-construction-schedule-in-5-steps/)). | **Bands 3.7–3.8** glance + CPM honesty, not full edit |
| **8** | **Pay app / CO / compliance desktop-only for commercial roles** | G702 backup packages delay payment ([Projul AIA billing](https://projul.com/blog/construction-aia-billing-guide/)); insurance/compliance linked to billing cycles (industry writeups 2025–26). | **Bands 3.6, 3.9–3.11** status glance for CA/PM |
| **9** | **AI is not the bottleneck** | Prior stack: AI multiplier after adoption/offline/capture. | Maintenance only; confirm-to-apply |

---

## 3. Complaint → arc band map

| Complaint rank | Primary band(s) | Domains |
|----------------|-----------------|---------|
| 1 Usability / pocket-first | **All bands** (acceptance: 390px, slim DTO) | Cross-cutting |
| 2 Offline honesty | Residual + 3.1 already; buffer stamps only | Capture paths |
| 3 RFI/submittal field access | **3.5** | RFI, Submittals |
| 4 Drawings | Shipped 3.1 (partial); non-goal full set/Bluebeam | Plans |
| 5 Capture friction | Shipped 3.1 quick log; don't re-scope in 3.5 | Daily report |
| 6 Field→office | 3.3 Today-on-site + 3.5 structured RFI | Cross |
| 7 Schedule | **3.7, 3.8** | Gantt/Kanban, CPM |
| 8 Commercial paper | **3.6, 3.9, 3.10, 3.11** | CO/contracts, safety/compliance, vendors/materials, pay apps/quotes |
| Hub polish | **3.12** | All domains linked |

**Sequencing confirmation:** Research supports keeping **RFI/Submittal first (3.5)** — highest field-status complaint still open after 3.1/3.3 field capture work. Do not re-ladder.

---

## 4. Research gaps closed in specs (checklist)

- [x] Workflow map for every OBJECTIVE domain on the epic  
- [x] Ranked mobile complaints with public sources  
- [x] Map to band IDs without inventing KPIs  
- [x] Explicit non-goals: native shell, full Gantt edit, Bluebeam, portfolio health  

---

## 5. Related program files

| File | Role after this research |
|------|---------------------------|
| [`pm-nextgen-3.4-to-4.0.md`](./pm-nextgen-3.4-to-4.0.md) | Epic — gains research pointer + complaint-driven prioritization |
| [`band-3.5-pm-rfi-submittal-mobile.md`](../specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md) | Hardened journeys/acceptance |
| Stub bands 3.6–3.12 | Complaint-driver annotations |
| [`docs/340-pm-arc/`](../340-pm-arc/) | Program index pointer |
