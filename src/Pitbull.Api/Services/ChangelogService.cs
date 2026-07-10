using System.Reflection;

namespace Pitbull.Api.Services;

public interface IChangelogService
{
    ChangelogResponse GetChangelog(string? versionFilter = null, bool currentOnly = false, int? limit = null);
    string GetAppVersion();
}

public sealed class ChangelogService(IWebHostEnvironment env, ILogger<ChangelogService> logger) : IChangelogService
{
    private readonly object _lock = new();
    private IReadOnlyList<ChangelogRelease>? _cached;
    private string? _sourcePath;

    public string GetAppVersion()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var version = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? assembly.GetName().Version?.ToString()
            ?? "unknown";

        var plusIndex = version.IndexOf('+');
        return plusIndex > 0 ? version[..plusIndex] : version;
    }

    public ChangelogResponse GetChangelog(string? versionFilter = null, bool currentOnly = false, int? limit = null)
    {
        var releases = LoadReleases();
        var appVersion = GetAppVersion();

        IEnumerable<ChangelogRelease> query = releases;

        if (currentOnly)
        {
            var match = ChangelogParser.FindRelease(releases, appVersion)
                        ?? releases.FirstOrDefault(r =>
                            !string.Equals(r.Version, "Unreleased", StringComparison.OrdinalIgnoreCase));
            query = match is null ? [] : [match];
        }
        else if (!string.IsNullOrWhiteSpace(versionFilter))
        {
            var match = ChangelogParser.FindRelease(releases, versionFilter);
            query = match is null ? [] : [match];
        }

        if (limit is > 0)
            query = query.Take(limit.Value);

        return new ChangelogResponse(
            AppVersion: appVersion,
            SourcePath: _sourcePath is null ? null : Path.GetFileName(_sourcePath),
            Releases: query.Select(ChangelogMapping.ToDto).ToList());
    }

    private IReadOnlyList<ChangelogRelease> LoadReleases()
    {
        if (_cached is not null)
            return _cached;

        lock (_lock)
        {
            if (_cached is not null)
                return _cached;

            var path = ChangelogParser.FindChangelogPath(env.ContentRootPath, AppContext.BaseDirectory);
            if (path is null)
            {
                logger.LogWarning("CHANGELOG.md not found near content root or base directory");
                _cached = [];
                return _cached;
            }

            _sourcePath = path;
            var markdown = File.ReadAllText(path);
            _cached = ChangelogParser.Parse(markdown);
            logger.LogInformation("Loaded {Count} changelog releases from {Path}", _cached.Count, path);
            return _cached;
        }
    }
}
