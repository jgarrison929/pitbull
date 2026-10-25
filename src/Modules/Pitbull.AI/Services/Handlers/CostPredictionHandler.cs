using Pitbull.AI.Providers;
using Pitbull.Core.CQRS;

namespace Pitbull.AI.Services.Handlers;

/// <summary>
/// Feature handler for AI-powered cost prediction and analysis.
/// Analyzes project cost data and provides budget forecasting,
/// variance analysis, and cost-to-complete estimates.
/// </summary>
public sealed class CostPredictionHandler(
    IAiService aiService) : IAiFeatureHandler
{
    public string FeatureName => "cost-prediction";
    public AiCapability RequiredCapability => AiCapability.Analysis;

    public async Task<Result<AiFeatureResult>> ExecuteAsync(AiFeatureRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Input))
        {
            return Result.Failure<AiFeatureResult>(
                "Cost data is required for prediction analysis.",
                "VALIDATION_ERROR");
        }

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: CostPredictionPrompt,
            UserPrompt: request.Input,
            Capability: RequiredCapability,
            MaxTokens: 2048,
            Temperature: 0.2m);

        var result = await aiService.CompleteAsync(request.TenantId, aiRequest, ct: ct);

        if (!result.IsSuccess)
        {
            return Result.Failure<AiFeatureResult>(
                $"Cost prediction failed: {result.Error}",
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

    private const string CostPredictionPrompt = """
        You are a construction cost analysis assistant for a commercial general contractor ERP.
        Analyze the provided cost data and provide predictions and insights.

        RESPONSE FORMAT (return ONLY valid JSON, no markdown fences):
        {
          "predictedCostAtCompletion": number,
          "predictedVariance": number,
          "variancePercentage": number,
          "confidenceLevel": "High" | "Medium" | "Low",
          "riskFactors": ["string"],
          "recommendations": ["string"],
          "costTrend": "UnderBudget" | "OnBudget" | "OverBudget",
          "summary": "string"
        }

        RULES:
        - Use cost-to-cost method (costs-to-date / estimated-total-cost) for % complete.
        - Flag any cost codes trending over budget.
        - Consider seasonal factors for labor-intensive trades.
        - Identify potential change order exposure.
        - Base predictions on earned value management (EVM) principles.
        - All monetary values should be plain numbers, no currency symbols.
        """;
}
