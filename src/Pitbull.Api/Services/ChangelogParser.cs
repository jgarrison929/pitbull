using System.Text.RegularExpressions;

namespace Pitbull.Api.Services;

/// <summary>
/// Parses Keep a Changelog markdown into structured release notes.
/// </summary>
public static partial class ChangelogParser
{
    private static readonly Regex VersionHeader = VersionHeaderRegex();
    private static readonly Regex SectionHeader = SectionHeaderRegex();

    public static IReadOnlyList<ChangelogRelease> Parse(string markdown)
    {
        if (string.IsNullOrWhiteSpace(markdown))
            return [];

        var releases = new List<ChangelogRelease>();
        string? currentVersion = null;
        string? currentDate = null;
        string? currentSection = null;
        var sections = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        void Flush()
        {
            if (currentVersion is null)
                return;

            releases.Add(new ChangelogRelease(
                Version: currentVersion,
                Date: currentDate,
                Sections: sections.ToDictionary(
                    kv => kv.Key,
                    kv => (IReadOnlyList<string>)kv.Value.AsReadOnly(),
                    StringComparer.OrdinalIgnoreCase)));
        }

        foreach (var rawLine in markdown.Split('\n'))
        {
            var line = rawLine.TrimEnd('\r');

            var versionMatch = VersionHeader.Match(line);
            if (versionMatch.Success)
            {
                Flush();
                currentVersion = versionMatch.Groups["version"].Value.Trim();
                currentDate = versionMatch.Groups["date"].Success && versionMatch.Groups["date"].Length > 0
                    ? versionMatch.Groups["date"].Value.Trim()
                    : null;
                currentSection = null;
                sections = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
                continue;
            }

            if (currentVersion is null)
                continue;

            var sectionMatch = SectionHeader.Match(line);
            if (sectionMatch.Success)
            {
                currentSection = sectionMatch.Groups["name"].Value.Trim();
                if (!sections.ContainsKey(currentSection))
                    sections[currentSection] = [];
                continue;
            }

            if (currentSection is null)
                continue;

            var trimmed = line.TrimStart();
            if (trimmed.StartsWith("- ", StringComparison.Ordinal) ||
                trimmed.StartsWith("* ", StringComparison.Ordinal))
            {
                var item = trimmed[2..].Trim();
                if (item.Length > 0)
                    sections[currentSection].Add(item);
            }
        }

        Flush();
        return releases;
    }

    /// <summary>
    /// Resolves CHANGELOG.md near the running app (output dir, content root, or repo root).
    /// </summary>
    public static string? FindChangelogPath(string? contentRootPath = null, string? baseDirectory = null)
    {
        var candidates = new List<string>();

        void Add(string? dir)
        {
            if (string.IsNullOrWhiteSpace(dir))
                return;
            candidates.Add(Path.Combine(dir, "CHANGELOG.md"));
        }

        Add(baseDirectory ?? AppContext.BaseDirectory);
        Add(contentRootPath);

        // Walk up from content root / base directory looking for repo-root CHANGELOG.md
        foreach (var start in new[] { contentRootPath, baseDirectory ?? AppContext.BaseDirectory })
        {
            if (string.IsNullOrWhiteSpace(start))
                continue;

            var dir = new DirectoryInfo(start);
            for (var i = 0; i < 6 && dir is not null; i++)
            {
                candidates.Add(Path.Combine(dir.FullName, "CHANGELOG.md"));
                dir = dir.Parent;
            }
        }

        return candidates
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(File.Exists);
    }

    public static string NormalizeVersion(string version) =>
        version.Trim().TrimStart('v', 'V');

    public static ChangelogRelease? FindRelease(
        IReadOnlyList<ChangelogRelease> releases,
        string version)
    {
        var target = NormalizeVersion(version);
        return releases.FirstOrDefault(r =>
            string.Equals(NormalizeVersion(r.Version), target, StringComparison.OrdinalIgnoreCase));
    }

    [GeneratedRegex(
        @"^##\s+\[(?<version>[^\]]+)\](?:\s*-\s*(?<date>\d{4}-\d{2}-\d{2}))?\s*$",
        RegexOptions.Compiled)]
    private static partial Regex VersionHeaderRegex();

    [GeneratedRegex(@"^###\s+(?<name>.+?)\s*$", RegexOptions.Compiled)]
    private static partial Regex SectionHeaderRegex();
}

public sealed record ChangelogRelease(
    string Version,
    string? Date,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Sections);

public sealed record ChangelogResponse(
    string? AppVersion,
    string? SourcePath,
    IReadOnlyList<ChangelogReleaseDto> Releases);

public sealed record ChangelogReleaseDto(
    string Version,
    string? Date,
    IReadOnlyList<string> Added,
    IReadOnlyList<string> Changed,
    IReadOnlyList<string> Fixed,
    IReadOnlyList<string> Security,
    IReadOnlyList<string> Removed,
    IReadOnlyList<string> Deprecated);

public static class ChangelogMapping
{
    public static ChangelogReleaseDto ToDto(ChangelogRelease release)
    {
        static IReadOnlyList<string> Get(IReadOnlyDictionary<string, IReadOnlyList<string>> sections, string key) =>
            sections.TryGetValue(key, out var items) ? items : Array.Empty<string>();

        return new ChangelogReleaseDto(
            Version: release.Version,
            Date: release.Date,
            Added: Get(release.Sections, "Added"),
            Changed: Get(release.Sections, "Changed"),
            Fixed: Get(release.Sections, "Fixed"),
            Security: Get(release.Sections, "Security"),
            Removed: Get(release.Sections, "Removed"),
            Deprecated: Get(release.Sections, "Deprecated"));
    }
}
