using System.Security.Claims;
using FluentAssertions;
using Pitbull.Core.Services;

namespace Pitbull.Tests.Unit.Services;

public class ProjectAccessServiceTests
{
    [Fact]
    public void HasCompanyWideProjectAccess_Admin_IsTrue()
    {
        var user = PrincipalWithRoles("Admin");
        ProjectAccessService.HasCompanyWideProjectAccess(user).Should().BeTrue();
    }

    [Fact]
    public void HasCompanyWideProjectAccess_Manager_IsTrue()
    {
        // Demo CEO / CFO / PM / Estimator use Identity role Manager (not Admin).
        var user = PrincipalWithRoles("Manager");
        ProjectAccessService.HasCompanyWideProjectAccess(user).Should().BeTrue();
    }

    [Fact]
    public void HasCompanyWideProjectAccess_UserOnly_IsFalse()
    {
        var user = PrincipalWithRoles("User");
        ProjectAccessService.HasCompanyWideProjectAccess(user).Should().BeFalse();
    }

    [Fact]
    public void HasCompanyWideProjectAccess_SupervisorOnly_IsFalse()
    {
        // Field supers need an active project assignment.
        var user = PrincipalWithRoles("Supervisor");
        ProjectAccessService.HasCompanyWideProjectAccess(user).Should().BeFalse();
    }

    [Fact]
    public void HasCompanyWideProjectAccess_Null_IsFalse()
    {
        ProjectAccessService.HasCompanyWideProjectAccess(null).Should().BeFalse();
    }

    private static ClaimsPrincipal PrincipalWithRoles(params string[] roles)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, "user@demo.local"),
            new(ClaimTypes.Email, "user@demo.local"),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
    }
}
