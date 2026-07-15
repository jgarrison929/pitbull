# Spec: Product band 3.2 — Security + production resilience

**Status:** In progress (starts at 3.2.0)  
**Version band:** `3.2.0` → `3.2.9` (10 stamps)  
**Theme:** CodeQL hygiene, post-deploy client freshness, fetch resilience, field residuals  
**Starts after:** `3.1.9` field mobile band  

## Problem

Open CodeQL alerts (log forging, email in logs, clear-text form drafts, missing workflow permissions) erode trust. After Railway deploys, users hit stale Server Action hashes and `ECONNRESET`. Field 3.1 residuals (pin flush, plan open honesty) still need polish.

## Version table

| Version | Deliverable |
|---------|-------------|
| **3.2.0** | CodeQL hygiene: `LogSafe` (CR/LF strip + email redact), CI `permissions: contents: read`, employee draft PII exclude from localStorage; unit tests |
| **3.2.1** | Service worker deploy freshness: `skipWaiting` + `clients.claim`; bump precache shell revision so new deploys take control |
| **3.2.2** | API client network resilience: retry/backoff on transient failures (`ECONNRESET`, abort, 502/503) for critical GETs — no silent data invent |
| **3.2.3** | User-visible deploy recovery: detect failed Server Action / chunk load; honest “refresh to update” banner (no invented status) |
| **3.2.4** | Plan pin offline flush polish: when online again, drain pin→draft RFI queue with honest success/fail toast |
| **3.2.5** | Plans open UX: cached vs not labels + disabled open remain truthful; small a11y/copy polish only |
| **3.2.6** | PostHog session recording opt-out flag via `NEXT_PUBLIC_POSTHOG_SESSION_RECORDING` (default keep current; document) |
| **3.2.7** | Help Center: deploy refresh + offline pin queue + network retry honesty cards/FAQ |
| **3.2.8** | Unit/Vitest coverage for SW claim helpers, fetch retry, deploy banner detection |
| **3.2.9** | Checkpoint — `docs/ci/mobile-3.2-prod-notes.md` + VERSION 3.2.9 |

## API / UI touchpoints

- `Pitbull.Core.Logging.LogSafe`, CI workflow, `use-form-autosave`, employee new form  
- `public/sw.js`, client `api` fetch wrapper, optional deploy banner component  
- Offline store / pin draft flush, plans-specs UI  
- PostHog init, help/page.tsx  

## Test plan

- Unit: LogSafe CR/LF + email redact  
- Vitest: fetch retry policy; SW revision constant; deploy error message matchers  
- Manual: hard-refresh after deploy clears Server Action errors  

## Help center

- 3.2.7 — field/deploy honesty cards  

## Truth rules

- No invented executive KPIs or portfolio health scores  
- Emails never logged in full after 3.2.0  
- Never claim whole drawing set offline  
- Retry does not invent success when API fails  

## Non-goals

- HogQL triage without personal API key  
- Full Bluebeam markup; native shell  
- Autonomous AI posts  
