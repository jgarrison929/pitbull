using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Pitbull.Core.CQRS;

namespace Pitbull.AI.Providers;

public class OpenAiProvider(IHttpClientFactory httpClientFactory) : IAiProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public string Name => "openai";
    public IReadOnlySet<AiCapability> Capabilities => new HashSet<AiCapability>
    {
        AiCapability.TextGeneration,
        AiCapability.Embedding,
        AiCapability.CodeGeneration
    };

    public async Task<Result<AiCompletionResult>> CompleteAsync(
        AiCompletionRequest request,
        string apiKey,
        CancellationToken ct = default)
    {
        var client = httpClientFactory.CreateClient("OpenAI");
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "v1/chat/completions");
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var payload = new
        {
            model = request.ModelOverride ?? "gpt-4o",
            temperature = request.Temperature,
            max_tokens = request.MaxTokens,
            messages = new object[]
            {
                new { role = "system", content = request.SystemPrompt },
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
            return Result.Failure<AiCompletionResult>($"OpenAI request failed ({(int)response.StatusCode})", "AI_PROVIDER_ERROR");

        try
        {
            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;

            var content = root.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
            var model = root.GetProperty("model").GetString() ?? "gpt-4o";
            var usage = root.TryGetProperty("usage", out var usageElement) ? usageElement : default;
            var inputTokens = usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty("prompt_tokens", out var prompt) ? prompt.GetInt32() : 0;
            var outputTokens = usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty("completion_tokens", out var completion) ? completion.GetInt32() : 0;

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
            return Result.Failure<AiCompletionResult>("OpenAI response parsing failed", "AI_PROVIDER_PARSE_ERROR");
        }
    }
}
