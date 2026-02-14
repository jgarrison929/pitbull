namespace Pitbull.Core.Domain;

/// <summary>
/// Maps which companies a user can access within their tenant.
/// If a user has no entries, they can access NO companies (locked out of data).
/// </summary>
public class UserCompanyAccess : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid CompanyId { get; set; }

    /// <summary>
    /// Role within this specific company (optional override).
    /// Null = inherit tenant-level role.
    /// </summary>
    public string? CompanyRole { get; set; }

    /// <summary>
    /// Whether this is the user's default company (loaded on login)
    /// </summary>
    public bool IsDefault { get; set; }

    // Navigation
    public AppUser User { get; set; } = null!;
    public Company Company { get; set; } = null!;
}
