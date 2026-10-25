using System.Reflection;

namespace Pitbull.Api.Services;

public interface IChangelogService
{
    ChangelogResponse GetChangelog(
        string? versionFilter = null,
        bool currentOnly = false,
        int? limit = null,
        int offset = 0,
        bool excludeUnreleased = false);
    string GetAppVersion();
}

public sealed class ChangelogService(IWebHostEnvironment env, ILogger<ChangelogService> logger) : IChangelogService
{
    public const int MaxPageSize = 50;

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

    public ChangelogResponse GetChangelog(
        string? versionFilter = null,
        bool currentOnly = false,
        int? limit = null,
        int offset = 0,
        bool excludeUnreleased = false)
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
            // Cap filter length to avoid pathological string compares / allocations.
            var filter = versionFilter.Trim();
            if (filter.Length > 50)
                filter = filter[..50];
            var match = ChangelogParser.FindRelease(releases, filter);
            query = match is null ? [] : [match];
        }
        else if (excludeUnreleased)
        {
            query = query.Where(r =>
                !string.Equals(r.Version, "Unreleased", StringComparison.OrdinalIgnoreCase));
        }

        // Materialize filtered set so TotalCount is accurate before Skip/Take.
        var filtered = query as IList<ChangelogRelease> ?? query.ToList();
        var totalCount = filtered.Count;

        var safeOffset = Math.Max(0, offset);
        if (safeOffset > 0)
            filtered = filtered.Skip(safeOffset).ToList();

        int? appliedLimit = null;
        if (limit is > 0)
        {
            appliedLimit = Math.Min(limit.Value, MaxPageSize);
            filtered = filtered.Take(appliedLimit.Value).ToList();
        }

        return new ChangelogResponse(
            AppVersion: appVersion,
            SourcePath: _sourcePath is null ? null : Path.GetFileName(_sourcePath),
            Releases: filtered.Select(ChangelogMapping.ToDto).ToList(),
            TotalCount: totalCount,
            Offset: safeOffset,
            Limit: appliedLimit);
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
