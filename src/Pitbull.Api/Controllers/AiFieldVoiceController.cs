using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Api.Validation;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Field voice → structured narrative suggestions (2.19.3 scaffold).
/// Auth required. Returns suggestion DTO only — never auto-applies progress.
/// Client must confirm before writing narratives.
/// </summary>
[ApiController]
[Route("api/ai")]
[Authorize]
[EnableRateLimiting("ai-suggest")]
[Produces("application/json")]
[Tags("AI")]
public class AiFieldVoiceController(
    IAiService aiService,
    IAiUsageService usageService,
    ICompanyContext companyContext) : ControllerBase
{
    public const string UsageFeatureName = "field-voice-suggestion";
    private const int MaxTranscriptLength = 8000;

    private Guid GetTenantId()
    {
        var tenantClaim = User.FindFirst("tenant_id")?.Value;
        return Guid.TryParse(tenantClaim, out var tid) ? tid : Guid.Empty;
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    /// <summary>
    /// Scaffold: turn a field voice transcript into structured narrative suggestions.
    /// Does not write daily reports or progress — suggestion only.
    /// </summary>
    [HttpPost("field-voice-suggestion")]
    [ProducesResponseType(typeof(FieldVoiceSuggestionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> FieldVoiceSuggestion(
        [FromBody] FieldVoiceSuggestionRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Transcript))
            return BadRequest(new { error = "transcript is required", code = "VALIDATION_ERROR" });

        if (AiInputSanitizer.ValidateLength(request.Transcript, MaxTranscriptLength, "transcript") is { } lenErr)
            return BadRequest(new { error = lenErr, code = "VALIDATION_ERROR" });

        var transcript = AiInputSanitizer.Sanitize(request.Transcript);
        if (string.IsNullOrWhiteSpace(transcript))
            return BadRequest(new { error = "transcript is required", code = "VALIDATION_ERROR" });

        // 2.19.4 — construction jargon → structured narratives (prompt in code; no invented costs)
        var systemPrompt = FieldVoicePrompts.ConstructionJargonSystemPrompt;

        var userPrompt = $"""
            ProjectId: {(request.ProjectId?.ToString() ?? "unknown")}
            Transcript:
            {transcript}
            """;

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: systemPrompt,
            UserPrompt: userPrompt,
            Capability: AiCapability.TextGeneration,
            MaxTokens: 768,
            Temperature: 0.3m);

        var tenantId = GetTenantId();
        var result = await aiService.CompleteAsync(tenantId, aiRequest, null, ct);

        if (!result.IsSuccess)
        {
            // Scaffold honesty: when AI unavailable, return empty structured suggestion (not fake success text)
            if (result.ErrorCode is "AI_NOT_CONFIGURED" or "AI_PROVIDER_ERROR")
            {
                return Ok(FieldVoiceSuggestionResponse.EmptyScaffold(
                    reason: result.ErrorCode == "AI_NOT_CONFIGURED"
                        ? "AI is not configured — no invented narratives."
                        : "AI temporarily unavailable — try again or enter narratives manually.",
                    model: null,
                    provider: null,
                    latencyMs: 0));
            }

            return StatusCode(503, new { error = result.Error, code = result.ErrorCode });
        }

        var latencyMs = (long)result.Value!.Latency.TotalMilliseconds;
        // 2.19.6 — per-company usage meter (feature field-voice-suggestion)
        try
        {
            Guid? companyId = companyContext.IsResolved ? companyContext.CompanyId : null;
            await usageService.LogUsageAsync(
                GetUserId(),
                result.Value.Provider,
                result.Value.Model,
                tokensIn: 0,
                tokensOut: 0,
                estimatedCost: 0m,
                feature: UsageFeatureName,
                durationMs: (int)Math.Min(latencyMs, int.MaxValue),
                confidenceScore: result.Value.ConfidenceScore,
                ct: ct,
                companyId: companyId);
        }
        catch
        {
            // Metering must not fail the suggestion path
        }

        var parsed = FieldVoiceSuggestionParser.Parse(result.Value.Content, transcript);
        return Ok(parsed with
        {
            Model = result.Value.Model,
            Provider = result.Value.Provider,
            LatencyMs = latencyMs,
            Label = FieldVoiceSuggestionResponse.DefaultLabel,
            AutoApplied = false,
        });
    }
}

public record FieldVoiceSuggestionRequest(
    string Transcript,
    Guid? ProjectId = null);

/// <summary>
/// Suggestion DTO — client must confirm before applying. Never auto-posts progress.
/// </summary>
public record FieldVoiceSuggestionResponse(
    string WorkNarrative,
    string DelaysNarrative,
    string SafetyNarrative,
    string ConfidenceNote,
    string Label,
    bool AutoApplied,
    string? Model,
    string? Provider,
    long LatencyMs)
{
    public const string DefaultLabel = "Suggestion — review before submit";

    public static FieldVoiceSuggestionResponse EmptyScaffold(
        string reason,
        string? model,
        string? provider,
        long latencyMs) => new(
        WorkNarrative: "",
        DelaysNarrative: "",
        SafetyNarrative: "",
        ConfidenceNote: reason,
        Label: DefaultLabel,
        AutoApplied: false,
        Model: model,
        Provider: provider,
        LatencyMs: latencyMs);
}

/// <summary>
/// Construction field prompts (2.19.4). Kept as constants for unit tests and docs.
/// </summary>
public static class FieldVoicePrompts
{
    public const string ConstructionJargonSystemPrompt = """
        You are Pitbull field AI for heavy civil / commercial construction. Convert a superintendent
        or foreman voice transcript into structured daily-report narrative suggestions.

        Return ONLY valid JSON (no markdown fences):
        {
          "workNarrative": "string or empty",
          "delaysNarrative": "string or empty",
          "safetyNarrative": "string or empty",
          "confidenceNote": "short honesty note"
        }

        Construction jargon mapping (expand plain language; do not invent quantities or costs):
        - pour / slab / deck → concrete placement (workNarrative)
        - strip forms / formwork → formwork work (workNarrative)
        - rebar / mats → reinforcing steel (workNarrative)
        - layup / lay-up / hang rock → drywall / interior finishes (workNarrative)
        - trench / excavate / dig → earthwork (workNarrative)
        - set steel / erect → structural steel (workNarrative)
        - rain day / weather / wind hold → delaysNarrative
        - material late / no truck / waiting on inspect → delaysNarrative
        - near miss / first aid / PPE / toolbox / stretch and flex → safetyNarrative
        - RFI / hold point / red tag → delays or work only if clearly stated

        Rules:
        - Never invent cost amounts, unit prices, schedule % complete, or green/all-clear status.
        - Never claim work is complete unless the transcript clearly says so.
        - Leave fields empty rather than guess trades, zones, or quantities.
        - Prefer short field-ready sentences a superintendent would edit, not marketing copy.
        - Output is a SUGGESTION for the user to review — not a final record (AutoApplied never true).
        """;
}

/// <summary>Parse model JSON into suggestion fields; falls back to empty (honest).</summary>
public static class FieldVoiceSuggestionParser
{
    public static FieldVoiceSuggestionResponse Parse(string content, string originalTranscript)
    {
        try
        {
            var json = content.Trim();
            if (json.StartsWith("```", StringComparison.Ordinal))
            {
                var start = json.IndexOf('{');
                var end = json.LastIndexOf('}');
                if (start >= 0 && end > start)
                    json = json[start..(end + 1)];
            }

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            return new FieldVoiceSuggestionResponse(
                WorkNarrative: GetString(root, "workNarrative"),
                DelaysNarrative: GetString(root, "delaysNarrative"),
                SafetyNarrative: GetString(root, "safetyNarrative"),
                ConfidenceNote: GetString(root, "confidenceNote") is { Length: > 0 } n
                    ? n
                    : "Parsed suggestion — review before submit.",
                Label: FieldVoiceSuggestionResponse.DefaultLabel,
                AutoApplied: false,
                Model: null,
                Provider: null,
                LatencyMs: 0);
        }
        catch
        {
            // Honest: if unparseable, do not invent structure from raw transcript as "AI success"
            return FieldVoiceSuggestionResponse.EmptyScaffold(
                reason: "Could not parse AI response into structured fields — enter narratives manually.",
                model: null,
                provider: null,
                latencyMs: 0);
        }
    }

    private static string GetString(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var p)) return "";
        return p.ValueKind == JsonValueKind.String ? (p.GetString() ?? "").Trim() : "";
    }
}
