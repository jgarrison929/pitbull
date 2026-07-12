using FluentAssertions;
using Pitbull.Core.Constants;

namespace Pitbull.Tests.Unit.Security;

public sealed class SpatialPermissionConstantsTests
{
    [Fact]
    public void Spatial_permissions_are_registered_in_All_and_ByCategory()
    {
        PermissionConstants.All.Should().Contain(PermissionConstants.SpatialView);
        PermissionConstants.All.Should().Contain(PermissionConstants.SpatialManage);
        PermissionConstants.SpatialView.Should().Be("Spatial.View");
        PermissionConstants.SpatialManage.Should().Be("Spatial.Manage");

        PermissionConstants.ByCategory.Should().ContainKey("Spatial");
        var names = PermissionConstants.ByCategory["Spatial"].Select(p => p.Name).ToArray();
        names.Should().Contain(PermissionConstants.SpatialView);
        names.Should().Contain(PermissionConstants.SpatialManage);
    }

    [Fact]
    public void Role_rules_grant_view_to_field_and_manage_to_pm()
    {
        var rules = PermissionConstants.RoleTemplates.PermissionRules;

        rules[PermissionConstants.RoleTemplates.ProjectManager]
            .Should().Contain(PermissionConstants.SpatialView);
        rules[PermissionConstants.RoleTemplates.ProjectManager]
            .Should().Contain(PermissionConstants.SpatialManage);

        rules[PermissionConstants.RoleTemplates.Foreman]
            .Should().Contain(PermissionConstants.SpatialView);

        rules[PermissionConstants.RoleTemplates.Executive]
            .Should().Contain(PermissionConstants.SpatialView);
        rules[PermissionConstants.RoleTemplates.Executive]
            .Should().NotContain(PermissionConstants.SpatialManage);
    }
}
