using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Services;
using Pitbull.Core.Constants;
using Pitbull.Core.Domain;
using Pitbull.Core.Entities;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Security;

public class RoleServiceSeedTests
{
    private static RoleService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var tenantContext = new TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId,
            TenantName = "Test Tenant"
        };
        return new RoleService(db, tenantContext);
    }

    [Fact]
    public async Task EnsureSeeded_CreatesAllPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        await service.EnsureSeededAsync(TestDbContextFactory.TestTenantId, CancellationToken.None);

        // Assert
        var permissions = await db.Permissions
            .Where(p => p.TenantId == TestDbContextFactory.TestTenantId)
            .ToListAsync();

        permissions.Should().NotBeEmpty();
        permissions.Should().HaveCount(PermissionConstants.All.Count,
            "all permissions from PermissionConstants should be seeded");
    }

    [Fact]
    public async Task EnsureSeeded_CreatesAllRoles()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        await service.EnsureSeededAsync(TestDbContextFactory.TestTenantId, CancellationToken.None);

        // Assert
        var roles = await db.RbacRoles
            .Where(r => r.TenantId == TestDbContextFactory.TestTenantId)
            .ToListAsync();

        roles.Should().NotBeEmpty();
        roles.Should().HaveCount(PermissionConstants.RoleTemplates.All.Count,
            "all 8 role templates should be seeded");

        var roleNames = roles.Select(r => r.Name).ToList();
        foreach (var expectedRole in PermissionConstants.RoleTemplates.All)
        {
            roleNames.Should().Contain(expectedRole,
                $"role '{expectedRole}' should be seeded");
        }
    }

    [Fact]
    public async Task EnsureSeeded_AdminRoleIsSystem()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        await service.EnsureSeededAsync(TestDbContextFactory.TestTenantId, CancellationToken.None);

        // Assert
        var adminRole = await db.RbacRoles
            .FirstOrDefaultAsync(r => r.TenantId == TestDbContextFactory.TestTenantId && r.Name == "Admin");

        adminRole.Should().NotBeNull();
        adminRole!.IsSystem.Should().BeTrue("Admin role must be a system role");
    }

    [Fact]
    public async Task EnsureSeeded_AdminRoleHasAllPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        await service.EnsureSeededAsync(TestDbContextFactory.TestTenantId, CancellationToken.None);

        // Assert
        var adminRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == TestDbContextFactory.TestTenantId && r.Name == "Admin");

        var adminPermissionCount = await db.RolePermissions
            .CountAsync(rp => rp.TenantId == TestDbContextFactory.TestTenantId && rp.RoleId == adminRole.Id);

        var totalPermissionCount = await db.Permissions
            .CountAsync(p => p.TenantId == TestDbContextFactory.TestTenantId);

        adminPermissionCount.Should().Be(totalPermissionCount,
            "Admin role (via wildcard) should be assigned every permission");
    }

    [Fact]
    public async Task EnsureSeeded_IsIdempotent_DoesNotDuplicatePermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act — seed twice
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);
        var countAfterFirst = await db.Permissions.CountAsync(p => p.TenantId == tenantId);

        await service.EnsureSeededAsync(tenantId, CancellationToken.None);
        var countAfterSecond = await db.Permissions.CountAsync(p => p.TenantId == tenantId);

        // Assert
        countAfterSecond.Should().Be(countAfterFirst,
            "re-seeding should not create duplicate permissions");
    }

    [Fact]
    public async Task EnsureSeeded_IsIdempotent_DoesNotDuplicateRoles()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act — seed twice
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);
        var countAfterFirst = await db.RbacRoles.CountAsync(r => r.TenantId == tenantId);

        await service.EnsureSeededAsync(tenantId, CancellationToken.None);
        var countAfterSecond = await db.RbacRoles.CountAsync(r => r.TenantId == tenantId);

        // Assert
        countAfterSecond.Should().Be(countAfterFirst,
            "re-seeding should not create duplicate roles");
    }

    [Fact]
    public async Task EnsureSeeded_IsIdempotent_DoesNotDuplicateRolePermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act — seed twice
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);
        var countAfterFirst = await db.RolePermissions.CountAsync(rp => rp.TenantId == tenantId);

        await service.EnsureSeededAsync(tenantId, CancellationToken.None);
        var countAfterSecond = await db.RolePermissions.CountAsync(rp => rp.TenantId == tenantId);

        // Assert
        countAfterSecond.Should().Be(countAfterFirst,
            "re-seeding should not create duplicate role-permission assignments");
    }

    [Fact]
    public async Task EnsureSeeded_ViewerRole_OnlyHasViewPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var viewerRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == tenantId && r.Name == "Viewer");

        var viewerPermissions = await db.RolePermissions
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == viewerRole.Id)
            .Join(db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Name)
            .ToListAsync();

        viewerPermissions.Should().NotBeEmpty("Viewer should have some permissions");

        foreach (var permissionName in viewerPermissions)
        {
            permissionName.Should().EndWith(".View",
                $"Viewer role should only have View permissions, but has '{permissionName}'");
        }
    }

    [Fact]
    public async Task EnsureSeeded_ForemanRole_HasExpectedPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var foremanRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == tenantId && r.Name == "Foreman");

        var foremanPermissions = await db.RolePermissions
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == foremanRole.Id)
            .Join(db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Name)
            .ToListAsync();

        foremanPermissions.Should().Contain("Projects.View",
            "Foreman must be able to view projects");
        foremanPermissions.Should().Contain("TimeTracking.View",
            "Foreman must be able to view time entries");
        foremanPermissions.Should().Contain("TimeTracking.Create",
            "Foreman must be able to create time entries");
    }

    [Fact]
    public async Task EnsureSeeded_AllSeededRolesAreSystem()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var roles = await db.RbacRoles
            .Where(r => r.TenantId == tenantId)
            .ToListAsync();

        foreach (var role in roles)
        {
            role.IsSystem.Should().BeTrue(
                $"seeded role '{role.Name}' should be marked as system");
        }
    }

    [Fact]
    public async Task EnsureSeeded_PermissionsHaveValidCategories()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var permissions = await db.Permissions
            .Where(p => p.TenantId == tenantId)
            .ToListAsync();

        foreach (var permission in permissions)
        {
            permission.Category.Should().NotBeNullOrWhiteSpace(
                $"permission '{permission.Name}' must have a category");
            permission.Name.Should().StartWith(permission.Category + ".",
                $"permission '{permission.Name}' should start with its category '{permission.Category}.'");
        }
    }

    [Fact]
    public async Task EnsureSeeded_PermissionsHaveDescriptions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var permissions = await db.Permissions
            .Where(p => p.TenantId == tenantId)
            .ToListAsync();

        foreach (var permission in permissions)
        {
            permission.Description.Should().NotBeNullOrWhiteSpace(
                $"permission '{permission.Name}' must have a description");
        }
    }

    [Fact]
    public async Task EnsureSeeded_TenantIsolation_SeedingOneTenantDoesNotAffectOther()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db1 = TestDbContextFactory.Create(
            tenantId: TestDbContextFactory.TestTenantId, dbName: dbName);
        using var db2 = TestDbContextFactory.CreateWithSameDb(
            dbName, TestDbContextFactory.OtherTenantId);

        var tenant1Context = new TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId,
            TenantName = "Tenant 1"
        };
        var tenant2Context = new TenantContext
        {
            TenantId = TestDbContextFactory.OtherTenantId,
            TenantName = "Tenant 2"
        };

        var service1 = new RoleService(db1, tenant1Context);

        // Act — seed only tenant 1
        await service1.EnsureSeededAsync(TestDbContextFactory.TestTenantId, CancellationToken.None);

        // Assert — tenant 2 should have nothing
        var tenant2Permissions = await db2.Permissions
            .IgnoreQueryFilters()
            .Where(p => p.TenantId == TestDbContextFactory.OtherTenantId)
            .CountAsync();

        tenant2Permissions.Should().Be(0,
            "seeding tenant 1 should not create permissions for tenant 2");
    }

    [Fact]
    public async Task ListRoles_AfterSeed_ReturnsAllRoles()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var roles = await service.ListRolesAsync();

        // Assert
        roles.Should().NotBeEmpty();
        roles.Should().HaveCount(PermissionConstants.RoleTemplates.All.Count);
        roles.Should().Contain(r => r.Name == "Admin");
        roles.Should().Contain(r => r.Name == "Executive");
        roles.Should().Contain(r => r.Name == "Controller");
        roles.Should().Contain(r => r.Name == "Foreman");
    }

    [Fact]
    public async Task ListPermissionsByCategory_AfterSeed_ReturnsGroupedPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var categories = await service.ListPermissionsByCategoryAsync();

        // Assert
        categories.Should().NotBeEmpty();
        categories.Should().Contain(c => c.Category == "Projects");
        categories.Should().Contain(c => c.Category == "Admin");
    }

    [Fact]
    public async Task CreateRole_DuplicateName_ThrowsInvalidOperation()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        await service.EnsureSeededAsync(TestDbContextFactory.TestTenantId, CancellationToken.None);

        // Act & Assert — "Admin" already seeded
        var act = () => service.CreateRoleAsync(new CreateRoleDto("Admin", "Duplicate"));
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task UpdateRole_SystemRole_ThrowsInvalidOperation()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        await service.EnsureSeededAsync(TestDbContextFactory.TestTenantId, CancellationToken.None);

        var adminRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == TestDbContextFactory.TestTenantId && r.Name == "Admin");

        // Act & Assert
        var act = () => service.UpdateRoleAsync(adminRole.Id, new UpdateRoleDto("SuperAdmin", "Renamed"));
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*System roles*");
    }

    [Fact]
    public async Task DeleteRole_SystemRole_ThrowsInvalidOperation()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        await service.EnsureSeededAsync(TestDbContextFactory.TestTenantId, CancellationToken.None);

        var adminRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == TestDbContextFactory.TestTenantId && r.Name == "Admin");

        // Act & Assert
        var act = () => service.DeleteRoleAsync(adminRole.Id);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*System roles*");
    }

    [Fact]
    public async Task EnsureSeeded_ControllerRole_HasFinancialPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var controllerRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == tenantId && r.Name == "Controller");

        var controllerPermissions = await db.RolePermissions
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == controllerRole.Id)
            .Join(db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Name)
            .ToListAsync();

        // Controller role should have full financial access
        controllerPermissions.Should().Contain(PermissionConstants.BillingView);
        controllerPermissions.Should().Contain(PermissionConstants.APApprove);
        controllerPermissions.Should().Contain(PermissionConstants.AccountingPostJournals);
        controllerPermissions.Should().Contain(PermissionConstants.PayrollProcess);
    }

    [Fact]
    public async Task EnsureSeeded_EstimatorRole_HasBidPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var estimatorRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == tenantId && r.Name == "Estimator");

        var estimatorPermissions = await db.RolePermissions
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == estimatorRole.Id)
            .Join(db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Name)
            .ToListAsync();

        estimatorPermissions.Should().Contain(PermissionConstants.BidsView);
        estimatorPermissions.Should().Contain(PermissionConstants.BidsCreate);
        estimatorPermissions.Should().Contain(PermissionConstants.BidsEdit);
        estimatorPermissions.Should().Contain(PermissionConstants.BidsConvertToProject);
        estimatorPermissions.Should().Contain(PermissionConstants.ProjectsView);
    }

    [Fact]
    public async Task EnsureSeeded_ProjectManagerRole_HasProjectAndPMPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var pmRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == tenantId && r.Name == "ProjectManager");

        var pmPermissions = await db.RolePermissions
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == pmRole.Id)
            .Join(db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Name)
            .ToListAsync();

        // PM should have all Projects.* permissions
        pmPermissions.Should().Contain(PermissionConstants.ProjectsView);
        pmPermissions.Should().Contain(PermissionConstants.ProjectsCreate);
        pmPermissions.Should().Contain(PermissionConstants.ProjectsEdit);
        pmPermissions.Should().Contain(PermissionConstants.ProjectsDelete);

        // PM should have all PM.* permissions
        pmPermissions.Should().Contain(PermissionConstants.PMRFIs);
        pmPermissions.Should().Contain(PermissionConstants.PMSubmittals);
        pmPermissions.Should().Contain(PermissionConstants.PMDailyReports);

        // PM should have time approval
        pmPermissions.Should().Contain(PermissionConstants.TimeTrackingApprove);
    }

    [Fact]
    public async Task EnsureSeeded_PayrollSpecialist_HasPayrollAndEmployeePermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert
        var payrollRole = await db.RbacRoles
            .FirstAsync(r => r.TenantId == tenantId && r.Name == "PayrollSpecialist");

        var payrollPermissions = await db.RolePermissions
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == payrollRole.Id)
            .Join(db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Name)
            .ToListAsync();

        payrollPermissions.Should().Contain(PermissionConstants.PayrollView);
        payrollPermissions.Should().Contain(PermissionConstants.PayrollProcess);
        payrollPermissions.Should().Contain(PermissionConstants.EmployeesView);
        payrollPermissions.Should().Contain(PermissionConstants.EmployeesManage);
        payrollPermissions.Should().Contain(PermissionConstants.TimeTrackingViewRates);
    }

    #region GetUserPermissionsAsync

    [Fact]
    public async Task GetUserPermissions_AdminUser_ReturnsWildcard()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Create a test user and assign Admin role
        var userId = Guid.NewGuid();
        db.Set<AppUser>().Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            Email = "admin@test.com",
            FirstName = "Test",
            LastName = "Admin",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var adminRole = await db.RbacRoles.FirstAsync(r => r.TenantId == tenantId && r.Name == "Admin");
        await service.AssignUserRoleAsync(userId, adminRole.Id);

        // Act
        var permissions = await service.GetUserPermissionsAsync(userId);

        // Assert
        permissions.Should().ContainSingle()
            .Which.Should().Be("*", "Admin user should get wildcard permission");
    }

    [Fact]
    public async Task GetUserPermissions_ForemanUser_ReturnsExpectedPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        var userId = Guid.NewGuid();
        db.Set<AppUser>().Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            Email = "foreman@test.com",
            FirstName = "Test",
            LastName = "Foreman",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var foremanRole = await db.RbacRoles.FirstAsync(r => r.TenantId == tenantId && r.Name == "Foreman");
        await service.AssignUserRoleAsync(userId, foremanRole.Id);

        // Act
        var permissions = await service.GetUserPermissionsAsync(userId);

        // Assert
        permissions.Should().Contain("Projects.View");
        permissions.Should().Contain("TimeTracking.View");
        permissions.Should().Contain("TimeTracking.Create");
        permissions.Should().NotContain("*", "non-admin should not get wildcard");
        permissions.Should().NotContain("Admin.Users", "foreman should not have admin access");
    }

    [Fact]
    public async Task GetUserPermissions_UserWithNoRoles_ReturnsEmpty()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        var userId = Guid.NewGuid();
        db.Set<AppUser>().Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            Email = "norole@test.com",
            FirstName = "No",
            LastName = "Role User",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // Act
        var permissions = await service.GetUserPermissionsAsync(userId);

        // Assert
        permissions.Should().BeEmpty("user with no roles should have no permissions");
    }

    [Fact]
    public async Task GetUserPermissions_MultipleRoles_ReturnsMergedPermissions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        var userId = Guid.NewGuid();
        db.Set<AppUser>().Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            Email = "multi@test.com",
            FirstName = "Multi",
            LastName = "Role User",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // Assign both Foreman and Estimator roles
        var foremanRole = await db.RbacRoles.FirstAsync(r => r.TenantId == tenantId && r.Name == "Foreman");
        var estimatorRole = await db.RbacRoles.FirstAsync(r => r.TenantId == tenantId && r.Name == "Estimator");
        await service.AssignUserRoleAsync(userId, foremanRole.Id);
        await service.AssignUserRoleAsync(userId, estimatorRole.Id);

        // Act
        var permissions = await service.GetUserPermissionsAsync(userId);

        // Assert — should have permissions from both roles, deduplicated
        permissions.Should().Contain("TimeTracking.Create", "from Foreman role");
        permissions.Should().Contain("Bids.Create", "from Estimator role");
        permissions.Should().OnlyHaveUniqueItems("permissions should be deduplicated");
    }

    #endregion

    [Fact]
    public async Task EnsureSeeded_PermissionNamesMatchConstants()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        // Act
        await service.EnsureSeededAsync(tenantId, CancellationToken.None);

        // Assert — every seeded permission should match a PermissionConstants.All entry
        var seededNames = await db.Permissions
            .Where(p => p.TenantId == tenantId)
            .Select(p => p.Name)
            .OrderBy(n => n)
            .ToListAsync();

        var constantNames = PermissionConstants.All.OrderBy(n => n).ToList();

        seededNames.Should().BeEquivalentTo(constantNames,
            "seeded permissions must match PermissionConstants.All exactly");
    }
}
