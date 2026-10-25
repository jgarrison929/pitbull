using FluentAssertions;

namespace Pitbull.Tests.Unit.Docs;

/// <summary>
/// Structural gates for the financial-math / WIP remediation arc and continuous review workflow.
/// </summary>
public class FinancialMathArcDocsTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 12 && dir is not null; i++)
        {
            var changelog = Path.Combine(dir.FullName, "CHANGELOG.md");
            var docs = Path.Combine(dir.FullName, "docs");
            if (File.Exists(changelog) && Directory.Exists(docs))
                return dir.FullName;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException(
            "Could not locate repo root (CHANGELOG.md + docs/) from " + AppContext.BaseDirectory);
    }

    private static string Read(string relativePath)
    {
        var full = Path.Combine(RepoRoot(), relativePath.Replace('/', Path.DirectorySeparatorChar));
        File.Exists(full).Should().BeTrue($"required file missing: {relativePath}");
        return File.ReadAllText(full);
    }

    [Fact]
    public void Financial_math_arc_doc_exists_with_inventory_seed_and_ladder()
    {
        var arc = Read("docs/roadmap/financial-math-wip-arc.md");

        arc.Should().Contain("WipCalculationService");
        arc.Should().Contain("CreateWipReports");
        arc.Should().MatchRegex("(?i)seed");
        arc.Should().MatchRegex("(?i)plan.*implement|ladder|B1|B2");
        arc.Should().Contain("PercentComplete");
        // Ordered remediation steps present
        arc.Should().Contain("B0");
        arc.Should().Contain("B1");
        arc.Should().Contain("B7");
        // B0 billed double-count inventory must stay documented
        arc.Should().MatchRegex("(?i)double.?count|latest.*ApplicationNumber|BilledToDate");
    }

    [Fact]
    public void Continuous_review_workflow_exists_without_user_stop_gates()
    {
        var script = Read(".grok/workflows/financial-math-review.rhai");

        script.Should().Contain("financial-math-review");
        script.Should().Contain("WipCalculationService");
        // No human stop gates between rounds (goal: continuous loop).
        script.Should().NotMatchRegex(@"\bpause\s*\(");
        script.Should().NotMatchRegex(@"\bawait_user\s*\(");
        script.Should().Contain("complete(");
        script.Should().Contain("parallel(");
    }

    [Fact]
    public void Seed_wip_source_uses_percent_points_scale_documented_as_risk()
    {
        // Prove the seed source still stores 0–100 style completion (arc M1) so the arc is not aspirational.
        var seed = Read("src/Pitbull.Api/Features/SeedData/SeedDataService.cs");
        seed.Should().Contain("CreateWipReports");
        seed.Should().Contain("clampedPct");
        seed.Should().Contain("99.999999");
        // Fabricated billed path (not BillingApplication sum)
        seed.Should().MatchRegex("billedToDate\\s*=\\s*earnedRevenue");
    }

    [Fact]
    public void Wip_ui_formatPercent_multiplies_by_100()
    {
        var ui = Read("src/Pitbull.Web/pitbull-web/src/app/(dashboard)/accounting/wip/[id]/page.tsx");
        ui.Should().Contain("function formatPercent");
        ui.Should().MatchRegex(@"value\s*\*\s*100");
    }
}
