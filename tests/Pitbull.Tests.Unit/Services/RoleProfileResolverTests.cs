using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class RoleProfileResolverTests
{
    [Theory]
    [InlineData("Chief Executive Officer", "Manager", TourProfile.Executive, "Executive", "executive")]
    [InlineData("Chief Financial Officer", "Manager", TourProfile.Cfo, "Controller", "controller")]
    [InlineData("Project Manager", "Supervisor", TourProfile.ProjectManager, "PM", "pm")]
    [InlineData("Estimator", "User", TourProfile.Estimator, "Estimator", "estimator")]
    [InlineData("Field Engineer", "User", TourProfile.Field, "Foreman", "field")]
    public void Detect_DemoPersonas_MapsCorrectly(
        string title,
        string identityRole,
        TourProfile expectedProfile,
        string expectedBriefing,
        string expectedLayout)
    {
        var roles = new[] { identityRole };
        var profile = RoleProfileResolver.Detect(title, roles);

        Assert.Equal(expectedProfile, profile);
        Assert.Equal(expectedBriefing, RoleProfileResolver.ToBriefingRole(profile));
        Assert.Equal(expectedLayout, RoleProfileResolver.ToDashboardLayout(profile));
    }

    [Fact]
    public void Detect_ManagerWithoutTitle_FallsBackToProjectManager_NotExecutive()
    {
        // Root cause of CEO-as-PM bug was the reverse: Identity Manager alone
        // is not enough for Executive; title is required.
        var profile = RoleProfileResolver.Detect(null, new[] { "Manager" });
        Assert.Equal(TourProfile.ProjectManager, profile);
        Assert.Equal("PM", RoleProfileResolver.ToBriefingRole(profile));
    }

    [Fact]
    public void Detect_CeoTitleWithManagerRole_IsExecutive()
    {
        var profile = RoleProfileResolver.Detect("Chief Executive Officer", new[] { "Manager" });
        Assert.Equal(TourProfile.Executive, profile);
        Assert.Equal("Executive", RoleProfileResolver.ToBriefingRole(profile));
        Assert.Equal("executive", RoleProfileResolver.ToApiName(profile));
    }

    [Fact]
    public void Detect_CfoTitleBeatsAdminRole()
    {
        var profile = RoleProfileResolver.Detect("Chief Financial Officer", new[] { "Admin" });
        Assert.Equal(TourProfile.Cfo, profile);
    }

    [Fact]
    public void Detect_TenantScopedRole_Normalized()
    {
        var tenantId = Guid.NewGuid();
        var profile = RoleProfileResolver.Detect(null, new[] { $"{tenantId}:Admin" });
        Assert.Equal(TourProfile.Executive, profile);
    }
}
