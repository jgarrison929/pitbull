using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Api.Validation;

namespace Pitbull.Api.Controllers;

/// <summary>
/// AI chat endpoint for the embedded assistant.
/// Accepts conversation history and returns an AI response.
/// </summary>
[ApiController]
[Route("api/ai")]
[Authorize]
[EnableRateLimiting("ai-chat")]
[Produces("application/json")]
[Tags("AI")]
public class AiChatController(IAiService aiService) : ControllerBase
{
    private const int MaxMessageLength = 4000;
    private const int MaxHistoryItems = 20;

    private Guid GetTenantId()
    {
        var tenantClaim = User.FindFirst("tenant_id")?.Value;
        return Guid.TryParse(tenantClaim, out var tid) ? tid : Guid.Empty;
    }

    /// <summary>
    /// Send a message to the AI assistant with conversation history.
    /// </summary>
    [HttpPost("chat")]
    [ProducesResponseType(typeof(AiChatResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Chat(
        [FromBody] AiChatRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { error = "message is required", code = "VALIDATION_ERROR" });

        if (AiInputSanitizer.ValidateLength(request.Message, MaxMessageLength, "message") is { } msgErr)
            return BadRequest(new { error = msgErr, code = "VALIDATION_ERROR" });

        if (AiInputSanitizer.ValidateCollectionSize(request.History, MaxHistoryItems, "history") is { } histSizeErr)
            return BadRequest(new { error = histSizeErr, code = "VALIDATION_ERROR" });

        // Validate individual history messages as well
        if (request.History is { Count: > 0 })
        {
            foreach (var msg in request.History)
            {
                if (AiInputSanitizer.ValidateLength(msg.Content, MaxMessageLength, "history message") is { } histErr)
                    return BadRequest(new { error = histErr, code = "VALIDATION_ERROR" });
            }
        }

        var sanitizedMessage = AiInputSanitizer.Sanitize(request.Message);
        if (string.IsNullOrWhiteSpace(sanitizedMessage))
            return BadRequest(new { error = "message is required", code = "VALIDATION_ERROR" });

        var conversationContext = BuildConversationContext(request.History);
        var userPrompt = string.IsNullOrWhiteSpace(conversationContext)
            ? sanitizedMessage
            : $"{conversationContext}\n\nUser: {sanitizedMessage}";

        var contextClause = string.IsNullOrWhiteSpace(request.SystemContext)
            ? ""
            : $"\n\nThe user is currently viewing: {AiInputSanitizer.Sanitize(request.SystemContext)}\nHelp them with questions about their current context when possible.";

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: $"""
                You are Pitbull AI, an in-app assistant for a construction management platform.
                You help project managers, estimators, and superintendents with:
                - Project management questions (budgets, schedules, phases)
                - Bid preparation and analysis
                - Subcontract and change order guidance
                - RFI drafting and response review
                - Time tracking and labor cost questions
                - Construction industry best practices

                Be concise, professional, and practical. Use construction industry terminology.
                If you don't know something specific to the user's data, say so.
                Format responses with markdown when helpful.{contextClause}
                """,
            UserPrompt: userPrompt,
            Capability: AiCapability.TextGeneration,
            MaxTokens: 2048,
            Temperature: 0.5m);

        var tenantId = GetTenantId();
        var result = await aiService.CompleteAsync(tenantId, aiRequest, null, ct);

        if (!result.IsSuccess)
        {
            return StatusCode(503, new
            {
                error = result.ErrorCode == "AI_NOT_CONFIGURED"
                    ? "AI service is not configured. Add an API key in Settings → AI to enable the assistant."
                    : "AI service is temporarily unavailable. Please try again later.",
                code = result.ErrorCode
            });
        }

        return Ok(new AiChatResponse(
            Reply: result.Value!.Content,
            Model: result.Value.Model,
            Provider: result.Value.Provider,
            LatencyMs: (long)result.Value.Latency.TotalMilliseconds));
    }

    private static string BuildConversationContext(List<AiChatMessage>? history)
    {
        if (history is not { Count: > 0 })
            return string.Empty;

        // Include last 10 messages to keep context manageable
        var recent = history.Count > 10 ? history[^10..] : history;
        var lines = recent.Select(m =>
            $"{(m.Role == "user" ? "User" : "Assistant")}: {AiInputSanitizer.Sanitize(m.Content)}");
        return string.Join("\n", lines);
    }
}

// ── DTOs ────────────────────────────────────────────────────────────

public record AiChatMessage(string Role, string Content);

public record AiChatRequest(
    string Message,
    List<AiChatMessage>? History = null,
    string? SystemContext = null);

public record AiChatResponse(
    string Reply,
    string Model,
    string Provider,
    long LatencyMs);
