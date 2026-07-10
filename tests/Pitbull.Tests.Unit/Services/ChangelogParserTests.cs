using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class ChangelogParserTests
{
    private const string Sample = """
        # Changelog

        ## [Unreleased]

        ### Added

        - New feature alpha
        - New feature beta

        ### Fixed

        - Bug one

        ## [2.0.0] - 2026-07-07T10:06:02-07:00

        ### Added

        - **Workflow approvals** — Phase 1 engine

        ### Changed

        - Version bumped to **2.0.0**

        ### Fixed

        - Signup flow

        ### Security

        - Hardened demo admin

        ## [0.15.0] - 2026-05-01

        ### Added

        - Punch list module
        """;

    [Fact]
    public void Parse_ExtractsVersionsAndSections()
    {
        var releases = ChangelogParser.Parse(Sample);

        releases.Should().HaveCount(3);
        releases[0].Version.Should().Be("Unreleased");
        releases[0].Date.Should().BeNull();
        releases[0].Sections["Added"].Should().HaveCount(2);
        releases[0].Sections["Fixed"].Should().ContainSingle().Which.Should().Be("Bug one");

        releases[1].Version.Should().Be("2.0.0");
        releases[1].Date.Should().Be("2026-07-07T10:06:02-07:00");
        releases[1].Sections["Added"].Should().ContainSingle()
            .Which.Should().Contain("Workflow approvals");
        releases[1].Sections["Security"].Should().ContainSingle();

        releases[2].Version.Should().Be("0.15.0");
        releases[2].Date.Should().Be("2026-05-01");
    }

    [Fact]
    public void Parse_AcceptsDateOnlyAndIsoTimestamps()
    {
        var markdown = """
            ## [2.2.1] - 2026-07-10T11:03:00-07:00

            ### Added

            - Timestamps

            ## [2.2.0] - 2026-07-10 09:10:40 UTC

            ### Fixed

            - Deploy

            ## [1.0.0] - 2026-01-15

            ### Added

            - Start
            """;

        var releases = ChangelogParser.Parse(markdown);
        releases.Should().HaveCount(3);
        releases[0].Date.Should().Be("2026-07-10T11:03:00-07:00");
        releases[1].Date.Should().NotBeNullOrWhiteSpace();
        releases[1].Date!.Should().StartWith("2026-07-10T");
        releases[2].Date.Should().Be("2026-01-15");
    }

    [Theory]
    [InlineData("2026-07-10", "2026-07-10")]
    [InlineData("2026-07-10T11:03:00-07:00", "2026-07-10T11:03:00-07:00")]
    public void NormalizePublishedAt_HandlesCommonForms(string input, string expected)
    {
        ChangelogParser.NormalizePublishedAt(input).Should().Be(expected);
    }

    [Fact]
    public void NormalizePublishedAt_UtcSuffix_BecomesOffset()
    {
        var normalized = ChangelogParser.NormalizePublishedAt("2026-07-10 17:18:00 UTC");
        normalized.Should().NotBeNull();
        // Parsed as UTC; offset form may be +00:00
        normalized!.Should().StartWith("2026-07-10T17:18:00");
    }

    [Fact]
    public void FindRelease_MatchesIgnoringVPrefix()
    {
        var releases = ChangelogParser.Parse(Sample);
        var found = ChangelogParser.FindRelease(releases, "v2.0.0");
        found.Should().NotBeNull();
        found!.Version.Should().Be("2.0.0");
    }

    [Fact]
    public void Parse_Empty_ReturnsEmpty()
    {
        ChangelogParser.Parse("").Should().BeEmpty();
        ChangelogParser.Parse("   ").Should().BeEmpty();
    }

    [Fact]
    public void ToDto_MapsKnownSections()
    {
        var release = ChangelogParser.Parse(Sample)[1];
        var dto = ChangelogMapping.ToDto(release);

        dto.Version.Should().Be("2.0.0");
        dto.Date.Should().Be("2026-07-07T10:06:02-07:00");
        dto.Added.Should().NotBeEmpty();
        dto.Changed.Should().NotBeEmpty();
        dto.Fixed.Should().NotBeEmpty();
        dto.Security.Should().NotBeEmpty();
    }

    [Fact]
    public void FindChangelogPath_FindsRepoRootFile()
    {
        // Walk from test output dir (…/bin/Debug/netX/) up to repo root CHANGELOG.md
        var path = ChangelogParser.FindChangelogPath(
            contentRootPath: AppContext.BaseDirectory,
            baseDirectory: AppContext.BaseDirectory);

        path.Should().NotBeNull("CHANGELOG.md must be discoverable by walking up from the test output directory");
        File.Exists(path!).Should().BeTrue();
        Path.GetFileName(path).Should().Be("CHANGELOG.md");
    }

    [Fact]
    public void Parse_RepoChangelog_Includes_2_0_0_And_Unreleased()
    {
        var path = ChangelogParser.FindChangelogPath(
            contentRootPath: AppContext.BaseDirectory,
            baseDirectory: AppContext.BaseDirectory);
        path.Should().NotBeNull();

        var markdown = File.ReadAllText(path!);
        var releases = ChangelogParser.Parse(markdown);

        releases.Should().NotBeEmpty();
        releases.Should().Contain(r =>
            string.Equals(r.Version, "Unreleased", StringComparison.OrdinalIgnoreCase));
        releases.Should().Contain(r =>
            string.Equals(r.Version, "2.0.0", StringComparison.OrdinalIgnoreCase));

        var v2 = ChangelogParser.FindRelease(releases, "2.0.0");
        v2.Should().NotBeNull();
        v2!.Sections.Should().NotBeEmpty();
    }

    [Fact]
    public void ChangelogController_Get_Current_ReturnsOkWithReleasesFromRepoFile()
    {
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.ContentRootPath).Returns(AppContext.BaseDirectory);

        var service = new ChangelogService(env.Object, NullLogger<ChangelogService>.Instance);
        var controller = new ChangelogController(service);

        var result = controller.Get(current: false, limit: 3);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<ChangelogResponse>().Subject;
        body.Releases.Should().NotBeEmpty();
        body.AppVersion.Should().NotBeNullOrWhiteSpace();
        body.Releases[0].Version.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void ChangelogController_Get_VersionFilter_ReturnsMatchingRelease()
    {
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.ContentRootPath).Returns(AppContext.BaseDirectory);

        var service = new ChangelogService(env.Object, NullLogger<ChangelogService>.Instance);
        var controller = new ChangelogController(service);

        var result = controller.Get(version: "2.0.0");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<ChangelogResponse>().Subject;
        body.Releases.Should().ContainSingle();
        body.Releases[0].Version.Should().Be("2.0.0");
        (body.Releases[0].Added.Count
         + body.Releases[0].Changed.Count
         + body.Releases[0].Fixed.Count).Should().BeGreaterThan(0);
    }
}
