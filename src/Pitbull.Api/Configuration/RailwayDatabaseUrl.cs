using Npgsql;

namespace Pitbull.Api.Configuration;

/// <summary>
/// Normalizes Railway/Heroku DATABASE_URL values for Npgsql.
/// </summary>
public static class RailwayDatabaseUrl
{
    public static string Normalize(string? databaseUrl)
    {
        if (string.IsNullOrWhiteSpace(databaseUrl))
            return string.Empty;

        if (!databaseUrl.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !databaseUrl.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return databaseUrl;
        }

        // Repair truncated sslmode query params seen from some Railway templates.
        if (databaseUrl.EndsWith("?sslmode", StringComparison.OrdinalIgnoreCase) ||
            databaseUrl.EndsWith("&sslmode", StringComparison.OrdinalIgnoreCase))
        {
            databaseUrl += "=require";
        }

        var builder = new NpgsqlConnectionStringBuilder(databaseUrl);

        // Private Railway networking does not use TLS between services.
        if (builder.Host?.Contains("railway.internal", StringComparison.OrdinalIgnoreCase) == true)
            builder.SslMode = SslMode.Disable;
        else if (builder.SslMode == SslMode.Prefer)
            builder.SslMode = SslMode.Require;

        return builder.ConnectionString;
    }
}