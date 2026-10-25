using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Pitbull.Core.CQRS;

namespace Pitbull.AI.Providers;

public class AnthropicProvider(IHttpClientFactory httpClientFactory) : IAiProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public string Name => "anthropic";
    public IReadOnlySet<AiCapability> Capabilities => new HashSet<AiCapability>
    {
        AiCapability.Analysis,
        AiCapability.DocumentUnderstanding,
        AiCapability.TextGeneration
    };

    public async Task<Result<AiCompletionResult>> CompleteAsync(
        AiCompletionRequest request,
        string apiKey,
        CancellationToken ct = default)
    {
        var client = httpClientFactory.CreateClient("Anthropic");
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "v1/messages");
        httpRequest.Headers.Add("x-api-key", apiKey);
        httpRequest.Headers.Add("anthropic-version", "2023-06-01");

        var payload = new
        {
            model = request.ModelOverride ?? "claude-sonnet-4-20250514",
            max_tokens = request.MaxTokens,
            system = request.SystemPrompt,
            messages = new object[]
            {
                new { role = "user", content = request.UserPrompt }
            }
        };

        httpRequest.Content = new StringContent(
            JsonSerializer.Serialize(payload, JsonOptions),
            Encoding.UTF8,
            "application/json");

        var stopwatch = Stopwatch.StartNew();
        using var response = await client.SendAsync(httpRequest, ct);
        var responseBody = await response.Content.ReadAsStringAsync(ct);
        stopwatch.Stop();

        if (!response.IsSuccessStatusCode)
            return Result.Failure<AiCompletionResult>($"Anthropic request failed ({(int)response.StatusCode})", "AI_PROVIDER_ERROR");

        try
        {
            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;

            var model = root.GetProperty("model").GetString() ?? "claude-sonnet-4-20250514";
            var contentItems = root.GetProperty("content");
            var content = contentItems.GetArrayLength() > 0
                ? contentItems[0].GetProperty("text").GetString() ?? string.Empty
                : string.Empty;

            var usage = root.TryGetProperty("usage", out var usageElement) ? usageElement : default;
            var inputTokens = usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty("input_tokens", out var input) ? input.GetInt32() : 0;
            var outputTokens = usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty("output_tokens", out var output) ? output.GetInt32() : 0;

            return Result.Success(new AiCompletionResult(
                Content: content,
                InputTokens: inputTokens,
                OutputTokens: outputTokens,
                Model: model,
                Provider: Name,
                Latency: stopwatch.Elapsed));
        }
        catch
        {
            return Result.Failure<AiCompletionResult>("Anthropic response parsing failed", "AI_PROVIDER_PARSE_ERROR");
        }
    }
}
