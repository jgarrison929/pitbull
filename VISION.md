# Pitbull Construction Solutions — Product Vision

## The problem

Construction operations still run on disconnected tools. A typical general contractor juggles project management, estimating, accounting, document control, and field apps that do not share a single source of truth. Data is re-entered across systems; retainage, SOV, and change-order state live in spreadsheets; executives lack a trustworthy portfolio view.

## The vision

**One platform. One login. One database.** Core GC workflows — preconstruction through closeout — share tenant-isolated data, consistent identity, and real-time operational metrics.

Pitbull is a construction project controls platform aimed at **commercial general contractors**: managing projects, subcontractors, cost, time, compliance paperwork, and owner billing without bolting together half a dozen point solutions.

## Product principles

### Domain-first for GCs

Features are shaped for how GCs work: jobs and cost codes, bids converting to projects, subcontracts with SOV and change orders, crew time against phases, RFIs/submittals/daily reports, and AIA-style payment applications.

### Multi-tenant SaaS architecture

Each demo visitor gets a company-scoped sandbox. Sign-in is a role card; the session cookie holds a random token and the database stores only its hash.

### Role-native experience

The demo roles (executive, project manager, superintendent, foreman) land on homes that match their job. See [`AGENTS.md`](AGENTS.md).

### AI as leverage, not theater

Provider abstractions (Anthropic / OpenAI) for chat, project summaries, and document extraction where they reduce real administrative load. Capabilities ship behind clear APIs and usage tracking.

### Cloud-native delivery

One Railway service rooted at `v5/`, a health check, and database migrations on deploy.

## Platform status

The live loop is estimate → budget → field plan and report → earned value → change orders, on one data model under `v5/`.

Authoritative sources:

| Source | Purpose |
|--------|---------|
| `v5/` | Live app |
| `docs/roadmap.md` | What is next |
| `docs/v5/` | Trust bar and increment specs |
| `AGENTS.md` | Demo roles and version rules |
| `VERSION` + `v5/package.json` | Public version |

## Stack

- **App:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui — one service under `v5/`
- **Data:** PostgreSQL through Drizzle ORM
- **Demo auth:** role cards on `/login`, per-visitor sandboxes
- **Deploy:** Railway; the service root is `v5/`

## Direction

Continue deepening construction accounting fidelity (WIP, certified payroll, dual-book nuances), expanding workflow coverage beyond change orders and billing applications, and tightening executive metrics so every KPI answers *why* with drill-through lists.

**Differentiating horizon:** Jobsite Twin — field capture and system-of-record truth rendered as a spatial world model so humans and agents share one map of the work (zones-first, truthful overlays, cited agent briefs). Pre-v5 design notes, not the live app: `docs/pitbull-digital-twin-spec.md` and `docs/mobile3.md`.

---

*Pitbull Construction Solutions — one platform for the GC back office.*
