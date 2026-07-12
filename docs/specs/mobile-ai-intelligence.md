# Spec: Mobile AI intelligence (MVP)

**Status:** In progress — voice scaffold **2.19.3**  
**Version band:** 2.19.3 → 2.21.2 (20 PRs)  
**Related:** [`docs/mobile3.md`](../mobile3.md) Phase 4, AI module, `AiChatController`, `AiFieldVoiceController`

## Problem

Voice uses browser STT + regex only; no structured LLM output or photo assist — limits differentiation. AI must never auto-post progress.

## Personas

Superintendent (field report), PM (optional summary).

## User journey

1. Super dictates work narrative on field report  
2. AI returns structured suggestion chips — user **confirms** before apply  
3. Offline: AI disabled with honest copy  
4. Optional end-of-day summary behind flag  

## Primary code touchpoints

| Area | Paths |
|------|-------|
| Field report | `daily-reports/mobile/page.tsx` |
| AI API | `src/Pitbull.Api/Controllers/AiChatController.cs` + AI services/modules |
| Usage tracking | existing AI usage entities/services |
| PostHog | `lib/posthog.ts` |
| Help | `help/page.tsx` |
| ARCHITECTURE note | `docs/ARCHITECTURE.md` or short addendum |

## API touchpoints

- Scaffold voice/structure endpoint using **existing** AI provider stack  
- Rate limits for demo users  
- Never write progress/schedule without explicit user confirm client-side  

## Version table

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.19.3 | AI voice endpoint scaffold | Auth required; returns suggestion DTO |
| 2.19.4 | Prompt: construction jargon → structured narratives | Prompt in code/docs; no invented costs |
| 2.19.5 | Field report: “Apply AI suggestion” chip | User confirm required |
| 2.19.6 | Usage tracking per company | Meter increments |
| 2.19.7 | Photo assist: optional safety flag suggestion | Labeled suggestion only |
| 2.19.8 | Label all AI output “Suggestion — review before submit” | Visible UI copy |
| 2.19.9 | Offline: AI disabled with honest copy | No silent fail pretending success |
| 2.20.0 | End-of-day field summary (rule-based first) | No LLM required |
| 2.20.1 | Optional LLM summary behind flag | Flag off by default in prod unless documented |
| 2.20.2 | Checkpoint — AI MVP core | |
| 2.20.3 | Risk flag on schedule slip from mobile entry | Proxy labeled; no fake certainty |
| 2.20.4 | PostHog `ai_suggestion_applied` | Diagnostic |
| 2.20.5 | Help: AI on mobile FAQ | |
| 2.20.6 | Unit tests prompt sanitization | Pass |
| 2.20.7 | Rate limit demo users | Enforced |
| 2.20.8 | Error boundary on AI panel | Fail soft |
| 2.20.9 | Integration test mock provider | Pass |
| 2.21.0 | Vitest voice + AI merge helpers | Pass |
| 2.21.1 | Docs: AI trust boundary addendum | Written |
| 2.21.2 | Checkpoint — intelligence band | Spec Status shipped through 2.21.2 |

## Non-goals

- Autonomous schedule rewriting  
- Unlabeled cost/schedule predictions  

## Truth rules

- AI never auto-posts progress without user confirm  
- No invented schedule/cost numbers — suggestions only  

## Band DoD (2.21.2)

- [ ] Confirm-to-apply UX  
- [ ] Offline honesty  
- [ ] Help + trust docs  
