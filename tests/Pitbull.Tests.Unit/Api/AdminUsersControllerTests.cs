using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
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
        var controller = new AdminUsersController(db, userManager.Object, roleManager.Object);

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
    public async Task BootstrapAdmin_WhenAdminExists_AndUnauthenticated_ShouldReturn403()
    {
        // Arrange
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

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        // Verify AddToRoleAsync was never called (escalation blocked)
        userManagerMock.Verify(u => u.AddToRoleAsync(It.IsAny<AppUser>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task BootstrapAdmin_WhenAdminExists_AndAuthenticatedAsAdmin_ShouldSucceed()
    {
        // Arrange
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

        // FindByNameAsync for other roles
        roleManagerMock
            .Setup(r => r.FindByNameAsync(It.Is<string>(s => s != $"{TestTenantId}:Admin")))
            .ReturnsAsync((AppRole?)null);

        roleManagerMock
            .Setup(r => r.CreateAsync(It.IsAny<AppRole>()))
            .ReturnsAsync(IdentityResult.Success);

        // Target user is not yet in any role
        userManagerMock
            .Setup(u => u.IsInRoleAsync(targetUser, It.IsAny<string>()))
            .ReturnsAsync(false);

        userManagerMock
            .Setup(u => u.AddToRoleAsync(targetUser, It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);

        // Controller IS authenticated as Admin
        var controller = CreateController(db, userManagerMock, roleManagerMock,
            isAuthenticated: true, authenticatedRole: $"{TestTenantId}:Admin");

        // Act
        var result = await controller.BootstrapAdmin(new BootstrapAdminRequest { Email = "promote@test.com" });

        // Assert
        result.Should().BeOfType<OkObjectResult>();

        // Verify the user was added to admin role
        userManagerMock.Verify(u => u.AddToRoleAsync(targetUser, $"{TestTenantId}:Admin"), Times.Once);
    }

    [Fact]
    public async Task BootstrapAdmin_WhenUserNotFound_ShouldReturn404()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManagerMock = CreateMockUserManager();
        var roleManagerMock = CreateMockRoleManager();

        var controller = CreateController(db, userManagerMock, roleManagerMock, isAuthenticated: false);

        // Act
        var result = await controller.BootstrapAdmin(new BootstrapAdminRequest { Email = "nobody@test.com" });

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion
}
