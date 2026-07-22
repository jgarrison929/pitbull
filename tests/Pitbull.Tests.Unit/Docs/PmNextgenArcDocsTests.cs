using FluentAssertions;

namespace Pitbull.Tests.Unit.Docs;

/// <summary>
/// Structural gates for the PM next-gen program docs (3.4 → 4.0.0).
/// Reads real files from the git repo root (CHANGELOG.md + docs/ present).
/// </summary>
public class PmNextgenArcDocsTests
{
    /// <summary>
    /// Walk up from the test output directory until we hit the repository root.
    /// Requires both CHANGELOG.md and docs/ so we do not stop at bin/ Debug copies of CHANGELOG only.
    /// </summary>
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
        File.Exists(full).Should().BeTrue($"required program file missing: {relativePath}");
        return File.ReadAllText(full);
    }

    public static TheoryData<string> RequiredProgramFiles => new()
    {
        "docs/roadmap/pm-nextgen-3.4-to-4.0.md",
        "docs/roadmap/pm-mobile-workflows-and-complaints-2026.md",
        "docs/340-pm-arc/README.md",
        "docs/340-pm-arc/VERSION-WORKFLOW.md",
        "docs/340-pm-arc/goal-prompts.md",
        "docs/specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md",
        "docs/specs/product-bands/band-3.6-pm-co-contracts-mobile.md",
        "docs/specs/product-bands/band-3.7-pm-schedule-gantt-kanban.md",
        "docs/specs/product-bands/band-3.8-pm-cpm-practices.md",
        "docs/specs/product-bands/band-3.9-pm-safety-compliance.md",
        "docs/specs/product-bands/band-3.10-pm-vendors-procurement-materials.md",
        "docs/specs/product-bands/band-3.11-pm-sub-payapps-quotes.md",
        "docs/specs/product-bands/band-3.12-pm-hub-polish.md",
        "docs/specs/product-bands/band-3.12-runway-and-4.0.0.md",
        "docs/ci/pm-arc-deploy-safety.md",
        "docs/ci/pm-3.5-rfi-submittal-notes.md",
    };

    [Theory]
    [MemberData(nameof(RequiredProgramFiles))]
    public void Required_pm_arc_doc_exists(string relativePath)
    {
        var full = Path.Combine(RepoRoot(), relativePath.Replace('/', Path.DirectorySeparatorChar));
        File.Exists(full).Should().BeTrue(relativePath);
    }

    [Fact]
    public void Epic_lists_all_objective_domains_and_mobile_mandate()
    {
        var epic = Read("docs/roadmap/pm-nextgen-3.4-to-4.0.md");

        // Mobile mandate
        epic.Should().MatchRegex("(?i)mobile-friendly");
        epic.Should().Contain("3.4.0");
        epic.Should().Contain("4.0.0");
        epic.Should().MatchRegex("(?i)one version.*one PR|one PR.*one VERSION");

        // OBJECTIVE domains — none silently omitted
        string[] domains =
        [
            "Submittals",
            "RFIs",
            "Vendors",
            "Compliance",
            "Gantt",
            "Kanban",
            "CPM",
            "Safety",
            "Contract",
            "Change Order",
            "Pay App",
            "Estimates",
            "Quotes",
            "Procurement",
            "Material",
        ];

        foreach (var d in domains)
            epic.Should().MatchRegex($"(?i){RegexEscape(d)}", because: $"epic must name domain '{d}'");
    }

    [Fact]
    public void Epic_ladder_has_ordered_bands_not_single_blob()
    {
        var epic = Read("docs/roadmap/pm-nextgen-3.4-to-4.0.md");
        epic.Should().Contain("3.4.1");
        epic.Should().Contain("3.5.0");
        epic.Should().Contain("3.12.9");
        epic.Should().MatchRegex(@"(?i)\*\*3\.5\*\*|Band 3\.5");
        epic.Should().MatchRegex(@"(?i)\*\*3\.11\*\*|Band 3\.11");
        epic.Should().MatchRegex("(?i)preflight");
        epic.Should().MatchRegex("(?i)Railway|deploy safety");
    }

    [Fact]
    public void First_band_is_agent_ready()
    {
        var band = Read("docs/specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md");

        band.Should().Contain("**Status:** Pending");
        band.Should().Contain("## Problem");
        band.Should().Contain("## Personas");
        band.Should().Contain("## Version table");
        band.Should().Contain("**3.4.1**");
        band.Should().Contain("**3.5.0**");
        band.Should().Contain("- [ ]");
        band.Should().Contain("## Test plan");
        band.Should().Contain("## Help center");
        band.Should().Contain("## Truth rules");
        band.Should().Contain("## Non-goals");
        band.Should().Contain("## Band DoD");
        band.Should().MatchRegex("(?i)preflight|VERSION");
        band.Should().Contain("Mobile complaint drivers");
        band.Should().MatchRegex("(?i)390px|overdue");
        band.Should().NotMatchRegex("(?i)portfolio health score as a product KPI");
    }

    [Fact]
    public void Research_note_has_workflows_complaints_and_band_map()
    {
        var research = Read("docs/roadmap/pm-mobile-workflows-and-complaints-2026.md");

        research.Should().MatchRegex("(?i)RFI");
        research.Should().MatchRegex("(?i)Submittal");
        research.Should().MatchRegex("(?i)Schedule|Gantt|CPM");
        research.Should().MatchRegex("(?i)pay app|G702");
        research.Should().MatchRegex("(?i)compliance|insurance");
        research.Should().MatchRegex("(?i)offline");
        research.Should().Contain("https://");
        research.Should().MatchRegex("(?i)Band 3\\.5|\\*\\*3\\.5\\*\\*");
        research.Should().MatchRegex("(?i)complaint");
        // Truth: must not sell invented health scores as product
        research.Should().MatchRegex("(?i)no invented|not invent|without inventing");
    }

    [Fact]
    public void Epic_links_research_and_complaint_priority()
    {
        var epic = Read("docs/roadmap/pm-nextgen-3.4-to-4.0.md");
        epic.Should().Contain("pm-mobile-workflows-and-complaints-2026.md");
        epic.Should().MatchRegex("(?i)Complaint-driven priority|complaint-driven");
    }

    [Fact]
    public void Stub_bands_include_mobile_complaint_drivers()
    {
        string[] stubs =
        [
            "docs/specs/product-bands/band-3.6-pm-co-contracts-mobile.md",
            "docs/specs/product-bands/band-3.7-pm-schedule-gantt-kanban.md",
            "docs/specs/product-bands/band-3.8-pm-cpm-practices.md",
            "docs/specs/product-bands/band-3.9-pm-safety-compliance.md",
            "docs/specs/product-bands/band-3.10-pm-vendors-procurement-materials.md",
            "docs/specs/product-bands/band-3.11-pm-sub-payapps-quotes.md",
            "docs/specs/product-bands/band-3.12-pm-hub-polish.md",
        ];

        foreach (var path in stubs)
        {
            var text = Read(path);
            text.Should().Contain("Mobile complaint drivers", because: path);
        }
    }

    [Fact]
    public void Deploy_safety_doc_has_concrete_gates()
    {
        var safety = Read("docs/ci/pm-arc-deploy-safety.md");
        safety.Should().Contain("preflight.ps1");
        safety.Should().Contain("VERSION");
        safety.Should().Contain("package.json");
        safety.Should().MatchRegex("(?i)Docker|csproj");
        safety.Should().Contain("CHANGELOG");
    }

    [Fact]
    public void Product_bands_readme_points_at_epic_and_next_stamp()
    {
        var readme = Read("docs/specs/product-bands/README.md");
        readme.Should().Contain("pm-nextgen-3.4-to-4.0.md");
        readme.Should().Contain("3.4.1");
        readme.Should().Contain("band-3.5-pm-rfi-submittal-mobile.md");
        readme.Should().Contain("Pending");
    }

    [Fact]
    public void Changelog_unreleased_mentions_pm_arc_docs()
    {
        var changelog = Read("CHANGELOG.md");
        changelog.Should().Contain("## [Unreleased]");
        changelog.Should().MatchRegex("(?i)PM next-gen|pm-nextgen-3\\.4-to-4\\.0");
    }

    private static string RegexEscape(string s) =>
        System.Text.RegularExpressions.Regex.Escape(s);
}
