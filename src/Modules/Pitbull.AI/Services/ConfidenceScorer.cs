using System.Text.RegularExpressions;
using Pitbull.AI.Providers;

namespace Pitbull.AI.Services;

public static partial class ConfidenceScorer
{
    private static readonly string[] HedgingPhrases =
    [
        "i think", "i believe", "possibly", "perhaps", "maybe",
        "not sure", "not certain", "i'm not sure", "i'm not certain",
        "it might", "it could", "it may", "hard to say",
        "i don't have enough", "i cannot determine", "unclear",
        "approximately", "roughly", "i would guess"
    ];

    public static decimal Calculate(AiCompletionRequest request, AiCompletionResult result)
    {
        var score = 1.0m;

        // 1. Truncation penalty: if output tokens >= maxTokens, response was likely cut off
        if (result.OutputTokens >= request.MaxTokens)
        {
            score -= 0.3m;
        }
        else if (result.OutputTokens >= request.MaxTokens * 0.95m)
        {
            score -= 0.15m; // Near-truncation
        }

        // 2. Hedging language penalty
        var contentLower = result.Content.ToLowerInvariant();
        var hedgeCount = HedgingPhrases.Count(phrase => contentLower.Contains(phrase));
        score -= Math.Min(hedgeCount * 0.05m, 0.25m);

        // 3. Very short response to a non-trivial prompt suggests low confidence
        var promptLength = request.UserPrompt.Length + (request.SystemPrompt?.Length ?? 0);
        if (promptLength > 200 && result.Content.Length < 50)
        {
            score -= 0.2m;
        }

        // 4. Empty or near-empty response
        if (string.IsNullOrWhiteSpace(result.Content) || result.Content.Length < 10)
        {
            score -= 0.4m;
        }

        // 5. Error-like patterns in response
        if (ErrorPattern().IsMatch(result.Content))
        {
            score -= 0.2m;
        }

        return Math.Clamp(score, 0m, 1m);
    }

    [GeneratedRegex(@"(?i)(i\s+cannot|i\s+can't|i\s+am\s+unable|sorry,?\s+i|i\s+don't\s+have\s+access)", RegexOptions.Compiled)]
    private static partial Regex ErrorPattern();
}
