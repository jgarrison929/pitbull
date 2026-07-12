using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;

namespace Pitbull.Core.Services;

public interface IProjectAccessService
{
    Task<bool> HasProjectAccessAsync(Guid projectId, ClaimsPrincipal? user, CancellationToken ct);
}

/// <summary>
/// Unified project access check used by RFIs (and similar project-scoped modules).
/// <list type="bullet">
/// <item><description><b>Admin</b> / <b>Manager</b> — company-wide access (office + demo personas).</description></item>
/// <item><description>Everyone else — active <c>project_assignments</c> matching the user's employee email.</description></item>
/// </list>
/// Manager includes demo CEO/CFO/PM/Estimator (Identity role Manager, not Admin) so site-walk
/// RFI panels do not 403 while the same user can still open the project.
/// </summary>
public sealed class ProjectAccessService(PitbullDbContext db) : IProjectAccessService
{
    private sealed class AccessCheckRow
    {
        public int Value { get; set; }
    }

    /// <summary>
    /// Pure role gate — unit-testable without SQL.
    /// </summary>
    public static bool HasCompanyWideProjectAccess(ClaimsPrincipal? user)
    {
        if (user is null) return false;
        return user.IsInRole("Admin") || user.IsInRole("Manager");
    }

    public async Task<bool> HasProjectAccessAsync(Guid projectId, ClaimsPrincipal? user, CancellationToken ct)
    {
        if (HasCompanyWideProjectAccess(user))
            return true;

        var email = user?.Identity?.Name
                    ?? user?.FindFirst(ClaimTypes.Email)?.Value
                    ?? user?.FindFirst("email")?.Value;

        if (string.IsNullOrWhiteSpace(email))
            return false;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var match = await db.Database
            .SqlQuery<AccessCheckRow>($"""
                SELECT COUNT(*)::int AS "Value"
                FROM project_assignments pa
                INNER JOIN employees e ON e."Id" = pa."EmployeeId"
                WHERE pa."ProjectId" = {projectId}
                  AND pa."IsActive" = true
                  AND pa."StartDate" <= {today}
                  AND (pa."EndDate" IS NULL OR pa."EndDate" >= {today})
                  AND pa."IsDeleted" = false
                  AND e."IsActive" = true
                  AND e."Email" = {email}
                  AND e."IsDeleted" = false
                """)
            .FirstOrDefaultAsync(ct);

        return match is { Value: > 0 };
    }
}
