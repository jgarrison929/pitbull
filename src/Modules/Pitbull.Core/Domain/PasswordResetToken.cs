using System.Security.Cryptography;
using System.Text;

namespace Pitbull.Core.Domain;

/// <summary>
/// Stores hashed password reset tokens. Plaintext token is sent via email;
/// only the SHA256 hash is persisted. Follows the same pattern as TeamInvitation.
/// </summary>
public class PasswordResetToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsExpired => DateTime.UtcNow > ExpiresAt;
    public bool IsValid => !IsUsed && !IsExpired;

    /// <summary>
    /// Generates a random token and its SHA256 hash.
    /// Returns (plaintext, hash) — only the hash is stored.
    /// </summary>
    public static (string PlaintextToken, string Hash) GenerateToken()
    {
        var plaintext = Guid.NewGuid().ToString("N");
        return (plaintext, HashToken(plaintext));
    }

    public static string HashToken(string plaintext)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext));
        return Convert.ToHexStringLower(bytes);
    }
}
