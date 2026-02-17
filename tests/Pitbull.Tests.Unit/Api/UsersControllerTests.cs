using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Api;

public class UsersControllerTests
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;

    #region Helper Methods

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

    private static RoleSeeder CreateRoleSeeder(
        Mock<RoleManager<AppRole>> roleManager,
        Mock<UserManager<AppUser>> userManager,
        PitbullDbContext db)
    {
        var logger = Mock.Of<ILogger<RoleSeeder>>();
        return new RoleSeeder(roleManager.Object, userManager.Object, db, logger);
    }

    private static UsersController CreateController(
        PitbullDbContext db,
        Mock<UserManager<AppUser>> userManager,
        Mock<RoleManager<AppRole>>? roleManager = null,
        Guid? tenantId = null,
        Guid? authenticatedUserId = null)
    {
        var rmMock = roleManager ?? CreateMockRoleManager();
        var tc = new TenantContext { TenantId = tenantId ?? TestTenantId };
        var roleSeeder = CreateRoleSeeder(rmMock, userManager, db);
        var logger = Mock.Of<ILogger<UsersController>>();

        var controller = new UsersController(
            userManager.Object,
            roleSeeder,
            db,
            tc,
            logger);

        // Set up HttpContext with claims
        var claims = new List<Claim>();
        if (authenticatedUserId.HasValue)
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, authenticatedUserId.Value.ToString()));
        }

        var identity = new ClaimsIdentity(
            authenticatedUserId.HasValue ? claims : null,
            authenticatedUserId.HasValue ? "TestAuth" : null);
        var principal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        return controller;
    }

    private static AppUser CreateTestUser(
        Guid? id = null,
        string email = "test@test.com",
        string firstName = "Test",
        string lastName = "User",
        Guid? tenantId = null)
    {
        var uid = id ?? Guid.NewGuid();
        var tid = tenantId ?? TestTenantId;
        return new AppUser
        {
            Id = uid,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            TenantId = tid,
            FirstName = firstName,
            LastName = lastName,
            CreatedAt = DateTime.UtcNow
        };
    }

    #endregion

    #region ListUsers

    [Fact]
    public async Task ListUsers_ReturnsOk_WithPaginatedUsers()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var user1 = CreateTestUser(firstName: "Alice", lastName: "Smith", email: "alice@test.com");
        var user2 = CreateTestUser(firstName: "Bob", lastName: "Jones", email: "bob@test.com");
        db.Set<AppUser>().Add(user1);
        db.Set<AppUser>().Add(user2);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.ListUsers();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var listResult = okResult.Value.Should().BeOfType<ListUsersResult>().Subject;
        listResult.TotalCount.Should().Be(2);
        listResult.Page.Should().Be(1);
        listResult.PageSize.Should().Be(20);
        listResult.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task ListUsers_ReturnsUnauthorized_WhenTenantIdIsEmpty()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var controller = CreateController(db, userManager, tenantId: Guid.Empty);

        // Act
        var result = await controller.ListUsers();

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task ListUsers_SearchFilters_ByNameOrEmail()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var user1 = CreateTestUser(firstName: "Alice", lastName: "Smith", email: "alice@test.com");
        var user2 = CreateTestUser(firstName: "Bob", lastName: "Jones", email: "bob@test.com");
        var user3 = CreateTestUser(firstName: "Charlie", lastName: "Brown", email: "charlie@test.com");
        db.Set<AppUser>().Add(user1);
        db.Set<AppUser>().Add(user2);
        db.Set<AppUser>().Add(user3);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.ListUsers(search: "alice");

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var listResult = ((OkObjectResult)result).Value.Should().BeOfType<ListUsersResult>().Subject;
        listResult.TotalCount.Should().Be(1);
        listResult.Items.Should().ContainSingle();
        listResult.Items[0].FirstName.Should().Be("Alice");
    }

    [Fact]
    public async Task ListUsers_Pagination_WorksCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        // Add 5 users
        for (int i = 0; i < 5; i++)
        {
            var user = CreateTestUser(
                firstName: $"User{i:D2}",
                lastName: $"Last{i:D2}",
                email: $"user{i}@test.com");
            db.Set<AppUser>().Add(user);
        }
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManager);

        // Act - get page 2, pageSize 2
        var result = await controller.ListUsers(page: 2, pageSize: 2);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var listResult = ((OkObjectResult)result).Value.Should().BeOfType<ListUsersResult>().Subject;
        listResult.TotalCount.Should().Be(5);
        listResult.Page.Should().Be(2);
        listResult.PageSize.Should().Be(2);
        listResult.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task ListUsers_PageSize_ClampedTo1And100()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var controller = CreateController(db, userManager);

        // Act - pageSize = 0 should be clamped to 1
        var result1 = await controller.ListUsers(pageSize: 0);
        var listResult1 = ((OkObjectResult)result1).Value.Should().BeOfType<ListUsersResult>().Subject;
        listResult1.PageSize.Should().Be(1);

        // Act - pageSize = 200 should be clamped to 100
        var result2 = await controller.ListUsers(pageSize: 200);
        var listResult2 = ((OkObjectResult)result2).Value.Should().BeOfType<ListUsersResult>().Subject;
        listResult2.PageSize.Should().Be(100);
    }

    #endregion

    #region GetUser

    [Fact]
    public async Task GetUser_ReturnsOk_WithUserAndRoles()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var userId = Guid.NewGuid();
        var user = CreateTestUser(id: userId, firstName: "Alice", lastName: "Smith", email: "alice@test.com");
        db.Set<AppUser>().Add(user);
        await db.SaveChangesAsync();

        // Mock GetRolesAsync on userManager (used by RoleSeeder.GetUserRolesAsync)
        userManager.Setup(u => u.GetRolesAsync(It.Is<AppUser>(x => x.Id == userId)))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin", $"{TestTenantId}:Manager" });

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.GetUser(userId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var dto = ((OkObjectResult)result).Value.Should().BeOfType<UserDto>().Subject;
        dto.Id.Should().Be(userId);
        dto.Email.Should().Be("alice@test.com");
        dto.FirstName.Should().Be("Alice");
        dto.LastName.Should().Be("Smith");
        dto.FullName.Should().Be("Alice Smith");
        dto.Roles.Should().BeEquivalentTo(new[] { "Admin", "Manager" });
    }

    [Fact]
    public async Task GetUser_Returns404_WhenUserNotInTenant()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        // User exists in a different tenant
        var otherTenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var user = CreateTestUser(id: userId, tenantId: otherTenantId);
        db.Set<AppUser>().Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.GetUser(userId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetUser_ReturnsUnauthorized_WhenTenantIdIsEmpty()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var controller = CreateController(db, userManager, tenantId: Guid.Empty);

        // Act
        var result = await controller.GetUser(Guid.NewGuid(), CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region AssignRole

    [Fact]
    public async Task AssignRole_Success_ReturnsOkWithUpdatedRoles()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var roleManager = CreateMockRoleManager();

        var userId = Guid.NewGuid();
        var user = CreateTestUser(id: userId, email: "alice@test.com");
        db.Set<AppUser>().Add(user);
        await db.SaveChangesAsync();

        // RoleSeeder.AssignRoleToUserAsync internally calls IsInRoleAsync and AddToRoleAsync
        userManager.Setup(u => u.IsInRoleAsync(It.Is<AppUser>(x => x.Id == userId), It.IsAny<string>()))
            .ReturnsAsync(false);
        userManager.Setup(u => u.AddToRoleAsync(It.Is<AppUser>(x => x.Id == userId), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);

        // After assignment, GetUserRolesAsync returns updated roles
        userManager.Setup(u => u.GetRolesAsync(It.Is<AppUser>(x => x.Id == userId)))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin", $"{TestTenantId}:Manager" });

        var adminId = Guid.NewGuid();
        var controller = CreateController(db, userManager, roleManager: roleManager, authenticatedUserId: adminId);

        // Act
        var result = await controller.AssignRole(userId, new RoleAssignmentRequest("Manager"), CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task AssignRole_ReturnsBadRequest_ForInvalidRoleName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.AssignRole(Guid.NewGuid(), new RoleAssignmentRequest("SuperAdmin"), CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task AssignRole_Returns404_WhenUserNotInTenant()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        // User in a different tenant
        var otherTenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var user = CreateTestUser(id: userId, tenantId: otherTenantId);
        db.Set<AppUser>().Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.AssignRole(userId, new RoleAssignmentRequest("Admin"), CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task AssignRole_ReturnsUnauthorized_WhenTenantIdIsEmpty()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var controller = CreateController(db, userManager, tenantId: Guid.Empty);

        // Act
        var result = await controller.AssignRole(Guid.NewGuid(), new RoleAssignmentRequest("Admin"), CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region RemoveRole

    [Fact]
    public async Task RemoveRole_Success_ReturnsOkWithUpdatedRoles()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var userId = Guid.NewGuid();
        var adminId = Guid.NewGuid(); // Different from userId
        var user = CreateTestUser(id: userId, email: "alice@test.com");
        db.Set<AppUser>().Add(user);
        await db.SaveChangesAsync();

        var tenantRoleName = $"{TestTenantId}:Manager";
        userManager.Setup(u => u.RemoveFromRoleAsync(It.Is<AppUser>(x => x.Id == userId), tenantRoleName))
            .ReturnsAsync(IdentityResult.Success);

        // After removal, GetUserRolesAsync returns updated roles
        userManager.Setup(u => u.GetRolesAsync(It.Is<AppUser>(x => x.Id == userId)))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin" });

        var controller = CreateController(db, userManager, authenticatedUserId: adminId);

        // Act
        var result = await controller.RemoveRole(userId, "Manager", CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task RemoveRole_ReturnsBadRequest_ForInvalidRoleName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.RemoveRole(Guid.NewGuid(), "SuperAdmin", CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task RemoveRole_Returns404_WhenUserNotInTenant()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var otherTenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var user = CreateTestUser(id: userId, tenantId: otherTenantId);
        db.Set<AppUser>().Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.RemoveRole(userId, "Admin", CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task RemoveRole_PreventsRemovingOwnAdminRole()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var userId = Guid.NewGuid();
        var user = CreateTestUser(id: userId, email: "admin@test.com");
        db.Set<AppUser>().Add(user);
        await db.SaveChangesAsync();

        // Authenticated user is the same user
        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.RemoveRole(userId, "Admin", CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task RemoveRole_ReturnsBadRequest_WhenUserManagerFails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var userId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var user = CreateTestUser(id: userId, email: "alice@test.com");
        db.Set<AppUser>().Add(user);
        await db.SaveChangesAsync();

        var tenantRoleName = $"{TestTenantId}:Manager";
        userManager.Setup(u => u.RemoveFromRoleAsync(It.Is<AppUser>(x => x.Id == userId), tenantRoleName))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError
            {
                Code = "RoleError",
                Description = "User is not in role"
            }));

        var controller = CreateController(db, userManager, authenticatedUserId: adminId);

        // Act
        var result = await controller.RemoveRole(userId, "Manager", CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task RemoveRole_ReturnsUnauthorized_WhenTenantIdIsEmpty()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var controller = CreateController(db, userManager, tenantId: Guid.Empty);

        // Act
        var result = await controller.RemoveRole(Guid.NewGuid(), "Admin", CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region GetRoles

    [Fact]
    public void GetRoles_ReturnsAllRolesWithDescriptions()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var controller = CreateController(db, userManager);

        // Act
        var result = controller.GetRoles();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var roles = okResult.Value.Should().BeOfType<RoleInfo[]>().Subject;
        roles.Should().HaveCount(5);
        roles.Select(r => r.Name).Should().BeEquivalentTo(
            new[] { "Admin", "Manager", "Supervisor", "Viewer", "User" });

        // Each role should have a description
        foreach (var role in roles)
        {
            role.Description.Should().NotBeNullOrEmpty();
        }
    }

    #endregion
}
