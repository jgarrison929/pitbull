# Mobile AI MVP core notes (2.19.3 → 2.20.2)

**Status:** Intelligence band **shipped through 2.21.2**  
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

## Remainder shipped (2.20.3 → 2.21.2)

| Version | Deliverable |
|---------|-------------|
| 2.20.3 | Schedule slip risk proxy flag |
| 2.20.4 | PostHog `ai_suggestion_applied` |
| 2.20.5 | Help AI mobile FAQ |
| 2.20.6 | AiInputSanitizer unit tests |
| 2.20.7 | Demo AI rate limits |
| 2.20.8 | AI panel error boundary |
| 2.20.9 | Field AI integration tests |
| 2.21.0 | voice-ai-merge vitest |
| 2.21.1 | AI trust boundary docs |
| 2.21.2 | **Band checkpoint** |

Next product: workflow + CI subset **2.21.3+**.
