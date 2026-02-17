using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// AI-powered field suggestions for data entry pages.
/// Accepts context about a field and returns an AI-generated suggestion.
/// </summary>
[ApiController]
[Route("api/ai")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("AI")]
public class AiSuggestController(IAiService aiService) : ControllerBase
{
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
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> Suggest(
        [FromBody] AiSuggestRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.FieldName))
            return BadRequest(new { error = "fieldName is required", code = "VALIDATION_ERROR" });

        var systemPrompt = BuildSystemPrompt(request.FieldName, request.EntityType);
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
            return StatusCode(502, new { error = result.Error, code = "AI_ERROR" });

        return Ok(new AiSuggestResponse(
            Suggestion: result.Value!.Content.Trim(),
            Model: result.Value.Model,
            Provider: result.Value.Provider,
            LatencyMs: (long)result.Value.Latency.TotalMilliseconds));
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
            parts.Add($"Current value: {request.CurrentValue}");

        if (request.Context is { Count: > 0 })
        {
            foreach (var kvp in request.Context)
                parts.Add($"{kvp.Key}: {kvp.Value}");
        }

        if (parts.Count == 0)
            parts.Add($"Generate a suggestion for the {request.FieldName} field.");

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
