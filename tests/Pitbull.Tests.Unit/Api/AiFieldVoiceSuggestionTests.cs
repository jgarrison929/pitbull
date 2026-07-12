using Pitbull.Api.Controllers;
using Xunit;

namespace Pitbull.Tests.Unit.Api;

/// <summary>2.19.3 — field voice suggestion scaffold (auth DTO + parse honesty).</summary>
public class AiFieldVoiceSuggestionTests
{
    [Fact]
    public void EmptyScaffold_never_auto_applies()
    {
        var r = FieldVoiceSuggestionResponse.EmptyScaffold("no AI", null, null, 0);
        Assert.False(r.AutoApplied);
        Assert.Equal(FieldVoiceSuggestionResponse.DefaultLabel, r.Label);
        Assert.Contains("review", r.Label, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("", r.WorkNarrative);
    }

    [Fact]
    public void Parse_reads_structured_json()
    {
        var json = """
            {"workNarrative":"Poured level 1 east","delaysNarrative":"","safetyNarrative":"Toolbox talk OK","confidenceNote":"from transcript"}
            """;
        var r = FieldVoiceSuggestionParser.Parse(json, "poured");
        Assert.Equal("Poured level 1 east", r.WorkNarrative);
        Assert.Equal("Toolbox talk OK", r.SafetyNarrative);
        Assert.False(r.AutoApplied);
    }

    [Fact]
    public void Parse_garbage_returns_empty_not_invented_work()
    {
        var r = FieldVoiceSuggestionParser.Parse("not-json at all", "we finished everything 100% green");
        Assert.Equal("", r.WorkNarrative);
        Assert.False(r.AutoApplied);
        Assert.Contains("manually", r.ConfidenceNote, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Construction_jargon_prompt_forbids_invented_costs_and_green()
    {
        var p = FieldVoicePrompts.ConstructionJargonSystemPrompt;
        Assert.Contains("Never invent cost", p, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("pour", p, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("rain day", p, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("always mark complete", p, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("SUGGESTION", p, StringComparison.OrdinalIgnoreCase);
    }
}
