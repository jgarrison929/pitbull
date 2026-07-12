using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Api;

public class AdminUsersControllerTests
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;

    private static Mock<UserManager<AppUser>> CreateMockUserManager()
    {
        var store = new Mock<IUserStore<AppUser>>();
        return new Mock<UserManager<AppUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
    }

    private static Mock<RoleManager<AppRole>> CreateMockRoleManager()
    {
        var store = new Mock<IRoleStore<AppRole>>();
        return new Mock<RoleManager<AppRole>>(
            store.Object, null!, null!, null!, null!);
    }

    private static AdminUsersController CreateController(
        PitbullDbContext db,
        Mock<UserManager<AppUser>> userManager,
        Mock<RoleManager<AppRole>> roleManager,
        bool isAuthenticated = false,
        string? authenticatedRole = null)
    {
        var roleSeeder = new RoleSeeder(
            roleManager.Object,
            userManager.Object,
            db,
            NullLogger<RoleSeeder>.Instance);
        var tenantContext = new Mock<ITenantContext>();
        tenantContext.SetupGet(t => t.TenantId).Returns(TestTenantId);
        var controller = new AdminUsersController(
            db,
            userManager.Object,
            roleManager.Object,
            roleSeeder,
            tenantContext.Object);

        var claims = new List<Claim>();
        if (isAuthenticated)
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()));
            if (authenticatedRole != null)
                claims.Add(new Claim(ClaimTypes.Role, authenticatedRole));
        }

        var identity = new ClaimsIdentity(isAuthenticated ? claims : null, isAuthenticated ? "TestAuth" : null);
        var principal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        return controller;
    }

    #region BootstrapAdmin - Guard Tests

    [Fact]
    public async Task BootstrapAdmin_WhenNoAdminExists_ShouldSucceed()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "newadmin@test.com",
            NormalizedEmail = "NEWADMIN@TEST.COM",
            UserName = "newadmin@test.com",
            NormalizedUserName = "NEWADMIN@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "New",
            LastName = "Admin"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        // No admin role exists yet -> FindByNameAsync returns null
        roleManagerMock
            .Setup(r => r.FindByNameAsync($"{TestTenantId}:Admin"))
            .ReturnsAsync((AppRole?)null);

        // CreateAsync for new roles succeeds
        roleManagerMock
            .Setup(r => r.CreateAsync(It.IsAny<AppRole>()))
            .ReturnsAsync(IdentityResult.Success);

        // User is not yet in any role
        userManagerMock
            .Setup(u => u.IsInRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(false);

        // AddToRoleAsync succeeds
        userManagerMock
            .Setup(u => u.AddToRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);

        // FindByNameAsync for other roles (Manager, Supervisor, User) returns null
        roleManagerMock
            .Setup(r => r.FindByNameAsync(It.Is<string>(s => s != $"{TestTenantId}:Admin")))
            .ReturnsAsync((AppRole?)null);

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: false);

        // Act
        var result = await controller.BootstrapAdmin(new BootstrapAdminRequest { Email = "newadmin@test.com" });

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var value = okResult.Value;
        value.Should().NotBeNull();

        // Verify the user was added to admin role
        userManagerMock.Verify(u => u.AddToRoleAsync(user, $"{TestTenantId}:Admin"), Times.Once);
    }

    [Fact]
    public async Task BootstrapAdmin_WhenAdminExists_AndUnauthenticated_ShouldReturnGenericBadRequest()
    {
        // Arrange — all non-success branches return the same generic 400 to prevent
        // email enumeration and tenant state leakage.
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();

        var existingAdminUser = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "existingadmin@test.com",
            NormalizedEmail = "EXISTINGADMIN@TEST.COM",
            UserName = "existingadmin@test.com",
            NormalizedUserName = "EXISTINGADMIN@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Existing",
            LastName = "Admin"
        };

        var targetUser = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "victim@test.com",
            NormalizedEmail = "VICTIM@TEST.COM",
            UserName = "victim@test.com",
            NormalizedUserName = "VICTIM@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Victim",
            LastName = "User"
        };

        db.Users.Add(existingAdminUser);
        db.Users.Add(targetUser);

        // Create admin role and assign it to existing admin
        var adminRole = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = $"{TestTenantId}:Admin",
            NormalizedName = $"{TestTenantId}:ADMIN",
            TenantId = TestTenantId,
            Description = "Admin",
            IsSystemRole = true
        };
        db.Roles.Add(adminRole);

        // Add user-role mapping directly in the db
        db.Set<IdentityUserRole<Guid>>().Add(new IdentityUserRole<Guid>
        {
            UserId = existingAdminUser.Id,
            RoleId = adminRole.Id
        });

        await db.SaveChangesAsync();

        // RoleManager returns the existing admin role
        roleManagerMock
            .Setup(r => r.FindByNameAsync($"{TestTenantId}:Admin"))
            .ReturnsAsync(adminRole);

        // Controller is NOT authenticated (anonymous request)
        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: false);

        // Act
        var result = await controller.BootstrapAdmin(new BootstrapAdminRequest { Email = "victim@test.com" });

        // Assert — same generic 400 as "user not found" (indistinguishable)
        result.Should().BeOfType<BadRequestObjectResult>();

        // Verify AddToRoleAsync was never called (escalation blocked)
        userManagerMock.Verify(u => u.AddToRoleAsync(It.IsAny<AppUser>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task BootstrapAdmin_WhenAdminExists_AndAuthenticatedAsAdmin_ShouldReturnGenericBadRequest()
    {
        // Arrange — bootstrap is permanently disabled once an admin exists.
        // Returns same generic 400 as all other failure branches.
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();

        var existingAdminUser = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "existingadmin@test.com",
            NormalizedEmail = "EXISTINGADMIN@TEST.COM",
            UserName = "existingadmin@test.com",
            NormalizedUserName = "EXISTINGADMIN@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Existing",
            LastName = "Admin"
        };

        var targetUser = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "promote@test.com",
            NormalizedEmail = "PROMOTE@TEST.COM",
            UserName = "promote@test.com",
            NormalizedUserName = "PROMOTE@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Promote",
            LastName = "Me"
        };

        db.Users.Add(existingAdminUser);
        db.Users.Add(targetUser);

        var adminRole = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = $"{TestTenantId}:Admin",
            NormalizedName = $"{TestTenantId}:ADMIN",
            TenantId = TestTenantId,
            Description = "Admin",
            IsSystemRole = true
        };
        db.Roles.Add(adminRole);

        db.Set<IdentityUserRole<Guid>>().Add(new IdentityUserRole<Guid>
        {
            UserId = existingAdminUser.Id,
            RoleId = adminRole.Id
        });

        await db.SaveChangesAsync();

        // RoleManager returns the existing admin role
        roleManagerMock
            .Setup(r => r.FindByNameAsync($"{TestTenantId}:Admin"))
            .ReturnsAsync(adminRole);

        // Controller IS authenticated as Admin — should still be denied
        var controller = CreateController(db, userManagerMock, roleManagerMock,
            isAuthenticated: true, authenticatedRole: $"{TestTenantId}:Admin");

        // Act
        var result = await controller.BootstrapAdmin(new BootstrapAdminRequest { Email = "promote@test.com" });

        // Assert — same generic 400 as all other failures (indistinguishable)
        result.Should().BeOfType<BadRequestObjectResult>();

        // Verify no role assignments were made
        userManagerMock.Verify(u => u.AddToRoleAsync(It.IsAny<AppUser>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task BootstrapAdmin_WhenUserNotFound_ShouldReturnGenericBadRequest()
    {
        // Arrange — uses a generic error to prevent email enumeration
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: false);

        // Act
        var result = await controller.BootstrapAdmin(new BootstrapAdminRequest { Email = "nobody@test.com" });

        // Assert — BadRequest, not NotFound (prevents email enumeration)
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region UpdateUser - Employee/Company Linking Tests

    private static void SetupUserManagerForUpdateTests(Mock<UserManager<AppUser>> userManagerMock)
    {
        userManagerMock
            .Setup(u => u.GetRolesAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(new List<string>());
    }

    [Fact]
    public async Task UpdateUser_WithEmployeeId_ShouldLinkEmployee()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();
        SetupUserManagerForUpdateTests(userManagerMock);

        var employeeId = Guid.NewGuid();

        // Seed an Employee entity so the tenant-scoped validation passes
        db.Set<Pitbull.TimeTracking.Domain.Employee>().Add(new Pitbull.TimeTracking.Domain.Employee
        {
            Id = employeeId,
            TenantId = TestTenantId,
            EmployeeNumber = "EMP-001",
            FirstName = "Linked",
            LastName = "Employee"
        });

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "user@test.com",
            NormalizedEmail = "USER@TEST.COM",
            UserName = "user@test.com",
            NormalizedUserName = "USER@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Test",
            LastName = "User"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: true, authenticatedRole: "Admin");

        // Act
        var result = await controller.UpdateUser(user.Id, new UpdateUserRequest
        {
            EmployeeId = employeeId
        });

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var dto = ((OkObjectResult)result).Value as AdminUserDto;
        dto.Should().NotBeNull();
        dto!.EmployeeId.Should().Be(employeeId);

        // Verify persisted
        var updatedUser = await db.Users.FindAsync(user.Id);
        updatedUser!.EmployeeId.Should().Be(employeeId);
    }

    [Fact]
    public async Task UpdateUser_WithCompanyId_ShouldLinkCompany()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();
        SetupUserManagerForUpdateTests(userManagerMock);

        var companyId = Guid.NewGuid();

        // Seed a Company entity so the tenant-scoped validation passes
        db.Companies.Add(new Pitbull.Core.Domain.Company
        {
            Id = companyId,
            TenantId = TestTenantId,
            Code = "02",
            Name = "Linked Company",
            IsActive = true
        });

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "user@test.com",
            NormalizedEmail = "USER@TEST.COM",
            UserName = "user@test.com",
            NormalizedUserName = "USER@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Test",
            LastName = "User"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: true, authenticatedRole: "Admin");

        // Act
        var result = await controller.UpdateUser(user.Id, new UpdateUserRequest
        {
            CompanyId = companyId
        });

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var dto = ((OkObjectResult)result).Value as AdminUserDto;
        dto.Should().NotBeNull();
        dto!.CompanyId.Should().Be(companyId);

        // Verify persisted
        var updatedUser = await db.Users.FindAsync(user.Id);
        updatedUser!.CompanyId.Should().Be(companyId);
    }

    [Fact]
    public async Task UpdateUser_WithEmptyEmployeeId_ShouldUnlinkEmployee()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();
        SetupUserManagerForUpdateTests(userManagerMock);

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "user@test.com",
            NormalizedEmail = "USER@TEST.COM",
            UserName = "user@test.com",
            NormalizedUserName = "USER@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Test",
            LastName = "User",
            EmployeeId = Guid.NewGuid() // Previously linked
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: true, authenticatedRole: "Admin");

        // Act — sending Guid.Empty means "unlink"
        var result = await controller.UpdateUser(user.Id, new UpdateUserRequest
        {
            EmployeeId = Guid.Empty
        });

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var dto = ((OkObjectResult)result).Value as AdminUserDto;
        dto.Should().NotBeNull();
        dto!.EmployeeId.Should().BeNull();

        // Verify persisted
        var updatedUser = await db.Users.FindAsync(user.Id);
        updatedUser!.EmployeeId.Should().BeNull();
    }

    [Fact]
    public async Task UpdateUser_WithoutEmployeeId_ShouldNotChangeExistingLink()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();
        SetupUserManagerForUpdateTests(userManagerMock);

        var existingEmployeeId = Guid.NewGuid();
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "user@test.com",
            NormalizedEmail = "USER@TEST.COM",
            UserName = "user@test.com",
            NormalizedUserName = "USER@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Test",
            LastName = "User",
            EmployeeId = existingEmployeeId
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: true, authenticatedRole: "Admin");

        // Act — not sending EmployeeId at all should leave existing link intact
        var result = await controller.UpdateUser(user.Id, new UpdateUserRequest
        {
            FirstName = "Updated"
        });

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var dto = ((OkObjectResult)result).Value as AdminUserDto;
        dto.Should().NotBeNull();
        dto!.EmployeeId.Should().Be(existingEmployeeId);
    }

    [Fact]
    public async Task UpdateUser_WithNonExistentEmployeeId_ShouldReturnBadRequest()
    {
        // Arrange — validates that linking to a non-existent employee is rejected
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();
        SetupUserManagerForUpdateTests(userManagerMock);

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "user@test.com",
            NormalizedEmail = "USER@TEST.COM",
            UserName = "user@test.com",
            NormalizedUserName = "USER@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Test",
            LastName = "User"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: true, authenticatedRole: "Admin");

        // Act — non-existent EmployeeId
        var result = await controller.UpdateUser(user.Id, new UpdateUserRequest
        {
            EmployeeId = Guid.NewGuid()
        });

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateUser_WithNonExistentCompanyId_ShouldReturnBadRequest()
    {
        // Arrange — validates that linking to a non-existent company is rejected
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();
        SetupUserManagerForUpdateTests(userManagerMock);

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "user@test.com",
            NormalizedEmail = "USER@TEST.COM",
            UserName = "user@test.com",
            NormalizedUserName = "USER@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Test",
            LastName = "User"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: true, authenticatedRole: "Admin");

        // Act — non-existent CompanyId
        var result = await controller.UpdateUser(user.Id, new UpdateUserRequest
        {
            CompanyId = Guid.NewGuid()
        });

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion
}
