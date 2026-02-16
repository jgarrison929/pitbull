using Pitbull.Core.CQRS;

namespace Pitbull.AI.Providers;

public enum AiCapability
{
    TextGeneration,
    Analysis,
    DocumentUnderstanding,
    Embedding,
    CodeGeneration
}

public record AiCompletionRequest(
    string SystemPrompt,
    string UserPrompt,
    AiCapability Capability,
    int MaxTokens = 4096,
    decimal Temperature = 0.3m,
    string? ModelOverride = null
);

public record AiCompletionResult(
    string Content,
    int InputTokens,
    int OutputTokens,
    string Model,
    string Provider,
    TimeSpan Latency
);

public interface IAiProvider
{
    string Name { get; }
    IReadOnlySet<AiCapability> Capabilities { get; }

    Task<Result<AiCompletionResult>> CompleteAsync(
        AiCompletionRequest request,
        string apiKey,
        CancellationToken ct = default);
}
