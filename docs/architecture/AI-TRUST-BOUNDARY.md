# AI trust boundary addendum

**Version note:** Documented for product band 2.21.1. Canonical summary also in `docs/ARCHITECTURE.md` § AI trust boundary.

## Boundary

AI may **suggest** narratives and summaries. Humans **confirm** before fields are written. The API never writes PM progress/schedule entities from AI responses alone.

## Threats mitigated

1. **Prompt injection** — `AiInputSanitizer`  
2. **Demo abuse** — stricter rate limits for `is_demo_user`  
3. **Silent offline “success”** — AI calls disabled offline  
4. **Vanity confidence** — no unlabeled % complete or cost from AI  
5. **Auto-apply** — client `confirm: true` required; server `AutoApplied` always false on field voice/EOD  

## Related code

- `src/Pitbull.Api/Controllers/AiFieldVoiceController.cs`  
- `src/Pitbull.Api/Validation/AiInputSanitizer.cs`  
- `src/Pitbull.Api/Configuration/AiRateLimitPolicy.cs`  
- `src/Pitbull.Web/pitbull-web/src/lib/field-ai-suggestion.ts`  
- `src/Pitbull.Web/pitbull-web/src/lib/voice-ai-merge.ts`  
