using System.Security.Cryptography;
using System.Text;

namespace Pitbull.Api.Services;

/// <summary>
/// Refresh-token generation and at-rest hashing.
/// Only the SHA-256 hash is stored on <c>AppUser.RefreshToken</c>; the plaintext is returned to the client once.
/// </summary>
public static class RefreshTokenProtector
{
    public const int DefaultRefreshExpirationDays = 7;
    public const int DefaultAccessExpirationMinutes = 60;

    /// <summary>
    /// Generated tokens are Base64 of 64 random bytes (~88 chars). Bounds reject
    /// empty/tiny and multi-KB junk before hashing.
    /// </summary>
    public const int MinPlaintextLength = 40;
    public const int MaxPlaintextLength = 200;

    public static string GeneratePlaintext() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    public static bool IsPlausiblePlaintext(string? plaintext) =>
        !string.IsNullOrEmpty(plaintext)
        && plaintext.Length is >= MinPlaintextLength and <= MaxPlaintextLength;

    public static string Hash(string plaintext)
    {
        ArgumentException.ThrowIfNullOrEmpty(plaintext);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext));
        return Convert.ToBase64String(hash);
    }

    /// <summary>
    /// Constant-time compare of stored hash vs hash of client-provided plaintext.
    /// </summary>
    public static bool Matches(string? storedHash, string? providedPlaintext)
    {
        if (string.IsNullOrEmpty(storedHash) || !IsPlausiblePlaintext(providedPlaintext))
            return false;

        // IsPlausiblePlaintext guarantees non-null/non-empty within length bounds.
        var providedHash = Hash(providedPlaintext!);
        var storedBytes = Encoding.UTF8.GetBytes(storedHash);
        var providedBytes = Encoding.UTF8.GetBytes(providedHash);
        return storedBytes.Length == providedBytes.Length
               && CryptographicOperations.FixedTimeEquals(storedBytes, providedBytes);
    }

    public static int GetRefreshExpirationDays(IConfiguration configuration)
    {
        if (int.TryParse(configuration["Jwt:RefreshExpirationDays"], out var days) && days > 0)
            return Math.Min(days, 90); // hard cap
        return DefaultRefreshExpirationDays;
    }

    public static DateTime RefreshExpiryUtc(IConfiguration configuration) =>
        DateTime.UtcNow.AddDays(GetRefreshExpirationDays(configuration));

    public static int GetAccessExpirationMinutes(IConfiguration configuration)
    {
        if (int.TryParse(configuration["Jwt:ExpirationMinutes"], out var minutes) && minutes > 0)
            return Math.Min(minutes, 24 * 60); // hard cap 24h
        return DefaultAccessExpirationMinutes;
    }
}
