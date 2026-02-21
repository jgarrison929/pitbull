using Pitbull.Core.CQRS;

namespace Pitbull.AI.Services;

/// <summary>
/// Orchestrates AI feature requests by routing to the appropriate handler
/// and selecting the best provider based on capability requirements.
/// </summary>
public interface IAiOrchestrator
{
    /// <summary>
    /// Execute a feature by name, routing to the registered handler.
    /// </summary>
    Task<Result<AiFeatureResult>> ExecuteFeatureAsync(
        string featureName,
        AiFeatureRequest request,
        CancellationToken ct);

    /// <summary>
    /// List all registered feature handler names.
    /// </summary>
    IReadOnlyList<string> GetRegisteredFeatures();
}
