using System.Security.Cryptography;
using System.Text;

namespace Pitbull.Core.Domain;

/// <summary>
/// Represents an invitation for a user to join a tenant's company.
/// Tracks the invitation lifecycle from sent → accepted/expired/revoked.
/// </summary>
public class TeamInvitation : BaseEntity
{
    /// <summary>
    /// Email address of the invited person.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Role to assign when the invitation is accepted.
    /// Uses RoleSeeder.Roles values (Admin, Manager, Supervisor, Viewer, User).
    /// </summary>
    public string Role { get; set; } = "Viewer";

    /// <summary>
    /// Company the user is being invited to join.
    /// </summary>
    public Guid CompanyId { get; set; }

    /// <summary>
    /// SHA256 hash of the invitation token. The plaintext token is only returned
    /// to the caller at creation time (for the email link) and never stored.
    /// </summary>
    public string TokenHash { get; set; } = string.Empty;

    /// <summary>
    /// Current status of the invitation.
    /// </summary>
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;

    /// <summary>
    /// When the invitation expires (default: 7 days from creation).
    /// </summary>
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);

    /// <summary>
    /// When the invitation was accepted (null if not yet accepted).
    /// </summary>
    public DateTime? AcceptedAt { get; set; }

    /// <summary>
    /// The user ID of the person who accepted (null if not yet accepted).
    /// </summary>
    public Guid? AcceptedByUserId { get; set; }

    /// <summary>
    /// Optional personal message included in the invitation email.
    /// </summary>
    public string? Message { get; set; }

    /// <summary>
    /// Name of the person who sent the invitation (denormalized for display).
    /// </summary>
    public string InvitedBy { get; set; } = string.Empty;

    // Navigation
    public Company Company { get; set; } = null!;

    public bool IsExpired => DateTime.UtcNow > ExpiresAt;
    public bool CanAccept => Status == InvitationStatus.Pending && !IsExpired;

    /// <summary>
    /// Generates a cryptographically random token and stores its SHA256 hash.
    /// Returns the plaintext token (caller must send it in the email link).
    /// </summary>
    public static (string PlaintextToken, string Hash) GenerateToken()
    {
        var plaintext = Guid.NewGuid().ToString("N");
        return (plaintext, HashToken(plaintext));
    }

    /// <summary>
    /// Computes the SHA256 hash of a plaintext token for storage or lookup.
    /// </summary>
    public static string HashToken(string plaintext)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext));
        return Convert.ToHexStringLower(bytes);
    }
}

public enum InvitationStatus
{
    Pending,
    Accepted,
    Expired,
    Revoked
}
