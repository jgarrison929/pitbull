using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Core.CQRS;

namespace Pitbull.Tests.Unit.Modules.AI;

public class AiOrchestratorTests
{
    private readonly Mock<IAiUsageService> _usageService = new();
    private readonly Mock<ILogger<AiOrchestrator>> _logger = new();

    [Fact]
    public async Task ExecuteFeatureAsync_RoutesToCorrectHandler()
    {
        var handler1 = CreateMockHandler("invoice-extraction", AiCapability.DocumentUnderstanding);
        var handler2 = CreateMockHandler("smart-fields", AiCapability.Analysis);

        var orchestrator = new AiOrchestrator(
            [handler1.Object, handler2.Object],
            _usageService.Object,
            _logger.Object);

        var request = new AiFeatureRequest(Guid.NewGuid(), "test input");
        await orchestrator.ExecuteFeatureAsync("invoice-extraction", request, CancellationToken.None);

        handler1.Verify(h => h.ExecuteAsync(request, It.IsAny<CancellationToken>()), Times.Once);
        handler2.Verify(h => h.ExecuteAsync(It.IsAny<AiFeatureRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteFeatureAsync_ReturnsFailure_ForUnknownFeature()
    {
        var handler = CreateMockHandler("invoice-extraction", AiCapability.DocumentUnderstanding);
        var orchestrator = new AiOrchestrator(
            [handler.Object],
            _usageService.Object,
            _logger.Object);

        var result = await orchestrator.ExecuteFeatureAsync(
            "unknown-feature",
            new AiFeatureRequest(Guid.NewGuid(), "test"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("FEATURE_NOT_FOUND");
        result.Error.Should().Contain("unknown-feature");
        result.Error.Should().Contain("invoice-extraction");
    }

    [Fact]
    public async Task ExecuteFeatureAsync_IsCaseInsensitive()
    {
        var handler = CreateMockHandler("Invoice-Extraction", AiCapability.DocumentUnderstanding);
        var orchestrator = new AiOrchestrator(
            [handler.Object],
            _usageService.Object,
            _logger.Object);

        var request = new AiFeatureRequest(Guid.NewGuid(), "test");
        var result = await orchestrator.ExecuteFeatureAsync("INVOICE-EXTRACTION", request, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        handler.Verify(h => h.ExecuteAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteFeatureAsync_LogsUsage_OnSuccess()
    {
        var handler = CreateMockHandler("smart-fields", AiCapability.Analysis);
        var orchestrator = new AiOrchestrator(
            [handler.Object],
            _usageService.Object,
            _logger.Object);

        await orchestrator.ExecuteFeatureAsync(
            "smart-fields",
            new AiFeatureRequest(Guid.NewGuid(), "test"),
            CancellationToken.None);

        _usageService.Verify(u => u.LogUsageAsync(
            It.IsAny<Guid>(),
            "test-provider",
            "test-model",
            It.IsAny<int>(),
            It.IsAny<int>(),
            It.IsAny<decimal>(),
            "smart-fields",
            It.IsAny<int>(),
            0.85m,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteFeatureAsync_DoesNotLogUsage_OnFailure()
    {
        var handler = new Mock<IAiFeatureHandler>();
        handler.Setup(h => h.FeatureName).Returns("failing-feature");
        handler.Setup(h => h.RequiredCapability).Returns(AiCapability.Analysis);
        handler.Setup(h => h.ExecuteAsync(It.IsAny<AiFeatureRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<AiFeatureResult>("error", "ERROR"));

        var orchestrator = new AiOrchestrator(
            [handler.Object],
            _usageService.Object,
            _logger.Object);

        await orchestrator.ExecuteFeatureAsync(
            "failing-feature",
            new AiFeatureRequest(Guid.NewGuid(), "test"),
            CancellationToken.None);

        _usageService.Verify(u => u.LogUsageAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int>(), It.IsAny<int>(), It.IsAny<decimal>(),
            It.IsAny<string>(), It.IsAny<int>(), It.IsAny<decimal>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteFeatureAsync_HandlesHandlerException_Gracefully()
    {
        var handler = new Mock<IAiFeatureHandler>();
        handler.Setup(h => h.FeatureName).Returns("throwing-feature");
        handler.Setup(h => h.RequiredCapability).Returns(AiCapability.Analysis);
        handler.Setup(h => h.ExecuteAsync(It.IsAny<AiFeatureRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Something went wrong"));

        var orchestrator = new AiOrchestrator(
            [handler.Object],
            _usageService.Object,
            _logger.Object);

        var result = await orchestrator.ExecuteFeatureAsync(
            "throwing-feature",
            new AiFeatureRequest(Guid.NewGuid(), "test"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("FEATURE_HANDLER_ERROR");
        result.Error.Should().Contain("Something went wrong");
    }

    [Fact]
    public async Task ExecuteFeatureAsync_PropagatesCancellation()
    {
        var handler = new Mock<IAiFeatureHandler>();
        handler.Setup(h => h.FeatureName).Returns("cancellable");
        handler.Setup(h => h.RequiredCapability).Returns(AiCapability.Analysis);
        handler.Setup(h => h.ExecuteAsync(It.IsAny<AiFeatureRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException());

        var orchestrator = new AiOrchestrator(
            [handler.Object],
            _usageService.Object,
            _logger.Object);

        await Assert.ThrowsAsync<OperationCanceledException>(() =>
            orchestrator.ExecuteFeatureAsync(
                "cancellable",
                new AiFeatureRequest(Guid.NewGuid(), "test"),
                CancellationToken.None));
    }

    [Fact]
    public void GetRegisteredFeatures_ReturnsAllHandlerNames()
    {
        var handler1 = CreateMockHandler("invoice-extraction", AiCapability.DocumentUnderstanding);
        var handler2 = CreateMockHandler("smart-fields", AiCapability.Analysis);
        var handler3 = CreateMockHandler("cost-prediction", AiCapability.Analysis);

        var orchestrator = new AiOrchestrator(
            [handler1.Object, handler2.Object, handler3.Object],
            _usageService.Object,
            _logger.Object);

        var features = orchestrator.GetRegisteredFeatures();

        features.Should().HaveCount(3);
        features.Should().Contain("invoice-extraction");
        features.Should().Contain("smart-fields");
        features.Should().Contain("cost-prediction");
    }

    [Fact]
    public void GetRegisteredFeatures_ReturnsEmptyList_WhenNoHandlers()
    {
        var orchestrator = new AiOrchestrator(
            [],
            _usageService.Object,
            _logger.Object);

        orchestrator.GetRegisteredFeatures().Should().BeEmpty();
    }

    [Fact]
    public async Task ExecuteFeatureAsync_ReturnsHandlerResult_OnSuccess()
    {
        var handler = CreateMockHandler("invoice-extraction", AiCapability.DocumentUnderstanding);
        var orchestrator = new AiOrchestrator(
            [handler.Object],
            _usageService.Object,
            _logger.Object);

        var result = await orchestrator.ExecuteFeatureAsync(
            "invoice-extraction",
            new AiFeatureRequest(Guid.NewGuid(), "invoice text"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Content.Should().Be("test content");
        result.Value.Provider.Should().Be("test-provider");
        result.Value.Model.Should().Be("test-model");
        result.Value.ConfidenceScore.Should().Be(0.85m);
    }

    private static Mock<IAiFeatureHandler> CreateMockHandler(string featureName, AiCapability capability)
    {
        var handler = new Mock<IAiFeatureHandler>();
        handler.Setup(h => h.FeatureName).Returns(featureName);
        handler.Setup(h => h.RequiredCapability).Returns(capability);
        handler.Setup(h => h.ExecuteAsync(It.IsAny<AiFeatureRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(new AiFeatureResult(
                Content: "test content",
                ConfidenceScore: 0.85m,
                Provider: "test-provider",
                Model: "test-model",
                LatencyMs: 100)));
        return handler;
    }
}
