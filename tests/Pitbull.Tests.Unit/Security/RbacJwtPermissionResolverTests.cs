using FluentAssertions;
using Pitbull.Api.Services;
using Pitbull.Core.Constants;

namespace Pitbull.Tests.Unit.Security;

public class RbacJwtPermissionResolverTests
{
    [Theory]
    [InlineData("Chief Executive Officer", "Manager", PermissionConstants.RoleTemplates.Executive)]
    [InlineData("Chief Financial Officer", "Manager", PermissionConstants.RoleTemplates.Controller)]
    [InlineData("Project Manager", "Supervisor", PermissionConstants.RoleTemplates.ProjectManager)]
    [InlineData("Field Superintendent", "User", PermissionConstants.RoleTemplates.Foreman)]
    [InlineData("Estimator", "User", PermissionConstants.RoleTemplates.Estimator)]
    [InlineData("Contract Administrator", "Manager", PermissionConstants.RoleTemplates.ProjectManager)]
    [InlineData("AP / AR Clerk", "User", PermissionConstants.RoleTemplates.Controller)]
    [InlineData("IT Administrator", "Manager", PermissionConstants.RoleTemplates.Viewer)]
    [InlineData(null, "User", PermissionConstants.RoleTemplates.Viewer)]
    public void ResolveDemoTemplateName_NeverMapsToAdmin(string? title, string identityRole, string expected)
    {
        var template = RbacJwtPermissionResolver.ResolveDemoTemplateName(title, [identityRole]);

        template.Should().Be(expected);
        template.Should().NotBe(PermissionConstants.RoleTemplates.Admin);
    }

    [Fact]
    public void ResolveDemoTemplateName_IdentityAdminAlone_DoesNotGrantAdminTemplate()
    {
        // Identity Admin without executive title maps via profile; never Admin RBAC template for demo fallback.
        var template = RbacJwtPermissionResolver.ResolveDemoTemplateName("Staff", ["Admin"]);

        template.Should().NotBe(PermissionConstants.RoleTemplates.Admin);
    }
}
