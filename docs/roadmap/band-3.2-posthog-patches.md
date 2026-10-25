# Band 3.2.0+ — PostHog / production patches (draft)

**Status:** Planning from deploy logs + known field gaps (2026-07-14)  
**Prerequisite:** `3.1.9` field mobile land on `main`  
**Does not invent KPIs.**

## Sources checked

| Source | Access | Finding |
|--------|--------|---------|
| Railway `pitbull-web` logs | Yes | Next.js **Failed to find Server Action** after deploy; `ECONNRESET` |
| Railway `pitbull` (API) logs | Yes (service name `pitbull`) | Capture on next pass |
| PostHog Query API | **No personal API key** in env/Railway | Need `POSTHOG_PERSONAL_API_KEY` + project id for HogQL |
| Product Project API key | On Railway web only (`phc_…`) | Capture-only; cannot read errors |

## Priority patches (candidate version stamps)

| Order | Issue | Severity | Proposed fix |
|-------|-------|----------|--------------|
| **P0** | Stale client / Server Action hash mismatch after Railway deploy | High UX | Document hard-refresh; optional SW skipWaiting + `clients.claim`; bump precache; avoid long-lived cached `page` after deploy |
| **P0** | `ECONNRESET` aborted requests on web | Medium | Timeouts/retries on critical client fetch; health check noise filter |
| **P0** | Spatial overlay DbContext concurrency (`Task.WhenAll` on same context) | High | Fixed in 3.1.9 ship PR if landed; sequential fuel loads |
| **P1** | PostHog error triage once personal key available | High ops | HogQL: top `api_error`, `$exception`, `n_plus_one_detected` last 7d → file fixes |
| **P1** | Autocapture / session replay volume vs quota | Cost | Optional `NEXT_PUBLIC_POSTHOG_SESSION_RECORDING=false` (keeps historical replays; stops new) |
| **P2** | Field 3.1 residual | Product | Pin offline flush when online; plan PDF open UX polish |

## How to finish PostHog read access

1. PostHog → Settings → Personal API keys → create key with `query:read`  
2. Store as Railway var or local User env: `POSTHOG_PERSONAL_API_KEY`  
3. Project id from PostHog URL `/project/<id>/…` → `POSTHOG_PROJECT_ID`  
4. Re-run: query last 7d `$exception` + `api_error` by endpoint  

**Turning off capture without losing historical session data:** disable *future* recording only (project settings → Session replay → off, or client `disable_session_recording: true`). Existing recordings remain in PostHog until retention expires.

## Inbox agent (usage burn)

Not a Pitbull product feature. Likely one of:

1. **Claude ops-inbox** skill (`ops-inbox`) — full multi-channel scan, up to 60 turns — burns Claude usage; does not delete session transcripts when disabled.  
2. **Grok `xapi` MCP** — OAuth loop was reopening X authorize (disabled in `~/.grok/config.toml` as of 2026-07-14).  
3. **PostHog AI** in the PostHog UI — disable in PostHog organization AI settings; does not delete session recordings.

To stop ops-inbox recurring work: do not schedule CronCreate for inbox; remove any cron jobs via Claude CronList if present; do not invoke `/ops-inbox` or GSD inbox on a timer.
