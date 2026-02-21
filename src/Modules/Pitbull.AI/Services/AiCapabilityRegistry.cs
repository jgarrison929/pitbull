using Pitbull.AI.Providers;

namespace Pitbull.AI.Services;

/// <summary>
/// Maps feature names to required AI capabilities and preferred providers.
/// Used by the orchestrator for provider selection.
/// </summary>
public static class AiCapabilityRegistry
{
    public static readonly IReadOnlyDictionary<string, AiCapability> FeatureCapabilities =
        new Dictionary<string, AiCapability>(StringComparer.OrdinalIgnoreCase)
        {
            ["invoice-extraction"] = AiCapability.DocumentUnderstanding,
            ["smart-fields"] = AiCapability.Analysis,
            ["cost-prediction"] = AiCapability.Analysis,
            ["chat"] = AiCapability.TextGeneration,
            ["document-summary"] = AiCapability.TextGeneration,
            ["submittal-review"] = AiCapability.Analysis,
        };

    public static readonly IReadOnlyDictionary<AiCapability, string> PreferredProviders =
        new Dictionary<AiCapability, string>
        {
            [AiCapability.Analysis] = "anthropic",
            [AiCapability.DocumentUnderstanding] = "anthropic",
            [AiCapability.TextGeneration] = "openai",
            [AiCapability.Embedding] = "openai",
            [AiCapability.CodeGeneration] = "openai",
        };
}
