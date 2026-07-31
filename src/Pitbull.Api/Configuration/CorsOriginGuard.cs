namespace Pitbull.Api.Configuration;

/// <summary>
/// Validates browser CORS allowlists for credentialed Production policies.
/// </summary>
public static class CorsOriginGuard
{
    /// <summary>
    /// Normalize configured origins: trim, drop empties, strip trailing slash, de-dupe.
    /// </summary>
    public static string[] Normalize(IEnumerable<string>? origins) =>
        (origins ?? Array.Empty<string>())
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select(o => o.Trim().TrimEnd('/'))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    /// <summary>
    /// Throws when the allowlist is empty outside Development, or contains wildcards.
    /// </summary>
    public static void ValidateForEnvironment(string[] origins, bool isDevelopment)
    {
        if (!isDevelopment && origins.Length == 0)
        {
            throw new InvalidOperationException(
                "Cors:AllowedOrigins must contain at least one origin in non-Development environments.");
        }

        if (origins.Any(o => o == "*" || o.Contains('*', StringComparison.Ordinal)))
        {
            throw new InvalidOperationException(
                "Cors:AllowedOrigins must not use wildcards when credentials are enabled.");
        }
    }
}
