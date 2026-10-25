using FluentAssertions;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;

namespace Pitbull.Tests.Unit.Modules.AI;

public class ConfidenceScorerTests
{
    private static AiCompletionRequest CreateRequest(
        string userPrompt = "What is construction management?",
        string systemPrompt = "You are a helpful assistant.",
        int maxTokens = 4096) =>
        new(systemPrompt, userPrompt, AiCapability.TextGeneration, maxTokens);

    private static AiCompletionResult CreateResult(
        string content = "Construction management involves planning, coordinating, and overseeing construction projects.",
        int outputTokens = 50,
        int inputTokens = 20) =>
        new(content, inputTokens, outputTokens, "test-model", "test-provider", TimeSpan.FromMilliseconds(500));

    #region High Confidence

    [Fact]
    public void Calculate_NormalResponse_ReturnsHighConfidence()
    {
        var request = CreateRequest();
        var result = CreateResult();

        var score = ConfidenceScorer.Calculate(request, result);

        score.Should().BeGreaterThanOrEqualTo(0.8m);
    }

    [Fact]
    public void Calculate_ConfidenceAlwaysBetween0And1()
    {
        var request = CreateRequest();
        var result = CreateResult();

        var score = ConfidenceScorer.Calculate(request, result);

        score.Should().BeInRange(0m, 1m);
    }

    #endregion

    #region Truncation Detection

    [Fact]
    public void Calculate_TruncatedResponse_LowersConfidence()
    {
        var request = CreateRequest(maxTokens: 100);
        var normalResult = CreateResult(outputTokens: 50);
        var truncatedResult = CreateResult(outputTokens: 100);

        var normalScore = ConfidenceScorer.Calculate(request, normalResult);
        var truncatedScore = ConfidenceScorer.Calculate(request, truncatedResult);

        truncatedScore.Should().BeLessThan(normalScore);
    }

    [Fact]
    public void Calculate_NearTruncation_ModeratelyLowersConfidence()
    {
        var request = CreateRequest(maxTokens: 100);
        var nearTruncatedResult = CreateResult(outputTokens: 96); // 96% of max

        var score = ConfidenceScorer.Calculate(request, nearTruncatedResult);

        score.Should().BeLessThan(1m);
        score.Should().BeGreaterThan(0.5m);
    }

    #endregion

    #region Hedging Language

    [Fact]
    public void Calculate_HedgingLanguage_LowersConfidence()
    {
        var request = CreateRequest();
        var confidentResult = CreateResult(
            "Construction management is the planning and oversight of construction projects.");
        var hedgingResult = CreateResult(
            "I think construction management possibly involves maybe planning projects, but I'm not sure about the details.");

        var confidentScore = ConfidenceScorer.Calculate(request, confidentResult);
        var hedgingScore = ConfidenceScorer.Calculate(request, hedgingResult);

        hedgingScore.Should().BeLessThan(confidentScore);
    }

    [Fact]
    public void Calculate_ManyHedgingPhrases_CapsAtMaxPenalty()
    {
        var request = CreateRequest();
        var result = CreateResult(
            "I think maybe possibly I'm not sure perhaps it could be that I believe it might work but I'm not certain and it's unclear.");

        var score = ConfidenceScorer.Calculate(request, result);

        score.Should().BeGreaterThanOrEqualTo(0m);
        score.Should().BeLessThan(0.8m);
    }

    #endregion

    #region Short Response

    [Fact]
    public void Calculate_VeryShortResponseToLongPrompt_LowersConfidence()
    {
        var request = CreateRequest(
            userPrompt: new string('a', 300),
            systemPrompt: "You are an expert construction management assistant with deep knowledge.");
        var shortResult = CreateResult(content: "Yes.", outputTokens: 2);

        var score = ConfidenceScorer.Calculate(request, shortResult);

        score.Should().BeLessThan(0.8m);
    }

    [Fact]
    public void Calculate_EmptyResponse_VeryLowConfidence()
    {
        var request = CreateRequest();
        var emptyResult = CreateResult(content: "", outputTokens: 0);

        var score = ConfidenceScorer.Calculate(request, emptyResult);

        score.Should().BeLessThan(0.8m, "empty response should be penalized");
    }

    #endregion

    #region Error Patterns

    [Fact]
    public void Calculate_RefusalResponse_LowersConfidence()
    {
        var request = CreateRequest();
        var result = CreateResult(
            "I cannot provide specific construction cost estimates without more project details.");

        var normalResult = CreateResult(
            "Construction costs typically range from $100 to $400 per square foot depending on project type.");

        var refusalScore = ConfidenceScorer.Calculate(request, result);
        var normalScore = ConfidenceScorer.Calculate(request, normalResult);

        refusalScore.Should().BeLessThan(normalScore);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Calculate_NeverExceedsOne()
    {
        var request = CreateRequest();
        var result = CreateResult(
            content: "This is a perfectly normal, confident, well-formed response about construction management.",
            outputTokens: 20);

        var score = ConfidenceScorer.Calculate(request, result);

        score.Should().BeLessThanOrEqualTo(1m);
    }

    [Fact]
    public void Calculate_NeverBelowZero()
    {
        var request = CreateRequest(maxTokens: 10);
        var result = CreateResult(
            content: "I think maybe I'm not sure possibly perhaps unclear I cannot I don't have access sorry",
            outputTokens: 10);

        var score = ConfidenceScorer.Calculate(request, result);

        score.Should().BeGreaterThanOrEqualTo(0m);
    }

    #endregion
}
