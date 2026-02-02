using Microsoft.AspNetCore.Identity;

namespace Pitbull.Core.Domain;

/// <summary>
/// Application user extending ASP.NET Identity.
/// Supports both internal (employee) and external (subcontractor) users.
/// </summary>
public class AppUser : IdentityUser<Guid>
{
    public Guid TenantId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName => $"{FirstName} {LastName}".Trim();
    public UserType Type { get; set; } = UserType.Internal;
    public UserStatus Status { get; set; } = UserStatus.Active;
    public string? Title { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    // Navigation
    public Tenant Tenant { get; set; } = null!;
}

public class AppRole : IdentityRole<Guid>
{
    public Guid TenantId { get; set; }
    public string? Description { get; set; }
    public bool IsSystemRole { get; set; } = false;
}

public enum UserType
{
    Internal,   // Employees
    External    // Subcontractors, vendors
}

public enum UserStatus
{
    Active,
    Inactive,
    Locked,
    Invited     // Sent invite, hasn't logged in yet
}
