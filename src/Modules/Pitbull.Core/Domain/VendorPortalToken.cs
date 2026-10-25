namespace Pitbull.Core.Domain;

/// <summary>
/// Token-based access for vendor portal. Allows vendors to view payments
/// and submit lien waivers for a specific project without a login.
/// </summary>
public class VendorPortalToken : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid VendorId { get; set; }
    public Guid ProjectId { get; set; }

    /// <summary>
    /// Cryptographically random, URL-safe token (Base64url encoded, 32 bytes).
    /// </summary>
    public string Token { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? LastAccessedAt { get; set; }
    public int AccessCount { get; set; }

    // Navigation
    public Vendor? Vendor { get; set; }
}
