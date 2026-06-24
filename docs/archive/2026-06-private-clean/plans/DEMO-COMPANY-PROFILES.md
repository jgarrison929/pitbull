# Demo Company Profiles — Target Customer Archetypes (PARTIALLY GROUNDED)

**Purpose:** These are the three GC archetypes Pitbull is built for. The demo seed data should feel real to anyone from these companies. Every workflow, every data point, every report should make sense to someone who's lived this.

**Note (2026-06):** 0.15.0 delivered "Multi-company demo seed data — Companies 02, 03, 04 with full data" and renamed profiles (Summit Water, Summit Highway, Summit Electric). This doc's profiles largely match current seeded demo companies. Useful for understanding intended demo realism. Verify actual seed in SeedDataService.cs for latest data.

**Grounded against code (June 2026):**
- DemoBootstrapper.cs: const WaterInfraCode="02" // Summit Water Infrastructure — civil/water GC ($400M); HighwayCode="03" // Summit Highway Division; ElectricalCode="04" // Summit Electric Co. — electrical sub ($30M). Parent: Summit Builders Group (Company 01?).
- Full multi-company seed data for companies 02/03/04 with projects, employees, time, billing, punch etc.
- SeedDataService references "Summit Builders Group", many "Summit *" and generic entities (vendors, customers, projects).
- Profiles in doc match: #1 Summit (water infra, large, equipment heavy, prevailing wage); #2 Summit Highway; #3 likely the electric sub.
- Demo users across companies; company switcher.
- Renames happened; doc's "Summit Builders" is root, specifics match code comments.
Largely accurate archetypes. (Verify exact revenue/employee counts vs seed data if numeric; profiles are high-level.) No major inaccuracies.

---

## Company 1: Summit Builders Group (Civil / Water Infrastructure)
**Profile:** Large civil GC managing mega water/wastewater projects
- **Revenue:** $400M/year
- **Backlog:** $800M
- **Employee count:** 500-800
- **Project range:** $20M - $500M mega projects
- **Active projects:** 8-12 at any time
- **Typical project:** Regional water treatment plant expansion, pipeline replacement, pump station rehabilitation

**Pain points:**
- Davis-Bacon / prevailing wage compliance on every project (certified payroll WH-347 is weekly)
- Multi-year project schedules with heavy change order volume (owner-directed design changes)
- Equipment-intensive work — tracked excavators, cranes, pipe layers all need hours logged
- Bonding capacity management — $800M backlog means bonding company reviews WIP quarterly
- Multiple joint ventures and subcontractor tiers
- Retention is 10% held for 12+ months, lien waiver tracking is complex

**What they care about:**
- WIP Schedule (bonding company requirement)
- Certified payroll (DOL compliance)
- Equipment utilization reports
- Change order tracking and cost impact
- Cash flow projections (mega projects = long payment cycles)
- Schedule adherence (liquidated damages on late delivery)

**Demo data should include:**
- 3-4 projects: Water Treatment Plant ($180M), Pipeline Replacement ($95M), Pump Station ($42M), Reservoir ($65M)
- 12-month schedules with gantt activities
- Heavy equipment hours alongside labor
- Multiple cost codes per project (50+ CSI divisions)
- 6 months of financial history
- Active RFIs with engineer of record
- Daily reports with weather (outdoor work)

---

## Company 2: Summit Highway Contractors (Heavy Highway GC/Sub)
**Profile:** Regional heavy highway contractor doing both GC and sub work
- **Revenue:** $30-50M/year
- **Backlog:** $60-80M
- **Employee count:** 80-150
- **Project range:** $30K (small patch jobs) to $30M (highway interchange)
- **Active projects:** 25-40 at any time (many small, few large)
- **Typical project:** Highway resurfacing, bridge repair, storm drain installation, ADA ramp programs, Caltrans work

**Pain points:**
- Volume of small projects — 30+ active at once, each needs cost tracking
- Mix of GC and sub work — some they own, some they're a sub to a larger GC
- Caltrans DBE/SBE compliance requirements
- Prevailing wage on public work, private rates on commercial
- Equipment fleet management (pavers, rollers, excavators, trucks)
- Thin margins (3-5%) — one bad project wipes out a quarter
- Owner is hands-on, wants to see every job's P&L

**What they care about:**
- Job cost by cost code (are we making money on this phase?)
- Equipment cost allocation (which jobs are eating equipment budget?)
- Bid hit rate (bidding 10 to win 3)
- AR aging (government agencies pay NET 60-90)
- Simple daily reports (what crew did what on which job)
- Certified payroll (public work)

**Demo data should include:**
- 8-10 projects ranging from $50K to $25M
- Mix of GC-held and sub-to-GC projects
- Lots of cost codes but simpler structures
- Bid pipeline with win/loss history
- Equipment hours heavy
- Crew-based time entry (foreman enters for whole crew)
- AR aging showing government slow-pay

---

## Company 3: Summit Electric Co. (Electrical Subcontractor)
**Profile:** Electrical contractor working across civil, highway, and commercial projects
- **Revenue:** $20-40M/year
- **Backlog:** $30-50M
- **Employee count:** 80-120
- **Project range:** $50K (tenant improvement) to $8M (hospital electrical)
- **Active projects:** 15-25 at any time
- **Typical project:** Commercial building electrical, water treatment plant electrical/controls, highway lighting/signalization, data center power distribution

**Pain points:**
- Material procurement is the #1 headache — switchgear is 26-week lead time, transformers are 40+ weeks
- Submittals and RFIs dominate their workflow (every fixture, every panel, every device needs approval)
- Working as a sub means they're at the mercy of the GC's schedule changes
- Manpower planning is critical — electricians are scarce, need to know which project needs who when
- Change orders from GC come constantly, tracking cost impact on thin margins
- Retention held by GC for 12+ months, cash flow is always tight
- Certified payroll when working on public projects (which is most of the civil/highway work)

**What they care about:**
- Material procurement tracking (PO → delivery → install)
- Submittal log with ball-in-court tracking (waiting on engineer/architect/GC)
- RFI response tracking (design clarifications before they can install)
- Manpower loading by project and week
- Change order cost tracking (labor + material impact)
- Progress billing (AIA G702/G703) to the GC
- Cash flow — when retention releases, when GC pays
- Job cost by phase (rough-in vs trim vs controls vs commissioning)

**Demo data should include:**
- 5-6 projects across different types (commercial TI, hospital, water plant electrical, highway lighting)
- Heavy submittal log (30+ submittals in various states)
- Active RFIs with architect/engineer
- Material POs with delivery tracking
- Progress billing (pay apps submitted to GC)
- Retention tracking
- Crew time by cost code phase (rough-in, trim, fire alarm, controls)

---

## Demo Multi-Company Structure

| Code | Company | Archetype | Role in Demo |
|------|---------|-----------|-------------|
| 01 | Summit Builders Group | Holding company | Parent — C-suite, corporate staff |
| 02 | Summit Water Infrastructure | Civil/Water GC ($400M) | Mega projects, heavy equipment, certified payroll |
| 03 | Summit Highway Division | Heavy Highway GC/Sub ($40M) | Volume of small-to-mid jobs, thin margins |
| 04 | Summit Electric Co. | Electrical Sub ($30M) | Submittals, material procurement, sub billing |

---

## The Pitch Per Archetype

**Summit Water (Civil):** "You're paying $300K/year for Vista + Procore + P6 + InEight. One platform, one login, one cost per user. And the AI predicts your cost-to-complete better than your PM's gut feeling."

**Summit Highway (Heavy Highway):** "You have 30 jobs open and one controller trying to track them all in Vista. Our dashboard shows you every job's margin in real time. Your foreman enters crew time in 30 seconds from his truck. And your bid pipeline tracks your hit rate so you stop bidding work you never win."

**Summit Electric Co. (Electrical Sub):** "You live and die by submittals and material lead times. Our system tracks every submittal, every RFI, every PO delivery date — and the AI flags when a late delivery is going to blow your schedule. Your PM stops chasing paper and starts managing the work."

---

*These profiles inform seed data, tour content, marketing, and sales conversations.*
*Updated: February 22, 2026*
