using FluentAssertions;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;

namespace Pitbull.Tests.Unit.Modules.AI;

public class AiCapabilityRegistryTests
{
    [Theory]
    [InlineData("invoice-extraction", AiCapability.DocumentUnderstanding)]
    [InlineData("smart-fields", AiCapability.Analysis)]
    [InlineData("cost-prediction", AiCapability.Analysis)]
    [InlineData("chat", AiCapability.TextGeneration)]
    [InlineData("document-summary", AiCapability.TextGeneration)]
    [InlineData("submittal-review", AiCapability.Analysis)]
    public void FeatureCapabilities_MapsFeatureToCorrectCapability(string feature, AiCapability expected)
    {
        AiCapabilityRegistry.FeatureCapabilities.Should().ContainKey(feature);
        AiCapabilityRegistry.FeatureCapabilities[feature].Should().Be(expected);
    }

    [Fact]
    public void FeatureCapabilities_IsCaseInsensitive()
    {
        AiCapabilityRegistry.FeatureCapabilities.Should().ContainKey("INVOICE-EXTRACTION");
        AiCapabilityRegistry.FeatureCapabilities.Should().ContainKey("Invoice-Extraction");
    }

    [Theory]
    [InlineData(AiCapability.Analysis, "anthropic")]
    [InlineData(AiCapability.DocumentUnderstanding, "anthropic")]
    [InlineData(AiCapability.TextGeneration, "openai")]
    [InlineData(AiCapability.Embedding, "openai")]
    [InlineData(AiCapability.CodeGeneration, "openai")]
    public void PreferredProviders_MapsCapabilityToCorrectProvider(AiCapability capability, string expected)
    {
        AiCapabilityRegistry.PreferredProviders.Should().ContainKey(capability);
        AiCapabilityRegistry.PreferredProviders[capability].Should().Be(expected);
    }

    [Fact]
    public void PreferredProviders_CoversAllCapabilities()
    {
        var allCapabilities = Enum.GetValues<AiCapability>();
        foreach (var capability in allCapabilities)
        {
            AiCapabilityRegistry.PreferredProviders.Should().ContainKey(capability,
                $"capability {capability} should have a preferred provider");
        }
    }
}
