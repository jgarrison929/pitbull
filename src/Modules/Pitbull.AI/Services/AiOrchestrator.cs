using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;

namespace Pitbull.AI.Services;

/// <summary>
/// Routes feature requests to the appropriate handler, selects providers
/// by capability, and logs usage. Acts as the central dispatch for all
/// feature-specific AI operations.
/// </summary>
public sealed class AiOrchestrator(
    IEnumerable<IAiFeatureHandler> handlers,
    IAiUsageService usageService,
    ILogger<AiOrchestrator> logger) : IAiOrchestrator
{
    private readonly Dictionary<string, IAiFeatureHandler> _handlerMap =
        handlers.ToDictionary(h => h.FeatureName, h => h, StringComparer.OrdinalIgnoreCase);

    public async Task<Result<AiFeatureResult>> ExecuteFeatureAsync(
        string featureName,
        AiFeatureRequest request,
        CancellationToken ct)
    {
        if (!_handlerMap.TryGetValue(featureName, out var handler))
        {
            return Result.Failure<AiFeatureResult>(
                $"No handler registered for feature '{featureName}'. Available: {string.Join(", ", _handlerMap.Keys)}",
                "FEATURE_NOT_FOUND");
        }

        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            var result = await handler.ExecuteAsync(request, ct);
            sw.Stop();

            if (result.IsSuccess)
            {
                await TryLogUsageAsync(
                    request.TenantId,
                    result.Value!.Provider,
                    result.Value.Model,
                    featureName,
                    sw.ElapsedMilliseconds,
                    result.Value.ConfidenceScore,
                    ct);
            }

            return result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            sw.Stop();
            logger.LogError(ex, "Feature handler '{FeatureName}' threw an unhandled exception", featureName);

            return Result.Failure<AiFeatureResult>(
                $"Feature '{featureName}' failed: {ex.Message}",
                "FEATURE_HANDLER_ERROR");
        }
    }

    public IReadOnlyList<string> GetRegisteredFeatures()
        => _handlerMap.Keys.ToList().AsReadOnly();

    private async Task TryLogUsageAsync(
        Guid tenantId, string provider, string model, string feature,
        long durationMs, decimal confidence, CancellationToken ct)
    {
        try
        {
            await usageService.LogUsageAsync(
                Guid.Empty, // userId resolved by controller layer
                provider,
                model,
                0, 0, 0m, // token counts tracked by individual handlers if needed
                feature,
                (int)durationMs,
                confidence,
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to log AI usage for feature '{Feature}'", feature);
        }
    }
}
