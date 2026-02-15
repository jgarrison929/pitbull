using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Demo;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Api;

public class AuthControllerTests
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;

    #region Helper Methods

    private static Mock<UserManager<AppUser>> CreateMockUserManager()
    {
        var store = new Mock<IUserStore<AppUser>>();
        return new Mock<UserManager<AppUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
    }

    private static Mock<SignInManager<AppUser>> CreateMockSignInManager(
        Mock<UserManager<AppUser>> userManager)
    {
        return new Mock<SignInManager<AppUser>>(
            userManager.Object,
            Mock.Of<IHttpContextAccessor>(),
            Mock.Of<IUserClaimsPrincipalFactory<AppUser>>(),
            null!, null!, null!, null!);
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

    private static IConfiguration CreateConfiguration()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "SuperSecretTestKeyThatIsLongEnoughForHmacSha256Algorithm!!",
                ["Jwt:Issuer"] = "TestIssuer",
                ["Jwt:Audience"] = "TestAudience",
                ["Jwt:ExpirationMinutes"] = "60"
            })
            .Build();
    }

    private static IOptions<DemoOptions> CreateDemoOptions(
        bool enabled = false,
        bool disableRegistration = true,
        string userEmail = "demo@pitbullconstructionsolutions.com")
    {
        return Options.Create(new DemoOptions
        {
            Enabled = enabled,
            DisableRegistration = disableRegistration,
            UserEmail = userEmail
        });
    }

    private static Mock<IValidator<RegisterRequest>> CreateRegisterValidator(bool isValid = true)
    {
        var mock = new Mock<IValidator<RegisterRequest>>();
        var result = isValid
            ? new ValidationResult()
            : new ValidationResult(new[]
            {
                new ValidationFailure("Email", "Email is required")
            });
        mock.Setup(v => v.ValidateAsync(It.IsAny<RegisterRequest>(), default))
            .ReturnsAsync(result);
        return mock;
    }

    private static Mock<IValidator<LoginRequest>> CreateLoginValidator(bool isValid = true)
    {
        var mock = new Mock<IValidator<LoginRequest>>();
        var result = isValid
            ? new ValidationResult()
            : new ValidationResult(new[]
            {
                new ValidationFailure("Email", "Email is required")
            });
        mock.Setup(v => v.ValidateAsync(It.IsAny<LoginRequest>(), default))
            .ReturnsAsync(result);
        return mock;
    }

    private static AuthController CreateController(
        PitbullDbContext db,
        Mock<UserManager<AppUser>> userManager,
        Mock<SignInManager<AppUser>>? signInManager = null,
        Mock<RoleManager<AppRole>>? roleManager = null,
        IConfiguration? configuration = null,
        IOptions<DemoOptions>? demoOptions = null,
        Mock<IValidator<RegisterRequest>>? registerValidator = null,
        Mock<IValidator<LoginRequest>>? loginValidator = null,
        TenantContext? tenantContext = null,
        Guid? authenticatedUserId = null,
        string? authenticatedUserEmail = null)
    {
        var umMock = userManager;
        var smMock = signInManager ?? CreateMockSignInManager(umMock);
        var rmMock = roleManager ?? CreateMockRoleManager();
        var config = configuration ?? CreateConfiguration();
        var demo = demoOptions ?? CreateDemoOptions();
        var regVal = registerValidator ?? CreateRegisterValidator();
        var loginVal = loginValidator ?? CreateLoginValidator();
        var tc = tenantContext ?? new TenantContext { TenantId = TestTenantId };

        var roleSeeder = CreateRoleSeeder(rmMock, umMock, db);

        var controller = new AuthController(
            umMock.Object,
            smMock.Object,
            roleSeeder,
            db,
            config,
            demo,
            regVal.Object,
            loginVal.Object,
            tc);

        // Set up HttpContext with claims
        var claims = new List<Claim>();
        if (authenticatedUserId.HasValue)
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, authenticatedUserId.Value.ToString()));
            if (authenticatedUserEmail != null)
                claims.Add(new Claim(ClaimTypes.Email, authenticatedUserEmail));
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

    #region Register - Demo Mode Disabled

    [Fact]
    public async Task Register_WhenDemoModeEnabledAndRegistrationDisabled_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var demoOptions = CreateDemoOptions(enabled: true, disableRegistration: true);

        var controller = CreateController(db, userManager, demoOptions: demoOptions);

        var request = new RegisterRequest("test@test.com", "Password1", "Test", "User");

        // Act
        var result = await controller.Register(request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Register_WhenDemoModeDisabled_DoesNotReturnNotFound()
    {
        // Arrange - demo is disabled, but we'll let it fail on validation to prove it got past demo check
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var demoOptions = CreateDemoOptions(enabled: false);
        var registerValidator = CreateRegisterValidator(isValid: false);

        var controller = CreateController(db, userManager, demoOptions: demoOptions, registerValidator: registerValidator);

        var request = new RegisterRequest("", "", "", "");

        // Act
        var result = await controller.Register(request);

        // Assert - should get BadRequest (validation), NOT NotFound (demo mode)
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Register_WhenDemoEnabledButRegistrationNotDisabled_DoesNotReturnNotFound()
    {
        // Arrange - demo enabled but registration is allowed; fails on validation
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var demoOptions = CreateDemoOptions(enabled: true, disableRegistration: false);
        var registerValidator = CreateRegisterValidator(isValid: false);

        var controller = CreateController(db, userManager, demoOptions: demoOptions, registerValidator: registerValidator);

        var request = new RegisterRequest("bad", "", "", "");

        // Act
        var result = await controller.Register(request);

        // Assert - passes demo check, fails validation
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Register - Validation Errors

    [Fact]
    public async Task Register_WithInvalidRequest_ReturnsBadRequest()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var registerValidator = CreateRegisterValidator(isValid: false);

        var controller = CreateController(db, userManager, registerValidator: registerValidator);

        var request = new RegisterRequest("", "", "", "");

        // Act
        var result = await controller.Register(request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Login - Happy Path

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsOkWithAuthResponse()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var signInManager = CreateMockSignInManager(userManager);
        var roleManager = CreateMockRoleManager();

        var user = CreateTestUser(email: "john@test.com", firstName: "John", lastName: "Doe");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByEmailAsync("john@test.com"))
            .ReturnsAsync(user);

        signInManager.Setup(s => s.CheckPasswordSignInAsync(user, "Password1", true))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);

        userManager.Setup(u => u.UpdateAsync(user))
            .ReturnsAsync(IdentityResult.Success);

        // User has Admin role
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin" });

        userManager.Setup(u => u.IsInRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(false);

        var controller = CreateController(db, userManager,
            signInManager: signInManager,
            roleManager: roleManager);

        var request = new LoginRequest("john@test.com", "Password1");

        // Act
        var result = await controller.Login(request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var response = okResult.Value.Should().BeOfType<AuthResponse>().Subject;
        response.Email.Should().Be("john@test.com");
        response.FullName.Should().Be("John Doe");
        response.UserId.Should().Be(user.Id);
        response.Token.Should().NotBeNullOrEmpty();
        response.Roles.Should().Contain("Admin");
    }

    [Fact]
    public async Task Login_UpdatesLastLoginAt()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var signInManager = CreateMockSignInManager(userManager);

        var user = CreateTestUser(email: "john@test.com");
        user.LastLoginAt = null;
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByEmailAsync("john@test.com")).ReturnsAsync(user);
        signInManager.Setup(s => s.CheckPasswordSignInAsync(user, "Password1", true))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);
        userManager.Setup(u => u.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:User" });

        var controller = CreateController(db, userManager, signInManager: signInManager);

        // Act
        await controller.Login(new LoginRequest("john@test.com", "Password1"));

        // Assert
        userManager.Verify(u => u.UpdateAsync(It.Is<AppUser>(x => x.LastLoginAt != null)), Times.Once);
    }

    #endregion

    #region Login - Invalid Credentials

    [Fact]
    public async Task Login_WithNonExistentUser_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var signInManager = CreateMockSignInManager(userManager);

        userManager.Setup(u => u.FindByEmailAsync("nobody@test.com"))
            .ReturnsAsync((AppUser?)null);

        var controller = CreateController(db, userManager, signInManager: signInManager);

        // Act
        var result = await controller.Login(new LoginRequest("nobody@test.com", "Password1"));

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var signInManager = CreateMockSignInManager(userManager);

        var user = CreateTestUser(email: "john@test.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByEmailAsync("john@test.com")).ReturnsAsync(user);
        signInManager.Setup(s => s.CheckPasswordSignInAsync(user, "WrongPass", true))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Failed);

        var controller = CreateController(db, userManager, signInManager: signInManager);

        // Act
        var result = await controller.Login(new LoginRequest("john@test.com", "WrongPass"));

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Login_WhenLockedOut_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var signInManager = CreateMockSignInManager(userManager);

        var user = CreateTestUser(email: "locked@test.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByEmailAsync("locked@test.com")).ReturnsAsync(user);
        signInManager.Setup(s => s.CheckPasswordSignInAsync(user, "Password1", true))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.LockedOut);

        var controller = CreateController(db, userManager, signInManager: signInManager);

        // Act
        var result = await controller.Login(new LoginRequest("locked@test.com", "Password1"));

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region Login - Validation Errors

    [Fact]
    public async Task Login_WithInvalidRequest_ReturnsBadRequest()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var loginValidator = CreateLoginValidator(isValid: false);

        var controller = CreateController(db, userManager, loginValidator: loginValidator);

        // Act
        var result = await controller.Login(new LoginRequest("", ""));

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Login - Role Backfill

    [Fact]
    public async Task Login_WhenUserHasNoRoles_BackfillsAdminForSingleTenantUser()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var signInManager = CreateMockSignInManager(userManager);
        var roleManager = CreateMockRoleManager();

        var user = CreateTestUser(email: "solo@test.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByEmailAsync("solo@test.com")).ReturnsAsync(user);
        signInManager.Setup(s => s.CheckPasswordSignInAsync(user, "Password1", true))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);
        userManager.Setup(u => u.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        // First call: no roles. Second call (after backfill): has Admin.
        var callCount = 0;
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(() =>
            {
                callCount++;
                return callCount <= 1
                    ? new List<string>()
                    : new List<string> { $"{TestTenantId}:Admin" };
            });

        // Role doesn't exist yet in DB
        roleManager.Setup(r => r.FindByNameAsync(It.IsAny<string>()))
            .ReturnsAsync((AppRole?)null);
        roleManager.Setup(r => r.CreateAsync(It.IsAny<AppRole>()))
            .ReturnsAsync(IdentityResult.Success);

        userManager.Setup(u => u.IsInRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(false);
        userManager.Setup(u => u.AddToRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);

        var controller = CreateController(db, userManager,
            signInManager: signInManager,
            roleManager: roleManager);

        // Act
        var result = await controller.Login(new LoginRequest("solo@test.com", "Password1"));

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var response = ((OkObjectResult)result).Value.Should().BeOfType<AuthResponse>().Subject;
        response.Roles.Should().Contain("Admin");

        // Verify admin role was assigned (the tenant-prefixed name)
        userManager.Verify(u => u.AddToRoleAsync(user, $"{TestTenantId}:Admin"), Times.Once);
    }

    [Fact]
    public async Task Login_WhenUserHasNoRoles_BackfillsUserForMultiTenantUser()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var signInManager = CreateMockSignInManager(userManager);
        var roleManager = CreateMockRoleManager();

        var user1 = CreateTestUser(email: "first@test.com");
        var user2 = CreateTestUser(email: "second@test.com");
        db.Users.Add(user1);
        db.Users.Add(user2);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByEmailAsync("second@test.com")).ReturnsAsync(user2);
        signInManager.Setup(s => s.CheckPasswordSignInAsync(user2, "Password1", true))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);
        userManager.Setup(u => u.UpdateAsync(user2)).ReturnsAsync(IdentityResult.Success);

        var callCount = 0;
        userManager.Setup(u => u.GetRolesAsync(user2))
            .ReturnsAsync(() =>
            {
                callCount++;
                return callCount <= 1
                    ? new List<string>()
                    : new List<string> { $"{TestTenantId}:User" };
            });

        roleManager.Setup(r => r.FindByNameAsync(It.IsAny<string>()))
            .ReturnsAsync((AppRole?)null);
        roleManager.Setup(r => r.CreateAsync(It.IsAny<AppRole>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.IsInRoleAsync(user2, It.IsAny<string>()))
            .ReturnsAsync(false);
        userManager.Setup(u => u.AddToRoleAsync(user2, It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);

        var controller = CreateController(db, userManager,
            signInManager: signInManager,
            roleManager: roleManager);

        // Act
        var result = await controller.Login(new LoginRequest("second@test.com", "Password1"));

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var response = ((OkObjectResult)result).Value.Should().BeOfType<AuthResponse>().Subject;
        response.Roles.Should().Contain("User");

        // Should get User role since there's more than 1 user in tenant
        userManager.Verify(u => u.AddToRoleAsync(user2, $"{TestTenantId}:User"), Times.Once);
    }

    #endregion

    #region Login - JWT Token

    [Fact]
    public async Task Login_ReturnsValidJwtToken()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var signInManager = CreateMockSignInManager(userManager);

        var user = CreateTestUser(email: "jwt@test.com", firstName: "JWT", lastName: "Test");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByEmailAsync("jwt@test.com")).ReturnsAsync(user);
        signInManager.Setup(s => s.CheckPasswordSignInAsync(user, "Password1", true))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);
        userManager.Setup(u => u.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin" });

        var controller = CreateController(db, userManager, signInManager: signInManager);

        // Act
        var result = await controller.Login(new LoginRequest("jwt@test.com", "Password1"));

        // Assert
        var response = ((OkObjectResult)result).Value.Should().BeOfType<AuthResponse>().Subject;
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(response.Token);
        jwtToken.Claims.Should().Contain(c => c.Type == "sub" && c.Value == user.Id.ToString());
        jwtToken.Claims.Should().Contain(c => c.Type == "email" && c.Value == "jwt@test.com");
        jwtToken.Claims.Should().Contain(c => c.Type == "tenant_id" && c.Value == TestTenantId.ToString());
        jwtToken.Claims.Should().Contain(c => c.Type == "full_name" && c.Value == "JWT Test");
    }

    #endregion

    #region ChangePassword - Happy Path

    [Fact]
    public async Task ChangePassword_WithValidRequest_ReturnsOkWithMessage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var user = CreateTestUser(id: userId, email: "change@test.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.ChangePasswordAsync(user, "OldPass123", "NewPass456!"))
            .ReturnsAsync(IdentityResult.Success);

        var controller = CreateController(db, userManager,
            authenticatedUserId: userId);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("OldPass123", "NewPass456!"));

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    #endregion

    #region ChangePassword - Missing Fields

    [Fact]
    public async Task ChangePassword_WithEmptyCurrentPassword_ReturnsBadRequest()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("", "NewPass456!"));

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ChangePassword_WithEmptyNewPassword_ReturnsBadRequest()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("OldPass123", ""));

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ChangePassword_WithWhitespacePasswords_ReturnsBadRequest()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("   ", "   "));

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region ChangePassword - Short New Password

    [Fact]
    public async Task ChangePassword_WithTooShortNewPassword_ReturnsBadRequest()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("OldPass123", "Short1"));

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ChangePassword_WithExactly8CharNewPassword_ProceedsPastLengthCheck()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var user = CreateTestUser(id: userId);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.ChangePasswordAsync(user, "OldPass1", "Exactly8"))
            .ReturnsAsync(IdentityResult.Success);

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("OldPass1", "Exactly8"));

        // Assert - should NOT be bad request for length; proceeds to identity check
        result.Should().BeOfType<OkObjectResult>();
    }

    #endregion

    #region ChangePassword - Unauthenticated

    [Fact]
    public async Task ChangePassword_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        // No authenticatedUserId = no claims
        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("OldPass123", "NewPass456!"));

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region ChangePassword - Wrong Current Password

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_ReturnsBadRequest()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var user = CreateTestUser(id: userId);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.ChangePasswordAsync(user, "WrongOld1", "NewPass456!"))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError
            {
                Code = "PasswordMismatch",
                Description = "Incorrect password."
            }));

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("WrongOld1", "NewPass456!"));

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region ChangePassword - User Not Found

    [Fact]
    public async Task ChangePassword_WhenUserNotFoundById_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString()))
            .ReturnsAsync((AppUser?)null);

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.ChangePassword(
            new ChangePasswordRequest("OldPass123", "NewPass456!"));

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region BootstrapAdmin - Happy Path (Demo Mode)

    [Fact]
    public async Task BootstrapAdmin_WhenDemoModeEnabled_AndDemoUser_ReturnsOkWithAuthResponse()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var roleManager = CreateMockRoleManager();
        var userId = Guid.NewGuid();
        var demoEmail = "demo@pitbullconstructionsolutions.com";

        var user = CreateTestUser(id: userId, email: demoEmail, firstName: "Demo", lastName: "User");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var demoOptions = CreateDemoOptions(enabled: true, userEmail: demoEmail);

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        // RoleSeeder interactions
        roleManager.Setup(r => r.FindByNameAsync(It.IsAny<string>()))
            .ReturnsAsync((AppRole?)null);
        roleManager.Setup(r => r.CreateAsync(It.IsAny<AppRole>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.IsInRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(false);
        userManager.Setup(u => u.AddToRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin" });

        var controller = CreateController(db, userManager,
            roleManager: roleManager,
            demoOptions: demoOptions,
            authenticatedUserId: userId,
            authenticatedUserEmail: demoEmail);

        // Act
        var result = await controller.BootstrapAdmin();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var response = ((OkObjectResult)result).Value.Should().BeOfType<AuthResponse>().Subject;
        response.Email.Should().Be(demoEmail);
        response.FullName.Should().Be("Demo User");
        response.Roles.Should().Contain("Admin");
        response.Token.Should().NotBeNullOrEmpty();
    }

    #endregion

    #region BootstrapAdmin - Demo Mode Off Returns 404

    [Fact]
    public async Task BootstrapAdmin_WhenDemoModeDisabled_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();
        var demoOptions = CreateDemoOptions(enabled: false);

        var controller = CreateController(db, userManager,
            demoOptions: demoOptions,
            authenticatedUserId: userId);

        // Act
        var result = await controller.BootstrapAdmin();

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    #endregion

    #region BootstrapAdmin - Non-Demo User Returns 403

    [Fact]
    public async Task BootstrapAdmin_WhenNotDemoUser_ReturnsForbidden()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();
        var demoOptions = CreateDemoOptions(enabled: true, userEmail: "demo@pitbullconstructionsolutions.com");

        var user = CreateTestUser(id: userId, email: "notdemo@test.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        var controller = CreateController(db, userManager,
            demoOptions: demoOptions,
            authenticatedUserId: userId);

        // Act
        var result = await controller.BootstrapAdmin();

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    #endregion

    #region BootstrapAdmin - Unauthenticated

    [Fact]
    public async Task BootstrapAdmin_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var demoOptions = CreateDemoOptions(enabled: true);

        var controller = CreateController(db, userManager, demoOptions: demoOptions);

        // Act
        var result = await controller.BootstrapAdmin();

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region BootstrapAdmin - User Not Found

    [Fact]
    public async Task BootstrapAdmin_WhenUserNotFoundById_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();
        var demoOptions = CreateDemoOptions(enabled: true);

        userManager.Setup(u => u.FindByIdAsync(userId.ToString()))
            .ReturnsAsync((AppUser?)null);

        var controller = CreateController(db, userManager,
            demoOptions: demoOptions,
            authenticatedUserId: userId);

        // Act
        var result = await controller.BootstrapAdmin();

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region BootstrapAdmin - Demo User Email Case Insensitive

    [Fact]
    public async Task BootstrapAdmin_MatchesDemoUserEmailCaseInsensitively()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var roleManager = CreateMockRoleManager();
        var userId = Guid.NewGuid();
        var demoOptions = CreateDemoOptions(enabled: true,
            userEmail: "Demo@PitbullConstructionSolutions.com");

        var user = CreateTestUser(id: userId, email: "demo@pitbullconstructionsolutions.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        roleManager.Setup(r => r.FindByNameAsync(It.IsAny<string>()))
            .ReturnsAsync((AppRole?)null);
        roleManager.Setup(r => r.CreateAsync(It.IsAny<AppRole>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.IsInRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(false);
        userManager.Setup(u => u.AddToRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin" });

        var controller = CreateController(db, userManager,
            roleManager: roleManager,
            demoOptions: demoOptions,
            authenticatedUserId: userId);

        // Act
        var result = await controller.BootstrapAdmin();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    #endregion

    #region BootstrapAdmin - Blank Demo Email Allows Any User

    [Fact]
    public async Task BootstrapAdmin_WhenDemoEmailBlank_AllowsAnyAuthenticatedUser()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var roleManager = CreateMockRoleManager();
        var userId = Guid.NewGuid();
        var demoOptions = CreateDemoOptions(enabled: true, userEmail: "");

        var user = CreateTestUser(id: userId, email: "anyuser@test.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        roleManager.Setup(r => r.FindByNameAsync(It.IsAny<string>()))
            .ReturnsAsync((AppRole?)null);
        roleManager.Setup(r => r.CreateAsync(It.IsAny<AppRole>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.IsInRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(false);
        userManager.Setup(u => u.AddToRoleAsync(user, It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin" });

        var controller = CreateController(db, userManager,
            roleManager: roleManager,
            demoOptions: demoOptions,
            authenticatedUserId: userId);

        // Act
        var result = await controller.BootstrapAdmin();

        // Assert - should succeed since demo email is blank (no restriction)
        result.Should().BeOfType<OkObjectResult>();
    }

    #endregion

    #region Me - Happy Path

    [Fact]
    public async Task Me_WhenAuthenticated_ReturnsUserProfile()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = TestTenantId,
            Name = "Test Corp",
            Slug = "test-corp",
            Status = TenantStatus.Active,
            Plan = TenantPlan.Standard
        };
        db.Set<Tenant>().Add(tenant);

        var user = CreateTestUser(id: userId, email: "me@test.com", firstName: "John", lastName: "Doe");
        db.Users.Add(user);

        var company = new Company
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            Code = "01",
            Name = "Test Company",
            IsDefault = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        };
        db.Set<Company>().Add(company);

        var access = new UserCompanyAccess
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            UserId = userId,
            CompanyId = company.Id,
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        };
        db.Set<UserCompanyAccess>().Add(access);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin", $"{TestTenantId}:Manager" });

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.GetProfile();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var profile = ((OkObjectResult)result).Value.Should().BeOfType<UserProfileResponse>().Subject;
        profile.Id.Should().Be(userId);
        profile.Email.Should().Be("me@test.com");
        profile.FirstName.Should().Be("John");
        profile.LastName.Should().Be("Doe");
        profile.FullName.Should().Be("John Doe");
        profile.TenantId.Should().Be(TestTenantId);
        profile.TenantName.Should().Be("Test Corp");
        profile.Roles.Should().BeEquivalentTo(new[] { "Admin", "Manager" });
        profile.ActiveCompany.Should().NotBeNull();
        profile.ActiveCompany!.Name.Should().Be("Test Company");
        profile.ActiveCompany.Code.Should().Be("01");
        profile.AccessibleCompanies.Should().HaveCount(1);
    }

    [Fact]
    public async Task Me_ReturnsCorrectProfileShape()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = TestTenantId,
            Name = "Acme Construction",
            Slug = "acme-construction"
        };
        db.Set<Tenant>().Add(tenant);

        var user = CreateTestUser(id: userId, email: "profile@test.com", firstName: "Jane", lastName: "Smith");
        user.CreatedAt = new DateTime(2024, 1, 15, 10, 0, 0, DateTimeKind.Utc);
        user.LastLoginAt = new DateTime(2024, 6, 1, 15, 30, 0, DateTimeKind.Utc);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:User" });

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.GetProfile();

        // Assert
        var profile = ((OkObjectResult)result).Value.Should().BeOfType<UserProfileResponse>().Subject;
        profile.CreatedAt.Should().Be(new DateTime(2024, 1, 15, 10, 0, 0, DateTimeKind.Utc));
        profile.LastLoginAt.Should().Be(new DateTime(2024, 6, 1, 15, 30, 0, DateTimeKind.Utc));
        profile.Roles.Should().ContainSingle().Which.Should().Be("User");
    }

    #endregion

    #region Me - Unauthenticated

    [Fact]
    public async Task Me_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();

        var controller = CreateController(db, userManager);

        // Act
        var result = await controller.GetProfile();

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region Me - User Not Found

    [Fact]
    public async Task Me_WhenUserNotFoundById_ReturnsUnauthorized()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString()))
            .ReturnsAsync((AppUser?)null);

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.GetProfile();

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region Me - Multiple Companies

    [Fact]
    public async Task Me_WithMultipleCompanies_ReturnsAllAccessibleCompanies()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = TestTenantId,
            Name = "Multi Corp",
            Slug = "multi-corp"
        };
        db.Set<Tenant>().Add(tenant);

        var user = CreateTestUser(id: userId, email: "multi@test.com");
        db.Users.Add(user);

        var company1 = new Company
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            Code = "01",
            Name = "Company Alpha",
            IsDefault = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        };
        var company2 = new Company
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            Code = "02",
            Name = "Company Beta",
            IsDefault = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        };
        db.Set<Company>().Add(company1);
        db.Set<Company>().Add(company2);

        db.Set<UserCompanyAccess>().Add(new UserCompanyAccess
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            UserId = userId,
            CompanyId = company1.Id,
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        });
        db.Set<UserCompanyAccess>().Add(new UserCompanyAccess
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            UserId = userId,
            CompanyId = company2.Id,
            IsDefault = false,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        });
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin" });

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.GetProfile();

        // Assert
        var profile = ((OkObjectResult)result).Value.Should().BeOfType<UserProfileResponse>().Subject;
        profile.AccessibleCompanies.Should().HaveCount(2);
        profile.AccessibleCompanies!.Select(c => c.Name).Should()
            .BeEquivalentTo(new[] { "Company Alpha", "Company Beta" });
        profile.ActiveCompany.Should().NotBeNull();
        profile.ActiveCompany!.Name.Should().Be("Company Alpha");
    }

    #endregion

    #region Me - No Companies

    [Fact]
    public async Task Me_WithNoCompanies_ReturnsNullActiveCompany()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = TestTenantId,
            Name = "Empty Corp",
            Slug = "empty-corp"
        };
        db.Set<Tenant>().Add(tenant);

        var user = CreateTestUser(id: userId, email: "nocompany@test.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string>());

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.GetProfile();

        // Assert
        var profile = ((OkObjectResult)result).Value.Should().BeOfType<UserProfileResponse>().Subject;
        profile.ActiveCompany.Should().BeNull();
        profile.AccessibleCompanies.Should().BeEmpty();
    }

    #endregion

    #region Me - Tenant Not Found

    [Fact]
    public async Task Me_WhenTenantNotInDb_ReturnsFallbackTenantName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        // Deliberately do NOT add tenant to DB
        var user = CreateTestUser(id: userId, email: "orphan@test.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string>());

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.GetProfile();

        // Assert
        var profile = ((OkObjectResult)result).Value.Should().BeOfType<UserProfileResponse>().Subject;
        profile.TenantName.Should().Be("Unknown");
    }

    #endregion

    #region Me - Deleted Companies/Access Excluded

    [Fact]
    public async Task Me_ExcludesDeletedCompaniesAndAccess()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var userManager = CreateMockUserManager();
        var userId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = TestTenantId,
            Name = "Soft Delete Corp",
            Slug = "softdelete"
        };
        db.Set<Tenant>().Add(tenant);

        var user = CreateTestUser(id: userId, email: "delete@test.com");
        db.Users.Add(user);

        var activeCompany = new Company
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            Code = "01",
            Name = "Active Co",
            IsDefault = true,
            IsActive = true,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        };
        var deletedCompany = new Company
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            Code = "02",
            Name = "Deleted Co",
            IsDefault = false,
            IsActive = true,
            IsDeleted = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        };
        db.Set<Company>().Add(activeCompany);
        db.Set<Company>().Add(deletedCompany);

        // Active access to active company
        db.Set<UserCompanyAccess>().Add(new UserCompanyAccess
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            UserId = userId,
            CompanyId = activeCompany.Id,
            IsDefault = true,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        });
        // Deleted access
        db.Set<UserCompanyAccess>().Add(new UserCompanyAccess
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            UserId = userId,
            CompanyId = deletedCompany.Id,
            IsDefault = false,
            IsDeleted = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId.ToString()
        });
        await db.SaveChangesAsync();

        userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string>());

        var controller = CreateController(db, userManager, authenticatedUserId: userId);

        // Act
        var result = await controller.GetProfile();

        // Assert
        var profile = ((OkObjectResult)result).Value.Should().BeOfType<UserProfileResponse>().Subject;
        profile.AccessibleCompanies.Should().HaveCount(1);
        profile.AccessibleCompanies!.First().Name.Should().Be("Active Co");
    }

    #endregion
}
