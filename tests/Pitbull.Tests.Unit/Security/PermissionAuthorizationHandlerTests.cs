using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Pitbull.Api.Infrastructure;

namespace Pitbull.Tests.Unit.Security;

public class PermissionAuthorizationHandlerTests
{
    private readonly PermissionAuthorizationHandler _handler = new();

    private static AuthorizationHandlerContext CreateContext(
        string requiredPermission,
        IEnumerable<Claim>? claims = null)
    {
        var requirement = new PermissionRequirement(requiredPermission);
        var identity = new ClaimsIdentity(claims ?? Array.Empty<Claim>(), "TestScheme");
        var principal = new ClaimsPrincipal(identity);
        return new AuthorizationHandlerContext(new[] { requirement }, principal, null);
    }

    [Fact]
    public async Task WildcardClaim_SucceedsForAnyPermission()
    {
        // Arrange
        var claims = new[]
        {
            new Claim("permissions", "*")
        };
        var context = CreateContext("Projects.View", claims);

        // Act
        await _handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeTrue(
            "wildcard (*) permission should grant access to any permission");
    }

    [Fact]
    public async Task ExactPermissionClaim_SucceedsForThatPermission()
    {
        // Arrange
        var claims = new[]
        {
            new Claim("permissions", "Projects.View")
        };
        var context = CreateContext("Projects.View", claims);

        // Act
        await _handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeTrue(
            "exact permission match should grant access");
    }

    [Fact]
    public async Task WrongPermissionClaim_Fails()
    {
        // Arrange
        var claims = new[]
        {
            new Claim("permissions", "Projects.View")
        };
        var context = CreateContext("Admin.Users", claims);

        // Act
        await _handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeFalse(
            "wrong permission should not grant access");
    }

    [Fact]
    public async Task NoPermissionClaims_Fails()
    {
        // Arrange — user has identity but no permission claims
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "testuser@example.com")
        };
        var context = CreateContext("Projects.View", claims);

        // Act
        await _handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeFalse(
            "user with no permission claims should be denied");
    }

    [Fact]
    public async Task MultiplePermissionClaims_CanAccessEach()
    {
        // Arrange
        var claims = new[]
        {
            new Claim("permissions", "Projects.View"),
            new Claim("permissions", "Projects.Create"),
            new Claim("permissions", "TimeTracking.View")
        };

        // Act & Assert — check each claimed permission
        foreach (var claimValue in claims.Select(c => c.Value))
        {
            var context = CreateContext(claimValue, claims);
            await _handler.HandleAsync(context);
            context.HasSucceeded.Should().BeTrue(
                $"user should have access to claimed permission '{claimValue}'");
        }
    }

    [Fact]
    public async Task MultiplePermissionClaims_CannotAccessUnclaimed()
    {
        // Arrange
        var claims = new[]
        {
            new Claim("permissions", "Projects.View"),
            new Claim("permissions", "Projects.Create")
        };
        var context = CreateContext("Admin.Users", claims);

        // Act
        await _handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeFalse(
            "user should not have access to unclaimed permission");
    }

    [Fact]
    public async Task PermissionMatch_IsCaseSensitive()
    {
        // Arrange — the handler uses StringComparison.Ordinal (case-sensitive)
        var claims = new[]
        {
            new Claim("permissions", "Projects.View")
        };
        var context = CreateContext("projects.view", claims);

        // Act
        await _handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeFalse(
            "permission matching is case-sensitive (Ordinal comparison)");
    }

    [Fact]
    public async Task UnauthenticatedUser_Fails()
    {
        // Arrange — no identity at all
        var requirement = new PermissionRequirement("Projects.View");
        var principal = new ClaimsPrincipal();
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        // Act
        await _handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeFalse(
            "unauthenticated user should be denied");
    }

    [Fact]
    public void PermissionRequirement_StoresPermission()
    {
        // Arrange & Act
        var requirement = new PermissionRequirement("Projects.View");

        // Assert
        requirement.Permission.Should().Be("Projects.View");
    }

    [Fact]
    public async Task WildcardClaim_SucceedsForAdminOperations()
    {
        // Arrange — Admin with wildcard should access everything
        var claims = new[]
        {
            new Claim("permissions", "*")
        };

        var sensitivePermissions = new[]
        {
            "Admin.Users", "Admin.Roles", "Admin.Settings",
            "Accounting.PostJournals", "Payroll.Process",
            "Employees.ViewSensitive"
        };

        // Act & Assert
        foreach (var permission in sensitivePermissions)
        {
            var context = CreateContext(permission, claims);
            await _handler.HandleAsync(context);
            context.HasSucceeded.Should().BeTrue(
                $"wildcard should grant access to sensitive permission '{permission}'");
        }
    }

    [Fact]
    public async Task EmptyPermissionClaimValue_DoesNotMatchAnything()
    {
        // Arrange
        var claims = new[]
        {
            new Claim("permissions", "")
        };
        var context = CreateContext("Projects.View", claims);

        // Act
        await _handler.HandleAsync(context);

        // Assert
        context.HasSucceeded.Should().BeFalse(
            "empty permission claim should not match anything");
    }
}
