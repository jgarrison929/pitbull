# Pitbull Construction Solutions

## The Problem

Construction runs on duct tape.

A typical general contractor pays for Procore ($50K+/year), PlanGrid, Textura, Bluebeam, three different spreadsheets, email chains nobody can find, a filing cabinet full of insurance certs, and a lawyer on speed dial for every contract question. None of these systems talk to each other. Data lives in silos. PMs spend half their day copying information between platforms.

Meanwhile, the software vendors keep raising prices, locking data behind proprietary formats, and telling contractors they need to "move to the cloud" while offering zero control over where that data actually lives.

Construction is the least digitized major industry on the planet. Not because contractors are behind. Because the software has failed them.

## The Vision (Aspirational)

One platform. One login. One database. Everything talks to everything.

**This is the aspirational vision.** Pitbull is a learning/prototype project implementing parts of this (see CHANGELOG.md and code for delivered features like projects, bids, contracts/SOV, time tracking, billing elements, PM, AI chat, financial reports, Punch List). It does **not** yet replace Procore, Vista, or full toolchains. Many listed AI capabilities (full submittal review, bid leveling, contract ops assistant) are partial or planned.

Pitbull aims to provide core construction ERP functionality in a modular monolith. It can run self-hosted via Docker.

See "Current State" below and CHANGELOG for what is implemented vs planned.

## What Makes Pitbull Different

### AI Features (Implemented and Planned)

Some AI capabilities exist today (chat, document extraction/OCR for invoices/daily reports, project summaries, cost predictions), powered by abstractions over OpenAI/Anthropic. Many advanced features listed below are aspirational/planned and not fully implemented (see code in Pitbull.AI, AI controllers, and CHANGELOG for delivered items like AI invoice extraction, briefing, confidence scoring).

- **AI Chat & Summaries**: Implemented project health, suggestions.
- **Document/Invoice Extraction**: Partial (Vision API usage in billing/daily reports).
- **Advanced (not yet)**: Full submittal vs spec, preconstruction plan set review, comprehensive bid leveling, contract ops assistant, redline detection, full insurance compliance automation.

### Cloud-Native. Built for Tomorrow.

The future of construction runs in the cloud. With data centers in space within the next decade and edge computing everywhere, local infrastructure is becoming obsolete except for unique edge cases.

Pitbull is built cloud-first, leveraging modern cloud infrastructure for scalability, reliability, and global accessibility. Your team can access projects from anywhere, your data is backed up across multiple regions, and you get automatic updates without IT headaches.

We handle the infrastructure so you can focus on building.

### Built for General Contractors

Not residential remodelers. Not owner's reps. Not architects. General contractors building commercial projects. Every feature is designed for how GCs actually work: managing subs, tracking costs, moving paper, and keeping projects on schedule.

### Transparent Pricing

No "contact sales for a quote." No per-user pricing that punishes you for growing. No feature gates that force you into enterprise tier for basic functionality. You know what you're paying before you sign.

## The Platform

### Current State (as of mid-2026)
- Multi-tenant architecture with PostgreSQL Row-Level Security (RLS) and company scoping (14 modules)
- Implemented: 95 controllers, projects/bids/contracts (SOV/COs/payment apps), time tracking, project management (RFIs/submittals/daily reports/Punch List), billing (vendors, AP/AR, GL, WIP, retention, lien waivers, financial statements), AI, reports, etc.
- JWT + ASP.NET Identity auth, CAP messaging, significant test coverage (253 test files), CI green
- Docker support; Railway auto from main (demos decommissioned)
- See CHANGELOG.md for precise recent deliveries (0.15.0: financial reports, AP payments, Punch List, etc.) and "Honest Caveats" in README.md. Not a full replacement for commercial tools.

### Roadmap (Historical / Aspirational)
Early roadmaps (v0.2 etc.) from project history are superseded. Many items like Contracts, RFIs, Billing elements, PM, daily reports, client portal stub, AI extraction are partially or fully in current codebase (see CHANGELOG and Modules/ for status). Full vision items remain future work. Consult CHANGELOG, code, and docs/archive/ for historical priorities and plans.

## The Stack (current implementation)

- **Backend**: .NET 9, modular monolith, CQRS with direct service injection (no MediatR), PostgreSQL 17 with Row-Level Security (RLS)
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **AI**: Anthropic Claude and OpenAI abstractions for chat, summaries, and some extraction (OCR/extraction features are partial)
- **Messaging**: DotNetCore.CAP (PostgreSQL outbox + Redis)
- **Email**: Resend (optional)
- **Deployment**: Railway (from main), Docker Compose for local/dev, self-hosted support

**Status**: This is an active learning/prototype project with multiple implemented modules. Not all vision items are complete. See CHANGELOG.md and code for delivered features.

## Who We Are

Built by a construction technology veteran with 20 years in the industry, powered by AI agents that work around the clock. We know where the pain is because we've lived it. Every feature exists because someone needed it on a real job site.

## The Pitch

Construction software should work for contractors, not against them. It should be affordable, understandable, and accessible from anywhere. It should make PMs faster, not busier. And it should leverage the best of modern cloud infrastructure.

That's Pitbull.

One platform. One database. Everything talks to everything. Built for the cloud.

No more duct tape.

---

*Pitbull Construction Solutions. Built different.*
