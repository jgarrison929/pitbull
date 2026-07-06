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

        // NpgsqlConnectionStringBuilder does not accept postgresql:// URIs — parse manually.
        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty
        };

        // Private Railway networking does not use TLS between services.
        if (builder.Host.Contains("railway.internal", StringComparison.OrdinalIgnoreCase))
            builder.SslMode = SslMode.Disable;
        else
            builder.SslMode = SslMode.Require;

        return builder.ConnectionString;
    }
}