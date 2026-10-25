using Pitbull.AI.Providers;
using Pitbull.Core.CQRS;

namespace Pitbull.AI.Services.Handlers;

/// <summary>
/// Feature handler for AI-powered smart field suggestions.
/// Parses natural language into structured entity data for
/// time entries, daily reports, and other ERP entities.
/// </summary>
public sealed class SmartFieldHandler(
    IAiService aiService) : IAiFeatureHandler
{
    public string FeatureName => "smart-fields";
    public AiCapability RequiredCapability => AiCapability.Analysis;

    public async Task<Result<AiFeatureResult>> ExecuteAsync(AiFeatureRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Input))
        {
            return Result.Failure<AiFeatureResult>(
                "Text input is required for smart field parsing.",
                "VALIDATION_ERROR");
        }

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: SmartFieldPrompt,
            UserPrompt: request.Input,
            Capability: RequiredCapability,
            MaxTokens: 1024,
            Temperature: 0.1m);

        var result = await aiService.CompleteAsync(request.TenantId, aiRequest, ct: ct);

        if (!result.IsSuccess)
        {
            return Result.Failure<AiFeatureResult>(
                $"Smart field parsing failed: {result.Error}",
                result.ErrorCode ?? "AI_PROVIDER_ERROR");
        }

        var completion = result.Value!;
        return Result.Success(new AiFeatureResult(
            Content: completion.Content,
            ConfidenceScore: completion.ConfidenceScore,
            Provider: completion.Provider,
            Model: completion.Model,
            LatencyMs: (long)completion.Latency.TotalMilliseconds));
    }

    private const string SmartFieldPrompt = """
        You are a data extraction assistant for a construction management ERP.
        Parse the user's natural language into structured JSON for creating entities.

        SUPPORTED ENTITY TYPES:
        1. "TimeEntry" - Log hours for an employee on a project
           Fields: employeeName (string), projectName (string), costCodeCode (string), date (YYYY-MM-DD, default today), regularHours (number), overtimeHours (number, default 0), doubletimeHours (number, default 0), description (string, optional)
        2. "DailyReport" - Create a daily field report
           Fields: projectName (string), date (YYYY-MM-DD, default today), weatherSummary (string), temperatureHigh (number, optional), temperatureLow (number, optional), manpower (number, optional), workNarrative (string), safetyNarrative (string, optional)

        RULES:
        - Return ONLY valid JSON, no markdown fences, no explanation.
        - Use the exact field names above.
        - If hours are mentioned without specifying type, assume regularHours.
        - If "OT" or "overtime" is mentioned, put those hours in overtimeHours.
        - If no date is specified, omit the date field (we'll default to today).
        - If you cannot determine the entity type, set entityType to "Unknown".

        RESPONSE FORMAT:
        {"entityType": "TimeEntry", "fields": { ... }, "summary": "Log 8 regular hours for John on Downtown project"}
        """;
}
