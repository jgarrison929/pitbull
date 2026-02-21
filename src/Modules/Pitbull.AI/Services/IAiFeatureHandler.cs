using Pitbull.AI.Providers;
using Pitbull.Core.CQRS;

namespace Pitbull.AI.Services;

/// <summary>
/// Request model for feature-specific AI operations.
/// </summary>
public record AiFeatureRequest(
    Guid TenantId,
    string Input,
    Dictionary<string, string>? Metadata = null
);

/// <summary>
/// Result model from feature-specific AI operations.
/// </summary>
public record AiFeatureResult(
    string Content,
    decimal ConfidenceScore,
    string Provider,
    string Model,
    long LatencyMs,
    Dictionary<string, string>? Metadata = null
);

/// <summary>
/// Interface for feature-specific AI handlers. Each handler encapsulates
/// the prompting, parsing, and post-processing for a single AI feature.
/// Handlers are discovered via IEnumerable&lt;IAiFeatureHandler&gt; injection.
/// </summary>
public interface IAiFeatureHandler
{
    /// <summary>
    /// Unique feature identifier, e.g. "invoice-extraction", "smart-fields", "cost-prediction".
    /// </summary>
    string FeatureName { get; }

    /// <summary>
    /// The AI capability required for this feature (used for provider selection).
    /// </summary>
    AiCapability RequiredCapability { get; }

    /// <summary>
    /// Execute the feature-specific AI operation.
    /// </summary>
    Task<Result<AiFeatureResult>> ExecuteAsync(AiFeatureRequest request, CancellationToken ct);
}
