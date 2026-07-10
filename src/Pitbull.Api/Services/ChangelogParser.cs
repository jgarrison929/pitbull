using System.Globalization;
using System.Text.RegularExpressions;

namespace Pitbull.Api.Services;

/// <summary>
/// Parses Keep a Changelog markdown into structured release notes.
/// Version headers may include a date or full published timestamp, e.g.
/// <c>## [2.2.1] - 2026-07-10T11:03:00-07:00</c> or <c>## [2.0.0] - 2026-07-07</c>.
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
                    ? NormalizePublishedAt(versionMatch.Groups["date"].Value)
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

    /// <summary>
    /// Normalizes a Keep a Changelog published stamp to either
    /// <c>yyyy-MM-dd</c> (date-only) or ISO-8601 with offset (date+time).
    /// Accepts space-separated times, trailing <c>UTC</c>, and standard ISO forms.
    /// </summary>
    public static string? NormalizePublishedAt(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var s = raw.Trim();
        // "2026-07-10 17:18:00 UTC" → parseable ISO-ish form
        if (s.EndsWith(" UTC", StringComparison.OrdinalIgnoreCase))
            s = s[..^3].TrimEnd() + "Z";
        s = s.Replace(' ', 'T');

        // Date-only: keep as calendar date (no fake midnight)
        if (Regex.IsMatch(s, @"^\d{4}-\d{2}-\d{2}$"))
            return s;

        if (DateTimeOffset.TryParse(
                s,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind | DateTimeStyles.AllowWhiteSpaces,
                out var dto))
        {
            // Prefer offset form so the UI can show local date+time accurately
            return dto.ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture);
        }

        return raw.Trim();
    }

    public static ChangelogRelease? FindRelease(
        IReadOnlyList<ChangelogRelease> releases,
        string version)
    {
        var target = NormalizeVersion(version);
        return releases.FirstOrDefault(r =>
            string.Equals(NormalizeVersion(r.Version), target, StringComparison.OrdinalIgnoreCase));
    }

    // ## [1.2.3] optional " - " then published stamp (date-only or date+time, any common form)
    [GeneratedRegex(
        @"^##\s+\[(?<version>[^\]]+)\](?:\s*-\s*(?<date>\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}|[ \t]*UTC)?)?))?\s*$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase)]
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
