using System.Reflection;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Resolves product version, build date, and commit hash for <see cref="VersionController"/>.
/// Pure helper so unit tests can pin env / InformationalVersion fallbacks without process-wide Lazy state.
/// </summary>
internal static class VersionEndpointResolver
{
    internal readonly record struct Result(string Version, string BuildDate, string CommitHash);

    internal static Result Resolve(
        string informationalVersion,
        string assemblyLocation,
        Func<string, string?> getEnv)
    {
        var version = string.IsNullOrWhiteSpace(informationalVersion) ? "unknown" : informationalVersion;

        // Strip the +commitHash suffix that dotnet adds from SourceRevisionId
        var plusIndex = version.IndexOf('+');
        var cleanVersion = plusIndex > 0 ? version[..plusIndex] : version;

        // Empty string must not block the fallback (Docker ENV BUILD_DATE= used to).
        var buildDateEnv = getEnv("BUILD_DATE");
        var buildDate = string.IsNullOrWhiteSpace(buildDateEnv)
            ? File.GetLastWriteTimeUtc(assemblyLocation).ToString("o")
            : buildDateEnv;

        // Prefer COMMIT_HASH; then Railway runtime var; then InformationalVersion +suffix; else "dev".
        var commitHashEnv = getEnv("COMMIT_HASH");
        string? commitHash = null;
        if (!string.IsNullOrWhiteSpace(commitHashEnv) &&
            !string.Equals(commitHashEnv, "unknown", StringComparison.OrdinalIgnoreCase))
        {
            commitHash = commitHashEnv;
        }

        commitHash ??= getEnv("RAILWAY_GIT_COMMIT_SHA");
        if (string.IsNullOrWhiteSpace(commitHash) ||
            string.Equals(commitHash, "unknown", StringComparison.OrdinalIgnoreCase))
        {
            commitHash = plusIndex > 0 ? version[(plusIndex + 1)..] : "dev";
        }

        return new Result(cleanVersion, buildDate, commitHash);
    }

    internal static Result ResolveFromAssembly(Assembly assembly, Func<string, string?>? getEnv = null)
    {
        getEnv ??= Environment.GetEnvironmentVariable;
        var version = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? assembly.GetName().Version?.ToString()
            ?? "unknown";
        return Resolve(version, assembly.Location, getEnv);
    }
}
