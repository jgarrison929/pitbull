# Pitbull Construction Solutions

## The Problem

Construction runs on duct tape.

A typical general contractor pays for Procore ($50K+/year), PlanGrid, Textura, Bluebeam, three different spreadsheets, email chains nobody can find, a filing cabinet full of insurance certs, and a lawyer on speed dial for every contract question. None of these systems talk to each other. Data lives in silos. PMs spend half their day copying information between platforms.

Meanwhile, the software vendors keep raising prices, locking data behind proprietary formats, and telling contractors they need to "move to the cloud" while offering zero control over where that data actually lives.

Construction is the least digitized major industry on the planet. Not because contractors are behind. Because the software has failed them.

## The Vision

One platform. One login. One database. Everything talks to everything.

Pitbull replaces the entire disconnected toolchain with a single, AI-powered construction management platform. Projects, bids, contracts, documents, submittals, RFIs, daily logs, insurance tracking, billing, and a client portal. All in one place.

And it runs on YOUR servers if you want it to.

## What Makes Pitbull Different

### AI That Actually Does Work

This isn't a chatbot bolted onto a project list. Pitbull's AI reads your documents, understands your contracts, and catches problems before they cost you money.

- **Submittal vs Spec Review**: Upload a submittal, AI checks it against the spec. "Concrete mix shows 3500 PSI, spec requires 4000. Flag."
- **Preconstruction Intelligence**: Ingest a full plan set, AI identifies scope gaps, coordination issues, and ambiguities before they become RFIs.
- **Bid Leveling**: OCR sub bids, extract line items, auto-compare. "Electrical sub #3 is 40% below average on conduit. Verify scope."
- **Contract Ops Assistant**: PM asks "what do I do about a weather delay?" and gets WHO needs to send notice, WHAT it must say, WHEN it's due, and a TEMPLATE generated from the actual contract language. At 6am. No lawyer needed.
- **Redline Detection**: Upload two versions of anything. AI tells you what changed and what it means for your project. No more buried scope changes in rev 3.
- **Insurance Compliance**: OCR every COI, cross-reference against contract requirements. "Sub's CGL is occurrence-based but contract requires claims-made." Auto-track expirations.
- **Sub Compliance Dashboard**: Every sub, every requirement, one view. Insurance, licenses, safety records, prevailing wage, bonding, certifications. Auto-flag before anyone steps on site with a lapsed cert.

### Self-Hosted. Your Data. Your Servers.

Every competitor is cloud-only. Your data lives on someone else's servers, governed by someone else's terms, accessible only as long as you keep paying.

Pitbull runs on your infrastructure if you need it to. Government contractors, DOD work, contractors in regulated environments, or anyone who just wants to own their data. `docker compose up` and you're running.

Cloud is available too. We're not anti-cloud. We're anti-lock-in.

### Built for General Contractors

Not residential remodelers. Not owner's reps. Not architects. General contractors building commercial projects. Every feature is designed for how GCs actually work: managing subs, tracking costs, moving paper, and keeping projects on schedule.

### Transparent Pricing

No "contact sales for a quote." No per-user pricing that punishes you for growing. No feature gates that force you into enterprise tier for basic functionality. You know what you're paying before you sign.

## The Platform

### Today (v0.1 Alpha)
- Multi-tenant architecture with row-level security
- Project management (CRUD, phases, budgets, projections)
- Bid management (CRUD, line items, bid-to-project conversion)
- JWT authentication with tenant isolation
- Deployed to Railway (cloud) with Docker support

### Next (v0.2 Beta)
- Contracts module
- Mobile-responsive UI
- Seed data for demos
- CI/CD pipeline

### Coming (v0.5 Early Access)
- Document management with AI OCR pipeline
- RFIs and Submittals
- Daily Logs
- Client Portal
- Billing

### The Future (v1.0 and Beyond)
- Full AI document intelligence (submittal review, bid leveling, contract ops, redlines)
- Insurance and sub compliance automation
- QuickBooks/accounting integration
- Self-hosted deployment package
- Payroll, HR, Safety/compliance modules

## The Stack

- **Backend**: .NET 9, modular monolith, CQRS/MediatR, PostgreSQL with pgvector
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **AI**: Docling (self-hosted OCR), Azure Document Intelligence (cloud OCR), pgvector for embeddings
- **Deployment**: Docker, Railway (cloud), self-hosted via Docker Compose

## Who We Are

Built by a construction technology veteran with 20 years in the industry, powered by AI agents that work around the clock. We know where the pain is because we've lived it. Every feature exists because someone needed it on a real job site.

## The Pitch

Construction software should work for contractors, not against them. It should be affordable, understandable, and yours. It should make PMs faster, not busier. And it should never hold your data hostage.

That's Pitbull.

One platform. One database. Everything talks to everything. Runs on your servers if you want.

No more duct tape.

---

*Pitbull Construction Solutions. Built different.*
