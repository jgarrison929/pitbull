using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/version")]
[AllowAnonymous]
[Produces("application/json")]
[Tags("System")]
public class VersionController : ControllerBase
{
    private static readonly Lazy<VersionInfo> _versionInfo = new(() =>
    {
        var assembly = Assembly.GetExecutingAssembly();
        var version = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? assembly.GetName().Version?.ToString()
            ?? "unknown";

        // Strip the +commitHash suffix that dotnet adds from SourceRevisionId
        var plusIndex = version.IndexOf('+');
        var cleanVersion = plusIndex > 0 ? version[..plusIndex] : version;

        var buildDate = Environment.GetEnvironmentVariable("BUILD_DATE")
            ?? System.IO.File.GetLastWriteTimeUtc(assembly.Location).ToString("o");

        var commitHash = Environment.GetEnvironmentVariable("COMMIT_HASH")
            ?? (plusIndex > 0 ? version[(plusIndex + 1)..] : "dev");

        return new VersionInfo(cleanVersion, buildDate, commitHash);
    });

    /// <summary>
    /// Get application version, build date, and commit hash
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(VersionInfo), 200)]
    public IActionResult Get() => Ok(_versionInfo.Value);

    private record VersionInfo(string Version, string BuildDate, string CommitHash);
}
