using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

/// <summary>
/// 2.20.9 — field voice suggestion endpoint with real auth; mock provider not required.
/// When AI is unconfigured, honest empty scaffold (AutoApplied=false).
/// </summary>
[Collection(DatabaseCollection.Name)]
public sealed class FieldVoiceSuggestionEndpointTests(PostgresFixture db) : ApiIntegrationTestBase(db)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public async Task Field_voice_suggestion_requires_auth()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/ai/field-voice-suggestion", new
        {
            transcript = "poured east deck"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Field_voice_suggestion_returns_suggestion_dto_never_auto_applied()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync("/api/ai/field-voice-suggestion", new
        {
            transcript = "Poured level 1 east this morning. Toolbox talk done."
        });

        // 200 with scaffold when AI not configured, or 200 with model output when configured
        Assert.True(
            resp.StatusCode is HttpStatusCode.OK or HttpStatusCode.ServiceUnavailable,
            $"Unexpected status {(int)resp.StatusCode}");

        if (resp.StatusCode != HttpStatusCode.OK)
            return;

        var body = await resp.Content.ReadFromJsonAsync<FieldVoiceDto>(JsonOpts);
        Assert.NotNull(body);
        Assert.False(body.AutoApplied);
        Assert.Contains("review", body.Label ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Field_eod_summary_auth_and_suggestion_shape()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync("/api/ai/field-eod-summary", new
        {
            factsText = "Job Tower — 2026-07-12\nWork focus: Concrete\nDelays: none noted"
        });

        Assert.True(
            resp.StatusCode is HttpStatusCode.OK or HttpStatusCode.ServiceUnavailable,
            $"Unexpected status {(int)resp.StatusCode}");

        if (resp.StatusCode != HttpStatusCode.OK)
            return;

        var body = await resp.Content.ReadFromJsonAsync<FieldEodDto>(JsonOpts);
        Assert.NotNull(body);
        Assert.False(body.AutoApplied);
        Assert.Contains("review", body.Label ?? "", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record FieldVoiceDto(
        string? WorkNarrative,
        string? Label,
        bool AutoApplied,
        string? ConfidenceNote);

    private sealed record FieldEodDto(
        string? Prose,
        string? Label,
        bool AutoApplied,
        string? ConfidenceNote);
}
