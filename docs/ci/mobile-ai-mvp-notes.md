# Mobile AI MVP core notes (2.19.3 → 2.20.2)

**Status:** Checkpoint **2.20.2**  
**Spec:** `docs/specs/mobile-ai-intelligence.md`

## Truth rules

- AI never auto-posts progress or narratives without user confirm.
- No invented cost / % complete / green all-clear.
- Offline: AI disabled with honest copy (no silent pretend success).
- Labels: “Suggestion — review before submit”.

## Version map (core)

| Version | Deliverable |
|---------|-------------|
| 2.19.3 | `POST /api/ai/field-voice-suggestion` scaffold |
| 2.19.4 | Construction jargon system prompt |
| 2.19.5 | Apply AI suggestion chip (confirm) |
| 2.19.6 | Per-company usage (`CompanyId` + `field-voice-suggestion`) |
| 2.19.7 | Photo safety heuristic (labeled) |
| 2.19.8 | Shared AI_SUGGESTION_REVIEW_LABEL |
| 2.19.9 | Offline AI disabled |
| 2.20.0 | Rule-based EOD summary |
| 2.20.1 | Optional LLM EOD (`NEXT_PUBLIC_FEATURE_FIELD_LLM_EOD` default **OFF**) |
| 2.20.2 | **This checkpoint** |

## Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `NEXT_PUBLIC_FEATURE_FIELD_LLM_EOD` | **OFF** | Optional LLM rewrite of EOD bullets |

## Endpoints

- `POST /api/ai/field-voice-suggestion` — structured narratives
- `POST /api/ai/field-eod-summary` — optional LLM bullets (suggestion)

## Tests

```powershell
cd src/Pitbull.Web/pitbull-web
npm test -- --run field-ai-suggestion field-eod-summary field-photo-safety feature-flags ai-suggestion-label

dotnet test tests/Pitbull.Tests.Unit --filter "FullyQualifiedName~AiFieldVoice|AiUsage"
```

## Next (2.20.3+)

Risk flag schedule slip, PostHog, Help FAQ, sanitization tests, demo rate limits, error boundary, integration mock, vitest merge, trust docs, band close 2.21.2.
