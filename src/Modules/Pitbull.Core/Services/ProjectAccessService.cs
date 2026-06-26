using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;

namespace Pitbull.Core.Services;

public interface IProjectAccessService
{
    Task<bool> HasProjectAccessAsync(Guid projectId, ClaimsPrincipal? user, CancellationToken ct);
}

/// <summary>
/// Unified project access check: Admin role bypasses; otherwise requires an active
/// ProjectAssignment matching the current user's employee email.
/// </summary>
public sealed class ProjectAccessService(PitbullDbContext db) : IProjectAccessService
{
    private sealed class AccessCheckRow
    {
        public int Value { get; set; }
    }

    public async Task<bool> HasProjectAccessAsync(Guid projectId, ClaimsPrincipal? user, CancellationToken ct)
    {
        if (user?.IsInRole("Admin") == true)
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