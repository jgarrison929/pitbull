using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Api.Demo;
using Pitbull.Api.Validation;
using Pitbull.Core.Data;

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
public class AiChatController(IAiService aiService, PitbullDbContext db, IOptions<DemoOptions> demoOptions) : ControllerBase
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

        // Build enriched context from pageContext (entity data) + systemContext (page label)
        var enrichedContext = await BuildEnrichedContextAsync(request.PageContext, request.SystemContext);

        var isDemoUser = User.FindFirst("is_demo_user")?.Value == "true";
        var demo = demoOptions.Value;

        var systemPrompt = isDemoUser && demo.Enabled
            ? $"{demo.AiSystemPrompt}{enrichedContext}"
            : $"""
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
                Format responses with markdown when helpful.{enrichedContext}
                """;

        var modelOverride = isDemoUser && demo.Enabled ? demo.AiModel : null;

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: systemPrompt,
            UserPrompt: userPrompt,
            Capability: AiCapability.TextGeneration,
            MaxTokens: isDemoUser ? 1024 : 2048,
            Temperature: 0.5m,
            ModelOverride: modelOverride);

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
            LatencyMs: (long)result.Value.Latency.TotalMilliseconds,
            ConfidenceScore: result.Value.ConfidenceScore));
    }

    private async Task<string> BuildEnrichedContextAsync(string? pageContext, string? systemContext)
    {
        var parts = new List<string>();

        // Try to enrich with real entity data from pageContext
        if (!string.IsNullOrWhiteSpace(pageContext))
        {
            try
            {
                using var doc = JsonDocument.Parse(pageContext);
                var root = doc.RootElement;
                var page = root.GetProperty("page").GetString();

                switch (page)
                {
                    case "project_detail" when root.TryGetProperty("projectId", out var pid)
                        && Guid.TryParse(pid.GetString(), out var projectId):
                    {
                        var project = await db.Set<Pitbull.Projects.Domain.Project>()
                            .AsNoTracking()
                            .Where(p => p.Id == projectId)
                            .Select(p => new { p.Name, p.Number, p.Status, p.ContractAmount, p.StartDate })
                            .FirstOrDefaultAsync();
                        if (project != null)
                        {
                            var section = root.TryGetProperty("section", out var s) ? s.GetString() : "Overview";
                            parts.Add($"User is viewing Project \"{project.Name}\" (#{project.Number}), Status: {project.Status}, Contract: ${project.ContractAmount:N2}, Start: {project.StartDate?.ToString("MMM d, yyyy") ?? "N/A"}. Section: {section}.");
                        }
                        break;
                    }
                    case "bid_detail" when root.TryGetProperty("bidId", out var bid)
                        && Guid.TryParse(bid.GetString(), out var bidId):
                    {
                        var b = await db.Set<Pitbull.Bids.Domain.Bid>()
                            .AsNoTracking()
                            .Where(x => x.Id == bidId)
                            .Select(x => new { x.Name, x.Number, x.Status, x.EstimatedValue, x.DueDate })
                            .FirstOrDefaultAsync();
                        if (b != null)
                            parts.Add($"User is viewing Bid \"{b.Name}\" (#{b.Number}), Status: {b.Status}, Estimated: ${b.EstimatedValue:N2}, Due: {b.DueDate?.ToString("MMM d, yyyy") ?? "N/A"}.");
                        break;
                    }
                    case "contract_detail" when root.TryGetProperty("contractId", out var cid)
                        && Guid.TryParse(cid.GetString(), out var contractId):
                    {
                        var c = await db.Set<Pitbull.Contracts.Domain.Subcontract>()
                            .AsNoTracking()
                            .Where(x => x.Id == contractId)
                            .Select(x => new { x.SubcontractNumber, x.SubcontractorName, x.Status, x.CurrentValue })
                            .FirstOrDefaultAsync();
                        if (c != null)
                            parts.Add($"User is viewing Contract #{c.SubcontractNumber} with {c.SubcontractorName}, Status: {c.Status}, Value: ${c.CurrentValue:N2}.");
                        break;
                    }
                    case "dashboard":
                        parts.Add("User is on the Dashboard — the main overview page showing key metrics and recent activity.");
                        break;
                    case "projects_list":
                        parts.Add("User is on the Projects list — viewing all active projects.");
                        break;
                    case "bids_list":
                        parts.Add("User is on the Bids list — viewing all bids in various stages.");
                        break;
                    case "contracts_list":
                        parts.Add("User is on the Contracts list — viewing all subcontracts.");
                        break;
                    case "time_tracking":
                        parts.Add("User is in Time Tracking — managing crew timecards, approvals, or time entry.");
                        break;
                    case "cost_codes":
                        parts.Add("User is on the Cost Codes page — managing CSI division codes for job cost accounting.");
                        break;
                    case "reports":
                        parts.Add("User is in the Reports section — labor cost, profitability, Vista export, etc.");
                        break;
                    case "pay_applications":
                        parts.Add("User is managing Pay Applications (progress billing) for projects.");
                        break;
                }
            }
            catch
            {
                // Malformed pageContext — fall through to systemContext
            }
        }

        // Fall back to systemContext label if no enriched data
        if (parts.Count == 0 && !string.IsNullOrWhiteSpace(systemContext))
        {
            parts.Add($"The user is currently viewing: {AiInputSanitizer.Sanitize(systemContext)}");
        }

        if (parts.Count == 0)
            return "";

        return $"\n\n{string.Join(" ", parts)}\nHelp them with questions about their current context when possible.";
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
    string? SystemContext = null,
    string? PageContext = null);

public record AiChatResponse(
    string Reply,
    string Model,
    string Provider,
    long LatencyMs,
    decimal ConfidenceScore);
