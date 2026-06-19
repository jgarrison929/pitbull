# AAI-ERP Vision — Agentic AI ERP for Construction

> **"One platform. One cost per user. The entire construction lifecycle from design through operations, powered by AI agents that understand the domain."**

**Author:** Joshua Garrison
**Date:** February 20, 2026
**Status:** Vision Document — Pre-Seed ($500K target)

---

## The Problem

The construction industry runs on app sprawl:

| Function | Current Tools | Annual Cost (mid-size GC) |
|----------|--------------|--------------------------|
| Project Management | Procore ($30-50/user/mo) | $36K-60K |
| Accounting/ERP | Vista/Viewpoint or Sage ($200K+ impl) | $50K-100K/yr |
| Estimating | On-Screen Takeoff, Bluebeam, PlanSwift | $15K-25K |
| Scheduling | Primavera P6, MS Project | $10K-20K |
| Document Management | PlanGrid/Autodesk Build, SharePoint | $15K-30K |
| Field Reporting | Raken, Fieldwire | $10K-20K |
| Safety | iAuditor, Safety Reports | $5K-15K |
| HR/Payroll | ADP, Paychex + manual certified payroll | $20K-40K |
| BIM/CAD | Autodesk ($10K+/seat), Revit, Navisworks | $50K-200K |
| Takeoff | Bluebeam Revu, PlanSwift | $10K-20K |

**Total: $221K-530K/year** in software costs for a 200-person GC. Plus the hidden cost: context switching between 8-12 disconnected systems, manual data re-entry, and zero cross-system intelligence.

## The Vision: One Pane of Glass

AAI-ERP eliminates the app sprawl. Not by being a mediocre version of everything, but by being the **system of record** that AI agents work through natively.

### Architecture Philosophy

The AI isn't a feature bolted onto an ERP. **The AI IS the architecture.**

```
Traditional ERP:
  Human → UI → Database → Reports

AAI-ERP:
  Human → UI ──┐
  AI Agent ─────┼── System of Record ── Intelligence Layer ── Action
  IoT/Sensor ──┘
```

Every action in the system — whether initiated by a human clicking a button, an AI agent processing a document, or a sensor reporting equipment hours — flows through the same system of record with full audit, permissions, and business rules.

### Platform Modules (Current + Roadmap)

#### Phase 1: Back Office Foundation ✅ (Current — Feb 2026)
- **Projects** — CRUD, phases, cost codes, budget tracking
- **Contracts** — Subcontracts, SOV, change orders
- **Billing** — AIA G702/G703, payment applications, retention, lien waivers
- **Accounting** — GL, chart of accounts, journal entries, WIP schedule, AP/AR
- **Time Tracking** — Individual, crew entry, mobile, approval workflow
- **Payroll** — Processing, certified payroll, prevailing wage, Davis-Baker
- **Project Management** — Schedule (12 sub-modules), RFIs, submittals, daily reports
- **AI** — Embedded chat, smart fields, document intelligence
- **Reports** — Labor cost, profitability, equipment, PDF exports (QuestPDF)

#### Phase 2: Field + Mobile (Q2 2026)
- **Mobile Daily Reports** — Camera integration, offline-first PWA
- **GPS Time Entry** — Geofenced clock-in/out, compliance proof
- **Equipment Management** — GPS tracking, maintenance scheduling, utilization analytics
- **Safety** — Inspections, incident reporting, toolbox talk tracking
- **Punch Lists** — Close-out workflow with photo documentation

#### Phase 3: Pre-Construction (Q3 2026)
- **Estimating** — Quantity takeoff with AI-assisted measurement
- **Web-Native Takeoff** — Upload plans, measure on screen, export to bid items
- **Bid Management** — Sub bid solicitation, bid leveling, award workflow
- **Pre-Qualification** — Sub pre-qual questionnaires, insurance tracking

#### Phase 4: Design + BIM (Q4 2026)
- **Web-Native CAD Viewer** — View, annotate, and RFI from drawings in-browser
- **BIM Integration** — IFC model viewing, clash detection visualization
- **Digital Twins** — Live project model linked to schedule, cost, and field data
- **Plan Room** — Centralized drawing management with revision control

#### Phase 5: Intelligence + Automation (2027)
- **AI Cost-to-Complete** — Predictive project outcome modeling
- **AI Document Processing** — OCR invoices, extract contract terms, auto-match POs
- **AI Schedule Optimization** — Suggest schedule compression, resource leveling
- **AI Risk Assessment** — Flag projects trending over budget before humans notice
- **Voice Agents** — "Hey Pitbull, what's the status on RFI 42 for the downtown project?"
- **Agent-to-Agent** — AI agents that negotiate, coordinate, and handle routine workflows autonomously

#### Phase 6: Ecosystem (2027+)
- **Owner Portal** — Project owners view progress, approve pay apps, access documents
- **Sub Portal** — Subs submit billing, upload waivers, track payments
- **Integration Hub** — QuickBooks, Sage, ADP, Procore (bi-directional sync)
- **Marketplace** — Third-party add-ons, custom integrations, industry data feeds
- **White Label** — Other construction tech companies embed AAI-ERP modules

### Pricing Disruption

**Current market:**
- Procore: $30-50/user/month (gated features by tier)
- Vista: $200K+ implementation + annual maintenance
- Sage: $100K+ implementation

**AAI-ERP:**
- **$99/user/month, all modules included.** No per-module gates. No implementation fees.
- Self-hosted option: $0/user (bring your own infrastructure)
- For a 200-person GC: **$237K/year replaces $500K+ in fragmented tools**
- Or self-hosted: **$0 software cost** (support contract optional)

The per-seat economics work because:
1. No Salesforce/Oracle licensing underneath
2. Open-source foundation (.NET + PostgreSQL + Next.js)
3. AI costs amortized across features (one model serves chat, predictions, document processing)
4. Self-hosted = customer's infrastructure cost, not ours

### Technical Moat

1. **Construction Domain AI** — Not generic AI. AI that understands retainage, AIA billing, prevailing wage, WBS, cost codes. Trained on construction workflows, not SaaS playbooks.
2. **Predictive UX** — "Predict what the user wants and offer it before they even know they want it." Pre-fill crews from yesterday, suggest equipment hours, auto-match invoices to POs, nudge on due payment apps.
3. **One Database** — Every module shares one PostgreSQL instance. RFI cost impact flows to change orders flows to contract sum flows to billing flows to GL flows to WIP. Zero integration work. Zero data re-entry.
4. **Agent-Native Architecture** — AI agents aren't calling REST APIs and parsing HTML. They have first-class identity, permissions, and audit trail. The system was designed for agents from day one.
5. **Self-Hosted** — "Your data never leaves your servers." This is the sentence that closes deals with GCs who won't put financials in Procore's cloud.

### First Customers

Target: 3-5 GCs in California Central Valley ($50M-$200M annual revenue)
- **Domain depth** — built by someone with 10+ years implementing Vista/Viewpoint in multi-entity construction holdings
- **Vista pain is acute** — $200K implementations, Windows-only, 1990s UI
- **Balance forward approach** — Don't migrate historical data. Start fresh, run parallel for 1 month, cut over
- **$2-5K/month per GC = $100-300K ARR** = self-sustaining

---

## Competitive Landscape (Updated)

| Capability | AAI-ERP | Procore | Vista | Sage | Constructable |
|-----------|---------|---------|-------|------|---------------|
| PM (full) | ✅ | ✅ | ❌ | ❌ | ⚠️ |
| Financial/GL/WIP | ✅ | ❌ | ✅ | ✅ | ❌ |
| AI-Native | ✅ | ⚠️ | ❌ | ❌ | ⚠️ |
| Self-Hosted | ✅ | ❌ | ⚠️ | ⚠️ | ❌ |
| Web-Native CAD/BIM | 🔮 Phase 4 | ❌ | ❌ | ❌ | ❌ |
| Estimating/Takeoff | 🔮 Phase 3 | ❌ | ❌ | ⚠️ | ❌ |
| Equipment/GPS | 🔮 Phase 2 | ⚠️ | ❌ | ❌ | ❌ |
| One Platform | ✅ | ❌ (PM only) | ❌ (finance only) | ❌ (finance only) | ❌ (field only) |
| Per-Seat Cost | $99/mo | $30-50/mo | $$$$ | $$$$ | TBD |
| Implementation Time | Days | Weeks | 6-18 mo | 6-12 mo | Weeks |

**Key insight:** Nobody does PM + Finance + AI + Self-Hosted. Procore is PM-only. Vista/Sage are finance-only and legacy. Constructable is field-only. We're the only one building the full stack.

---

## Executive Team: Review This Vision

The February 19 executive review evaluated Pitbull as a construction ERP. This vision document reframes the product as **AAI-ERP** — a fundamentally different positioning:

1. **Not just ERP.** Full construction lifecycle platform (design → build → operate).
2. **Not just AI features.** AI-native architecture where agents are first-class citizens.
3. **Not just back office.** Field, pre-construction, design, and ecosystem modules planned.
4. **Not just SaaS.** Self-hosted disruption of per-seat pricing models.

**Questions for the executive team:**
- Does Phase 2-6 roadmap align with what GC prospects actually need?
- Does the pricing model work for pre-seed / first customers?
- What's missing from the competitive analysis?
- Which Phase 2 features have the highest demo impact for investor conversations?
- Does "AAI-ERP" resonate better than "Pitbull" for the product category?
- What risks does this expanded vision introduce that we need to mitigate?

---

*See also `docs/ARCHITECTURE.md` and `docs/PRODUCT-VISION.md`.*
