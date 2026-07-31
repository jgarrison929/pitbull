using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Pitbull.Core.Constants;

namespace Pitbull.Api.Infrastructure;

/// <summary>
/// Authorization requirement that demands a specific permission claim.
/// </summary>
public sealed class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}

/// <summary>
/// Evaluates whether the current user has the required permission.
/// Checks JWT "permissions" claims for:
///   1. Wildcard "*" — immediate success for real admins only (never for demo principals)
///   2. Exact match — the user has the specific permission
/// If neither matches, the handler does NOT call context.Succeed(),
/// which causes ASP.NET Core to deny by default.
/// </summary>
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private const string PermissionClaimType = "permissions";

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var user = context.User;
        if (user.Identity is not { IsAuthenticated: true })
            return Task.CompletedTask;

        // Defense in depth: demo JWTs must never escalate via permissions=*, even if an
        // old token still carries wildcard (mint path no longer grants * for demo).
        var isDemoPrincipal = user.HasClaim("is_demo_user", "true")
            || user.FindAll(ClaimTypes.Email)
                .Any(c => c.Value.EndsWith("@demo.local", StringComparison.OrdinalIgnoreCase));

        var permissionClaims = user.FindAll(PermissionClaimType);

        foreach (var claim in permissionClaims)
        {
            // Wildcard: real Admin only
            if (claim.Value == PermissionConstants.Wildcard)
            {
                if (isDemoPrincipal)
                    continue;

                context.Succeed(requirement);
                return Task.CompletedTask;
            }

            // Exact match
            if (string.Equals(claim.Value, requirement.Permission, StringComparison.Ordinal))
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }
        }

        // No match — don't call Succeed. ASP.NET Core denies by default.
        return Task.CompletedTask;
    }
}
