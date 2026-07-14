# Spec: Product band 3.1 — Field mobile (2026 top asks)

**Status:** Shipped through **3.1.9**  
**Version band:** `3.1.0` → `3.1.9` (10 PRs / stamps)  
**Theme:** Ruthless field asks — offline photos, selected plan PDFs offline, quick log, plan pin→draft RFI  
**Starts after:** `3.0.0` (skips historical 3.0.1–3.0.9 analysis ladder; OBJECTIVE uses **3.1.x**)

## Problem

Field crews abandon apps that drop large photos offline, cannot open viewed drawings offline, force multi-step reports for a simple day log, and cannot pin issues on plans.

## Version table

| Version | Deliverable |
|---------|-------------|
| **3.1.0** | Band note + offline photo **downscale-before-embed** helper + unit tests |
| **3.1.1** | Field report offline photo queue uses downscale; honest queued/skipped UI copy |
| **3.1.2** | Multi-photo offline payload parity (client sync body + tests); raise practical photo count |
| **3.1.3** | Plan binary offline cache helper (key/eviction) + store after view |
| **3.1.4** | Plans list: cached vs not + honest open-unavailable |
| **3.1.5** | “Save for offline” on drawing files + unit tests |
| **3.1.6** | Quick field log path (`?mode=quick`) via real daily-report offline/online path |
| **3.1.7** | Remember last project + plan sheet defaults (device-local) |
| **3.1.8** | Plan pin → draft RFI payload (confirm-to-submit; offline queue when offline) |
| **3.1.9** | Help + CI notes checkpoint; VERSION 3.1.9 |

## Truth rules

- Never claim whole drawing set is offline  
- Never silent-drop photos without UI honesty  
- Pin/RFI never auto-posts without confirm  
- No invented cost/% complete / health scores  

## Non-goals

- Native shell; full set PDF offline; Bluebeam markup; AI auto-post; G5 office glance  
