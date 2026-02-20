using FluentAssertions;
using Pitbull.Core.Constants;

namespace Pitbull.Tests.Unit.Security;

public class PermissionConstantsTests
{
    [Fact]
    public void All_ReturnsExpectedCount()
    {
        // The system has 64 granular permissions (excludes wildcard *)
        PermissionConstants.All.Should().HaveCountGreaterThanOrEqualTo(45);
    }

    [Fact]
    public void All_ContainsNoDuplicates()
    {
        var duplicates = PermissionConstants.All
            .GroupBy(p => p, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        duplicates.Should().BeEmpty("permission names must be unique");
    }

    [Fact]
    public void All_DoesNotContainWildcard()
    {
        PermissionConstants.All.Should().NotContain("*",
            "the wildcard should not be in the All list");
    }

    [Fact]
    public void All_AllPermissionsFollowCategoryDotActionFormat()
    {
        foreach (var permission in PermissionConstants.All)
        {
            permission.Should().Contain(".",
                $"permission '{permission}' must follow Category.Action format");

            var parts = permission.Split('.');
            parts.Should().HaveCount(2,
                $"permission '{permission}' must have exactly one dot separator");
            parts[0].Should().NotBeNullOrWhiteSpace(
                $"permission '{permission}' must have a non-empty category");
            parts[1].Should().NotBeNullOrWhiteSpace(
                $"permission '{permission}' must have a non-empty action");
        }
    }

    [Fact]
    public void ByCategory_CoversAllPermissions()
    {
        var fromCategory = PermissionConstants.ByCategory
            .SelectMany(c => c.Value.Select(p => p.Name))
            .OrderBy(n => n)
            .ToList();

        var fromAll = PermissionConstants.All.OrderBy(n => n).ToList();

        fromCategory.Should().BeEquivalentTo(fromAll,
            "every permission in All must appear in ByCategory and vice versa");
    }

    [Fact]
    public void ByCategory_HasNoDuplicatePermissionNames()
    {
        var allNames = PermissionConstants.ByCategory
            .SelectMany(c => c.Value.Select(p => p.Name))
            .ToList();

        var duplicates = allNames
            .GroupBy(n => n, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        duplicates.Should().BeEmpty("no permission should appear in multiple categories");
    }

    [Fact]
    public void ByCategory_EachPermissionHasDescription()
    {
        foreach (var (category, permissions) in PermissionConstants.ByCategory)
        {
            foreach (var (name, description) in permissions)
            {
                description.Should().NotBeNullOrWhiteSpace(
                    $"permission '{name}' in category '{category}' must have a description");
            }
        }
    }

    [Fact]
    public void ByCategory_CategoryNamesMatchPermissionPrefixes()
    {
        foreach (var (category, permissions) in PermissionConstants.ByCategory)
        {
            foreach (var (name, _) in permissions)
            {
                name.Should().StartWith(category + ".",
                    $"permission '{name}' must start with its category '{category}.'");
            }
        }
    }

    [Fact]
    public void RoleTemplates_All_ReturnsExpectedCount()
    {
        PermissionConstants.RoleTemplates.All.Should().HaveCount(8,
            "there should be exactly 8 predefined role templates");
    }

    [Fact]
    public void RoleTemplates_All_ContainsExpectedRoles()
    {
        PermissionConstants.RoleTemplates.All.Should().Contain(new[]
        {
            "Admin", "Executive", "Controller", "ProjectManager",
            "Foreman", "Estimator", "PayrollSpecialist", "Viewer"
        });
    }

    [Fact]
    public void RoleTemplates_Descriptions_ExistForEveryRole()
    {
        foreach (var role in PermissionConstants.RoleTemplates.All)
        {
            PermissionConstants.RoleTemplates.Descriptions.Should().ContainKey(role,
                $"role '{role}' must have a description");

            PermissionConstants.RoleTemplates.Descriptions[role].Should().NotBeNullOrWhiteSpace(
                $"role '{role}' description must not be empty");
        }
    }

    [Fact]
    public void RoleTemplates_PermissionRules_ExistForEveryRole()
    {
        foreach (var role in PermissionConstants.RoleTemplates.All)
        {
            PermissionConstants.RoleTemplates.PermissionRules.Should().ContainKey(role,
                $"role '{role}' must have permission rules defined");

            PermissionConstants.RoleTemplates.PermissionRules[role].Should().NotBeEmpty(
                $"role '{role}' must have at least one permission rule");
        }
    }

    [Fact]
    public void RoleTemplates_AdminHasWildcard()
    {
        PermissionConstants.RoleTemplates.PermissionRules["Admin"]
            .Should().ContainSingle()
            .Which.Should().Be("*", "Admin role should have wildcard-only access");
    }

    [Fact]
    public void RoleTemplates_ViewerHasSuffixRule()
    {
        PermissionConstants.RoleTemplates.PermissionRules["Viewer"]
            .Should().ContainSingle()
            .Which.Should().Be(".View", "Viewer role should match suffix .View only");
    }

    [Theory]
    [InlineData("Projects.View")]
    [InlineData("TimeTracking.Create")]
    [InlineData("Bids.ConvertToProject")]
    [InlineData("Contracts.ApproveChangeOrders")]
    [InlineData("Billing.ReleaseRetention")]
    [InlineData("AP.Approve")]
    [InlineData("Accounting.PostJournals")]
    [InlineData("Payroll.Process")]
    [InlineData("PM.RFIs")]
    [InlineData("Employees.ViewSensitive")]
    [InlineData("Admin.Roles")]
    [InlineData("AI.Chat")]
    public void All_ContainsExpectedPermission(string permission)
    {
        PermissionConstants.All.Should().Contain(permission);
    }

    [Fact]
    public void Wildcard_IsAsterisk()
    {
        PermissionConstants.Wildcard.Should().Be("*");
    }

    [Fact]
    public void ByCategory_HasExpectedCategoryCount()
    {
        // Projects, TimeTracking, Bids, Contracts, Billing, AP, AR, Accounting,
        // Payroll, PM, Equipment, Documents, Employees, Reports, Admin, SystemAdmin, AI
        PermissionConstants.ByCategory.Keys.Should().HaveCountGreaterThanOrEqualTo(15,
            "there should be at least 15 permission categories");
    }

    [Theory]
    [InlineData("Projects")]
    [InlineData("TimeTracking")]
    [InlineData("Bids")]
    [InlineData("Contracts")]
    [InlineData("Billing")]
    [InlineData("AP")]
    [InlineData("AR")]
    [InlineData("Accounting")]
    [InlineData("Payroll")]
    [InlineData("PM")]
    [InlineData("Equipment")]
    [InlineData("Documents")]
    [InlineData("Employees")]
    [InlineData("Reports")]
    [InlineData("Admin")]
    [InlineData("SystemAdmin")]
    [InlineData("AI")]
    public void ByCategory_ContainsExpectedCategory(string category)
    {
        PermissionConstants.ByCategory.Should().ContainKey(category);
    }
}
