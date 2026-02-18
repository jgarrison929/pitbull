using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Api.Validation;
using Pitbull.Core.Data;
using Pitbull.RFIs.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// AI-powered field suggestions for data entry pages.
/// Accepts context about a field and returns an AI-generated suggestion.
/// </summary>
[ApiController]
[Route("api/ai")]
[Authorize]
[EnableRateLimiting("ai-suggest")]
[Produces("application/json")]
[Tags("AI")]
public class AiSuggestController(IAiService aiService, PitbullDbContext db) : ControllerBase
{
    private const int MaxFieldValueLength = 2000;
    private const int MaxContextValueLength = 2000;
    private const int MaxContextEntries = 50;

    private Guid GetTenantId()
    {
        var tenantClaim = User.FindFirst("tenant_id")?.Value;
        return Guid.TryParse(tenantClaim, out var tid) ? tid : Guid.Empty;
    }

    /// <summary>
    /// Generate an AI suggestion for a specific field based on context.
    /// </summary>
    [HttpPost("suggest")]
    [ProducesResponseType(typeof(AiSuggestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Suggest(
        [FromBody] AiSuggestRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.FieldName))
            return BadRequest(new { error = "fieldName is required", code = "VALIDATION_ERROR" });

        if (AiInputSanitizer.ValidateLength(request.FieldName, 200, "fieldName") is { } fnErr)
            return BadRequest(new { error = fnErr, code = "VALIDATION_ERROR" });

        if (AiInputSanitizer.ValidateLength(request.CurrentValue, MaxFieldValueLength, "currentValue") is { } cvErr)
            return BadRequest(new { error = cvErr, code = "VALIDATION_ERROR" });

        if (AiInputSanitizer.ValidateLength(request.EntityType, 200, "entityType") is { } etErr)
            return BadRequest(new { error = etErr, code = "VALIDATION_ERROR" });

        if (AiInputSanitizer.ValidateCollectionSize(request.Context, MaxContextEntries, "context") is { } csErr)
            return BadRequest(new { error = csErr, code = "VALIDATION_ERROR" });

        if (request.Context is { Count: > 0 })
        {
            foreach (var kvp in request.Context)
            {
                if (AiInputSanitizer.ValidateContextKey(kvp.Key) is { } keyErr)
                    return BadRequest(new { error = keyErr, code = "VALIDATION_ERROR" });

                if (AiInputSanitizer.ValidateLength(kvp.Value, MaxContextValueLength, $"context[{kvp.Key}]") is { } ctxErr)
                    return BadRequest(new { error = ctxErr, code = "VALIDATION_ERROR" });
            }
        }

        var systemPrompt = BuildSystemPrompt(
            AiInputSanitizer.Sanitize(request.FieldName),
            request.EntityType is not null ? AiInputSanitizer.Sanitize(request.EntityType) : null);
        var userPrompt = BuildUserPrompt(request);

        var aiRequest = new AiCompletionRequest(
            systemPrompt,
            userPrompt,
            AiCapability.TextGeneration,
            MaxTokens: 512,
            Temperature: 0.4m);

        var tenantId = GetTenantId();
        var result = await aiService.CompleteAsync(tenantId, aiRequest, null, ct);

        if (!result.IsSuccess)
            return StatusCode(503, new { error = result.Error, code = result.ErrorCode });

        return Ok(new AiSuggestResponse(
            Suggestion: result.Value!.Content.Trim(),
            Model: result.Value.Model,
            Provider: result.Value.Provider,
            LatencyMs: (long)result.Value.Latency.TotalMilliseconds));
    }

    /// <summary>
    /// Find semantically similar RFIs using AI analysis.
    /// </summary>
    [HttpPost("suggest/similar-rfis")]
    [ProducesResponseType(typeof(List<SimilarRfiResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SimilarRfis(
        [FromBody] SimilarRfisRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Subject))
            return BadRequest(new { error = "subject is required", code = "VALIDATION_ERROR" });

        // Query recent RFIs from the same tenant
        var recentRfis = await db.Set<Rfi>()
            .AsNoTracking()
            .Where(r => !r.IsDeleted)
            .OrderByDescending(r => r.CreatedAt)
            .Take(100)
            .Select(r => new { r.Id, r.Number, r.Subject, r.Status })
            .ToListAsync(ct);

        if (recentRfis.Count == 0)
            return Ok(Array.Empty<SimilarRfiResult>());

        // Build AI prompt to find similar RFIs — sanitize DB-stored subjects
        var rfiList = string.Join("\n", recentRfis.Select(r =>
        {
            var safeSubject = (r.Subject ?? "").Replace("\r", " ").Replace("\n", " ");
            if (safeSubject.Length > 200) safeSubject = safeSubject[..200];
            return $"- RFI-{r.Number:D3}: \"{AiInputSanitizer.Sanitize(safeSubject)}\"";
        }));
        var userPrompt = $"""
            New RFI subject: "{AiInputSanitizer.Sanitize(request.Subject)}"
            {(string.IsNullOrWhiteSpace(request.Description) ? "" : $"Description: \"{AiInputSanitizer.Sanitize(request.Description)}\"")}

            Existing RFIs:
            {rfiList}

            Return the top 5 most semantically similar RFIs as a JSON array. Each item should have:
            - "number": the RFI number string (e.g. "RFI-012")
            - "subject": the RFI subject
            - "reason": a brief explanation of why it's similar (one sentence)

            If none are similar, return an empty array [].
            Return ONLY the JSON array, no other text.
            """;

        var tenantId = GetTenantId();
        var aiRequest = new AiCompletionRequest(
            SystemPrompt: "You are an RFI similarity analyzer for a construction management system. Analyze RFI subjects and identify semantically similar ones based on topic, trade, location, or technical content. Return valid JSON only.",
            UserPrompt: userPrompt,
            Capability: AiCapability.Analysis,
            MaxTokens: 1024,
            Temperature: 0.2m);

        var aiResult = await aiService.CompleteAsync(tenantId, aiRequest, null, ct);

        if (!aiResult.IsSuccess)
        {
            // Graceful degradation: return empty array when AI is unavailable
            return Ok(Array.Empty<SimilarRfiResult>());
        }

        // Parse the AI response into similar RFI results
        try
        {
            var content = aiResult.Value!.Content.Trim();
            // Strip markdown code fences if present
            if (content.StartsWith("```"))
            {
                content = content.Split('\n', 2).Length > 1 ? content.Split('\n', 2)[1] : content;
                content = content.TrimEnd('`').Trim();
                if (content.EndsWith("```"))
                    content = content[..^3].Trim();
            }
            var similar = System.Text.Json.JsonSerializer.Deserialize<List<SimilarRfiResult>>(content,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                ?? [];

            // Cross-reference with actual RFI data to add status
            var enriched = similar.Take(5).Select(s =>
            {
                var match = recentRfis.FirstOrDefault(r => $"RFI-{r.Number:D3}" == s.Number);
                return new SimilarRfiResult(
                    s.Number,
                    s.Subject,
                    match?.Status.ToString() ?? "Unknown",
                    s.Reason,
                    match?.Id);
            }).ToList();

            return Ok(enriched);
        }
        catch
        {
            // If AI returns malformed JSON, return empty
            return Ok(Array.Empty<SimilarRfiResult>());
        }
    }

    private static string BuildSystemPrompt(string fieldName, string? entityType)
    {
        var entity = entityType ?? "record";
        return $"""
            You are an AI assistant for a construction management application.
            Generate a concise, professional suggestion for the "{fieldName}" field of a {entity}.
            Return ONLY the suggested text, no explanation or formatting.
            Keep suggestions practical and relevant to commercial construction.
            """;
    }

    private static string BuildUserPrompt(AiSuggestRequest request)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(request.CurrentValue))
            parts.Add($"Current value: {AiInputSanitizer.Sanitize(request.CurrentValue)}");

        if (request.Context is { Count: > 0 })
        {
            foreach (var kvp in request.Context)
                parts.Add($"{kvp.Key}: {AiInputSanitizer.Sanitize(kvp.Value)}");
        }

        if (parts.Count == 0)
            parts.Add($"Generate a suggestion for the {AiInputSanitizer.Sanitize(request.FieldName)} field.");

        return string.Join("\n", parts);
    }
}

// ── DTOs ────────────────────────────────────────────────────────────

public record AiSuggestRequest(
    string FieldName,
    string? EntityType = null,
    string? CurrentValue = null,
    Dictionary<string, string>? Context = null);

public record AiSuggestResponse(
    string Suggestion,
    string Model,
    string Provider,
    long LatencyMs);

public record SimilarRfisRequest(
    string Subject,
    string? Description = null,
    Guid? ProjectId = null);

public record SimilarRfiResult(
    string Number,
    string Subject,
    string Status,
    string Reason,
    Guid? Id = null);
