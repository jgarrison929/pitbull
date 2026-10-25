using FluentAssertions;
using Pitbull.Api.Controllers;

namespace Pitbull.Tests.Unit.Api;

public class VersionControllerTests
{
    private static string TempAssemblyPath()
    {
        var path = Path.Combine(Path.GetTempPath(), $"pitbull-version-test-{Guid.NewGuid():N}.txt");
        File.WriteAllText(path, "x");
        return path;
    }

    [Fact]
    public void Resolve_UsesCommitHashEnv_WhenSet()
    {
        var path = TempAssemblyPath();
        try
        {
            var result = VersionEndpointResolver.Resolve(
                "3.8.1+deadbeef",
                path,
                key => key == "COMMIT_HASH" ? "abc1234" : key == "BUILD_DATE" ? "2026-10-05T12:00:00Z" : null);

            result.Version.Should().Be("3.8.1");
            result.CommitHash.Should().Be("abc1234");
            result.BuildDate.Should().Be("2026-10-05T12:00:00Z");
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void Resolve_FallsBackToRailwaySha_WhenCommitHashUnknown()
    {
        var path = TempAssemblyPath();
        try
        {
            var result = VersionEndpointResolver.Resolve(
                "3.8.1+ignored",
                path,
                key => key switch
                {
                    "COMMIT_HASH" => "unknown",
                    "RAILWAY_GIT_COMMIT_SHA" => "railwaysha99",
                    "BUILD_DATE" => " ",
                    _ => null
                });

            result.CommitHash.Should().Be("railwaysha99");
            // empty/whitespace BUILD_DATE falls back to assembly write time (round-trip ISO)
            result.BuildDate.Should().NotBeNullOrWhiteSpace();
            result.BuildDate.Should().NotBe(" ");
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void Resolve_FallsBackToInformationalVersionSuffix_WhenNoEnv()
    {
        var path = TempAssemblyPath();
        try
        {
            var result = VersionEndpointResolver.Resolve(
                "3.8.1+fromassembly",
                path,
                _ => null);

            result.Version.Should().Be("3.8.1");
            result.CommitHash.Should().Be("fromassembly");
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void Resolve_UsesDev_WhenNoCommitAvailable()
    {
        var path = TempAssemblyPath();
        try
        {
            var result = VersionEndpointResolver.Resolve(
                "3.8.1",
                path,
                key => key == "COMMIT_HASH" ? "unknown" : null);

            result.CommitHash.Should().Be("dev");
        }
        finally
        {
            File.Delete(path);
        }
    }
}
