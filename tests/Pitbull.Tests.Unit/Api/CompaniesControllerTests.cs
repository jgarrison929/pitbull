using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Infrastructure;
using Pitbull.Api.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Api;

public class CompaniesControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;
    private static readonly Guid TestCompanyId = TestDbContextFactory.TestCompanyId;

    private readonly PitbullDbContext _db;
    private readonly CompanyContext _companyContext;
    private readonly TenantContext _tenantContext;
    private readonly Mock<UserManager<AppUser>> _userManager;
    private readonly Mock<RoleManager<AppRole>> _roleManager;
    private readonly RoleSeeder _roleSeeder;
    private readonly IConfiguration _configuration;
    private readonly Mock<ICacheService> _cacheService;

    public CompaniesControllerTests()
    {
        _db = TestDbContextFactory.Create();
        _companyContext = new CompanyContext();
        _tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        _userManager = CreateMockUserManager();
        _roleManager = CreateMockRoleManager();
        _roleSeeder = CreateRoleSeeder(_roleManager, _userManager, _db);
        _configuration = CreateConfiguration();
        _cacheService = new Mock<ICacheService>();
        // Pass through to factory — no actual caching in tests
        _cacheService
            .Setup(c => c.GetOrCreateAsync(It.IsAny<string>(), It.IsAny<Func<Task<CompanyResponse?>>>(), It.IsAny<TimeSpan>()))
            .Returns<string, Func<Task<CompanyResponse?>>, TimeSpan>((_, factory, _) => factory());
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

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

    private CompaniesController CreateCompaniesController(Guid? authenticatedUserId = null)
    {
        var controller = new CompaniesController(
            _db, _tenantContext, _companyContext, _userManager.Object, _roleSeeder, _configuration, _cacheService.Object);

        var claims = new List<Claim>();
        if (authenticatedUserId.HasValue)
            claims.Add(new Claim(ClaimTypes.NameIdentifier, authenticatedUserId.Value.ToString()));

        var identity = new ClaimsIdentity(
            authenticatedUserId.HasValue ? claims : null,
            authenticatedUserId.HasValue ? "TestAuth" : null);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        return controller;
    }

    private AdminCompaniesController CreateAdminController()
    {
        var controller = new AdminCompaniesController(_db, _tenantContext, _cacheService.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private async Task<Company> SeedCompany(
        string code = "01",
        string name = "Test Company",
        bool isActive = true,
        bool isDefault = false,
        int sortOrder = 0,
        Guid? id = null)
    {
        var company = new Company
        {
            Id = id ?? Guid.NewGuid(),
            Code = code,
            Name = name,
            IsActive = isActive,
            IsDefault = isDefault,
            SortOrder = sortOrder,
            TenantId = TestTenantId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<Company>().Add(company);
        await _db.SaveChangesAsync();
        return company;
    }

    private async Task<AppUser> SeedUser(
        Guid? id = null,
        string email = "test@test.com",
        string firstName = "Test",
        string lastName = "User")
    {
        var user = new AppUser
        {
            Id = id ?? Guid.NewGuid(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            TenantId = TestTenantId,
            FirstName = firstName,
            LastName = lastName,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    private async Task<UserCompanyAccess> SeedAccess(
        Guid userId,
        Guid companyId,
        string? companyRole = null,
        bool isDefault = false)
    {
        var access = new UserCompanyAccess
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CompanyId = companyId,
            CompanyRole = companyRole,
            IsDefault = isDefault,
            TenantId = TestTenantId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<UserCompanyAccess>().Add(access);
        await _db.SaveChangesAsync();
        return access;
    }

    #endregion

    // =====================================================================
    // CompaniesController Tests
    // =====================================================================

    #region GetActive

    [Fact]
    public async Task GetActive_ReturnsCompany_WhenResolved()
    {
        // Arrange
        var company = await SeedCompany(id: TestCompanyId, code: "01", name: "Active Co");
        _companyContext.CompanyId = company.Id;

        var controller = CreateCompaniesController();

        // Act
        var result = await controller.GetActive();

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<CompanyResponse>().Subject;
        response.Id.Should().Be(company.Id);
        response.Code.Should().Be("01");
        response.Name.Should().Be("Active Co");
    }

    [Fact]
    public async Task GetActive_Returns404_WhenNotResolved()
    {
        // Arrange - CompanyId is Guid.Empty (default), so IsResolved = false
        var controller = CreateCompaniesController();

        // Act
        var result = await controller.GetActive();

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetActive_Returns404_WhenCompanyNotInDb()
    {
        // Arrange - resolved to a company ID that doesn't exist in DB
        _companyContext.CompanyId = Guid.NewGuid();

        var controller = CreateCompaniesController();

        // Act
        var result = await controller.GetActive();

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region GetAccessible

    [Fact]
    public async Task GetAccessible_ReturnsCompanies_OrderedBySortOrderThenCode()
    {
        // Arrange
        var c1 = await SeedCompany(code: "BB", name: "Beta", sortOrder: 2);
        var c2 = await SeedCompany(code: "AA", name: "Alpha", sortOrder: 1);
        var c3 = await SeedCompany(code: "AB", name: "AlphaBeta", sortOrder: 1);

        _companyContext.SetAccessibleCompanies(new[] { c1.Id, c2.Id, c3.Id });

        var controller = CreateCompaniesController();

        // Act
        var result = await controller.GetAccessible();

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var companies = (ok.Value as IEnumerable<CompanyResponse>)!.ToList();
        companies.Should().HaveCount(3);
        // SortOrder 1 first, then by Code
        companies[0].Code.Should().Be("AA");
        companies[1].Code.Should().Be("AB");
        companies[2].Code.Should().Be("BB");
    }

    [Fact]
    public async Task GetAccessible_FiltersByIsActive()
    {
        // Arrange
        var active = await SeedCompany(code: "01", name: "Active", isActive: true);
        var inactive = await SeedCompany(code: "02", name: "Inactive", isActive: false);

        _companyContext.SetAccessibleCompanies(new[] { active.Id, inactive.Id });

        var controller = CreateCompaniesController();

        // Act
        var result = await controller.GetAccessible();

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var companies = (ok.Value as IEnumerable<CompanyResponse>)!.ToList();
        companies.Should().HaveCount(1);
        companies[0].Code.Should().Be("01");
    }

    #endregion

    #region SwitchCompany

    [Fact]
    public async Task SwitchCompany_Success_ReturnsTokenAndCompany()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var company = await SeedCompany(code: "01", name: "Target Co", isActive: true);
        var user = await SeedUser(id: userId, email: "switch@test.com", firstName: "Switch", lastName: "User");

        _companyContext.SetAccessibleCompanies(new[] { company.Id });

        _userManager.Setup(u => u.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _userManager.Setup(u => u.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { $"{TestTenantId}:Admin" });

        var controller = CreateCompaniesController(authenticatedUserId: userId);

        // Act
        var result = await controller.SwitchCompany(company.Id);

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<CompanySwitchResponse>().Subject;
        response.Token.Should().NotBeNullOrEmpty();
        response.Company.Id.Should().Be(company.Id);
        response.Company.Name.Should().Be("Target Co");

        // Verify the token is a valid JWT
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(response.Token);
        jwtToken.Claims.Should().Contain(c => c.Type == "company_id" && c.Value == company.Id.ToString());
    }

    [Fact]
    public async Task SwitchCompany_Returns403_WhenUserDoesNotHaveAccess()
    {
        // Arrange
        var company = await SeedCompany(code: "01", name: "Restricted Co");
        // CompanyContext has NO accessible companies
        _companyContext.SetAccessibleCompanies(Array.Empty<Guid>());

        var controller = CreateCompaniesController(authenticatedUserId: Guid.NewGuid());

        // Act
        var result = await controller.SwitchCompany(company.Id);

        // Assert
        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task SwitchCompany_Returns404_WhenCompanyNotFoundOrInactive()
    {
        // Arrange
        var companyId = Guid.NewGuid();
        // User has access but company doesn't exist
        _companyContext.SetAccessibleCompanies(new[] { companyId });

        var controller = CreateCompaniesController(authenticatedUserId: Guid.NewGuid());

        // Act
        var result = await controller.SwitchCompany(companyId);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task SwitchCompany_Returns404_WhenCompanyIsInactive()
    {
        // Arrange
        var company = await SeedCompany(code: "01", name: "Inactive Co", isActive: false);
        _companyContext.SetAccessibleCompanies(new[] { company.Id });

        var controller = CreateCompaniesController(authenticatedUserId: Guid.NewGuid());

        // Act
        var result = await controller.SwitchCompany(company.Id);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task SwitchCompany_Returns401_WhenNoUserClaim()
    {
        // Arrange
        var company = await SeedCompany(code: "01", name: "Test Co", isActive: true);
        _companyContext.SetAccessibleCompanies(new[] { company.Id });

        // No authenticated user ID
        var controller = CreateCompaniesController(authenticatedUserId: null);

        // Act
        var result = await controller.SwitchCompany(company.Id);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    // =====================================================================
    // AdminCompaniesController Tests
    // =====================================================================

    #region Admin - List

    [Fact]
    public async Task Admin_List_ReturnsAllCompanies_OrderedBySortOrderThenCode()
    {
        // Arrange
        await SeedCompany(code: "CC", name: "Charlie", sortOrder: 2);
        await SeedCompany(code: "AA", name: "Alpha", sortOrder: 1);
        await SeedCompany(code: "BB", name: "Bravo", sortOrder: 1);

        var controller = CreateAdminController();

        // Act
        var result = await controller.List();

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var companies = (ok.Value as IEnumerable<CompanyResponse>)!.ToList();
        companies.Should().HaveCount(3);
        companies[0].Code.Should().Be("AA");
        companies[1].Code.Should().Be("BB");
        companies[2].Code.Should().Be("CC");
    }

    [Fact]
    public async Task Admin_List_IncludesInactiveCompanies()
    {
        // Arrange
        await SeedCompany(code: "01", name: "Active", isActive: true);
        await SeedCompany(code: "02", name: "Inactive", isActive: false);

        var controller = CreateAdminController();

        // Act
        var result = await controller.List();

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var companies = (ok.Value as IEnumerable<CompanyResponse>)!.ToList();
        companies.Should().HaveCount(2);
    }

    #endregion

    #region Admin - GetById

    [Fact]
    public async Task Admin_GetById_ReturnsCompany_WhenFound()
    {
        // Arrange
        var company = await SeedCompany(code: "01", name: "Found Co");
        var controller = CreateAdminController();

        // Act
        var result = await controller.GetById(company.Id);

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<CompanyResponse>().Subject;
        response.Id.Should().Be(company.Id);
        response.Code.Should().Be("01");
        response.Name.Should().Be("Found Co");
    }

    [Fact]
    public async Task Admin_GetById_Returns404_WhenNotFound()
    {
        // Arrange
        var controller = CreateAdminController();

        // Act
        var result = await controller.GetById(Guid.NewGuid());

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region Admin - Create

    [Fact]
    public async Task Admin_Create_Returns201_WithCompany()
    {
        // Arrange
        var controller = CreateAdminController();
        var request = new CreateCompanyRequest
        {
            Code = "NEW",
            Name = "New Company"
        };

        // Act
        var result = await controller.Create(request);

        // Assert
        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        var response = created.Value.Should().BeOfType<CompanyResponse>().Subject;
        response.Code.Should().Be("NEW");
        response.Name.Should().Be("New Company");
        response.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Admin_Create_Returns400_WhenCodeMissing()
    {
        // Arrange
        var controller = CreateAdminController();
        var request = new CreateCompanyRequest
        {
            Code = "",
            Name = "No Code"
        };

        // Act
        var result = await controller.Create(request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Admin_Create_Returns400_WhenNameMissing()
    {
        // Arrange
        var controller = CreateAdminController();
        var request = new CreateCompanyRequest
        {
            Code = "XX",
            Name = ""
        };

        // Act
        var result = await controller.Create(request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Admin_Create_Returns409_ForDuplicateCode()
    {
        // Arrange
        await SeedCompany(code: "DUP", name: "Existing");
        var controller = CreateAdminController();
        var request = new CreateCompanyRequest
        {
            Code = "DUP",
            Name = "Duplicate"
        };

        // Act
        var result = await controller.Create(request);

        // Assert
        result.Should().BeOfType<ConflictObjectResult>();
    }

    [Fact]
    public async Task Admin_Create_SetsDefaults()
    {
        // Arrange
        var controller = CreateAdminController();
        var request = new CreateCompanyRequest
        {
            Code = "DEF",
            Name = "Defaults Test"
        };

        // Act
        var result = await controller.Create(request);

        // Assert
        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var response = created.Value.Should().BeOfType<CompanyResponse>().Subject;
        response.Currency.Should().Be("USD");
        response.Timezone.Should().Be("America/Los_Angeles");
        response.DateFormat.Should().Be("MM/dd/yyyy");
        response.FiscalYearStartMonth.Should().Be(1);
        response.IsActive.Should().BeTrue();
        response.IsDefault.Should().BeFalse();
        response.SortOrder.Should().Be(0);
    }

    #endregion

    #region Admin - Update

    [Fact]
    public async Task Admin_Update_ReturnsUpdatedCompany()
    {
        // Arrange
        var company = await SeedCompany(code: "OLD", name: "Old Name");
        var controller = CreateAdminController();
        var request = new UpdateCompanyRequest
        {
            Code = "NEW",
            Name = "New Name",
            City = "Portland"
        };

        // Act
        var result = await controller.Update(company.Id, request);

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<CompanyResponse>().Subject;
        response.Code.Should().Be("NEW");
        response.Name.Should().Be("New Name");
        response.City.Should().Be("Portland");
    }

    [Fact]
    public async Task Admin_Update_Returns404_WhenNotFound()
    {
        // Arrange
        var controller = CreateAdminController();
        var request = new UpdateCompanyRequest { Name = "Nope" };

        // Act
        var result = await controller.Update(Guid.NewGuid(), request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Admin_Update_PartialUpdate_OnlyChangesSpecifiedFields()
    {
        // Arrange
        var company = await SeedCompany(code: "ORIG", name: "Original Name");
        var controller = CreateAdminController();

        // Only update City, leave Code and Name alone
        var request = new UpdateCompanyRequest
        {
            City = "Seattle"
        };

        // Act
        var result = await controller.Update(company.Id, request);

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<CompanyResponse>().Subject;
        response.Code.Should().Be("ORIG"); // unchanged
        response.Name.Should().Be("Original Name"); // unchanged
        response.City.Should().Be("Seattle"); // updated
    }

    #endregion

    #region Admin - Delete

    [Fact]
    public async Task Admin_Delete_DeactivatesCompany()
    {
        // Arrange
        var company = await SeedCompany(code: "DEL", name: "To Delete", isActive: true, isDefault: false);
        var controller = CreateAdminController();

        // Act
        var result = await controller.Delete(company.Id);

        // Assert
        result.Should().BeOfType<NoContentResult>();

        // Verify the company is now inactive
        var updated = await _db.Companies.FindAsync(company.Id);
        updated!.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task Admin_Delete_Returns404_WhenNotFound()
    {
        // Arrange
        var controller = CreateAdminController();

        // Act
        var result = await controller.Delete(Guid.NewGuid());

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Admin_Delete_Returns400_WhenDeletingDefaultCompany()
    {
        // Arrange
        var company = await SeedCompany(code: "DEF", name: "Default Co", isDefault: true);
        var controller = CreateAdminController();

        // Act
        var result = await controller.Delete(company.Id);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Admin - ListUsers

    [Fact]
    public async Task Admin_ListUsers_ReturnsUsersWithCompanyAccess()
    {
        // Arrange
        var company = await SeedCompany(code: "01", name: "Users Co");
        var user1 = await SeedUser(email: "user1@test.com", firstName: "Alice", lastName: "Smith");
        var user2 = await SeedUser(email: "user2@test.com", firstName: "Bob", lastName: "Jones");

        await SeedAccess(user1.Id, company.Id, companyRole: "Admin", isDefault: true);
        await SeedAccess(user2.Id, company.Id, companyRole: "User", isDefault: false);

        var controller = CreateAdminController();

        // Act
        var result = await controller.ListUsers(company.Id);

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var users = (ok.Value as IEnumerable<CompanyUserResponse>)!.ToList();
        users.Should().HaveCount(2);
        users.Should().Contain(u => u.Email == "user1@test.com" && u.CompanyRole == "Admin");
        users.Should().Contain(u => u.Email == "user2@test.com" && u.CompanyRole == "User");
    }

    #endregion

    #region Admin - GrantAccess

    [Fact]
    public async Task Admin_GrantAccess_Returns201_OnSuccess()
    {
        // Arrange
        var company = await SeedCompany(code: "01", name: "Grant Co");
        var user = await SeedUser(email: "grant@test.com");
        var controller = CreateAdminController();

        var request = new GrantCompanyAccessRequest(
            UserId: user.Id,
            CompanyRole: "User",
            IsDefault: false);

        // Act
        var result = await controller.GrantAccess(company.Id, request);

        // Assert
        var created = result.Should().BeOfType<CreatedResult>().Subject;
        created.StatusCode.Should().Be(201);

        // Verify access was created in DB
        var access = _db.UserCompanyAccess
            .FirstOrDefault(uca => uca.CompanyId == company.Id && uca.UserId == user.Id);
        access.Should().NotBeNull();
        access!.CompanyRole.Should().Be("User");
    }

    [Fact]
    public async Task Admin_GrantAccess_Returns409_ForDuplicateAccess()
    {
        // Arrange
        var company = await SeedCompany(code: "01", name: "Dup Co");
        var user = await SeedUser(email: "dup@test.com");
        await SeedAccess(user.Id, company.Id);

        var controller = CreateAdminController();
        var request = new GrantCompanyAccessRequest(UserId: user.Id);

        // Act
        var result = await controller.GrantAccess(company.Id, request);

        // Assert
        result.Should().BeOfType<ConflictObjectResult>();
    }

    #endregion

    #region Admin - RevokeAccess

    [Fact]
    public async Task Admin_RevokeAccess_Returns204_OnSuccess()
    {
        // Arrange
        var company = await SeedCompany(code: "01", name: "Revoke Co");
        var user = await SeedUser(email: "revoke@test.com");
        await SeedAccess(user.Id, company.Id);

        var controller = CreateAdminController();

        // Act
        var result = await controller.RevokeAccess(company.Id, user.Id);

        // Assert
        result.Should().BeOfType<NoContentResult>();

        // Verify access was removed
        var access = _db.UserCompanyAccess
            .FirstOrDefault(uca => uca.CompanyId == company.Id && uca.UserId == user.Id);
        access.Should().BeNull();
    }

    [Fact]
    public async Task Admin_RevokeAccess_Returns404_WhenAccessNotFound()
    {
        // Arrange
        var controller = CreateAdminController();

        // Act
        var result = await controller.RevokeAccess(Guid.NewGuid(), Guid.NewGuid());

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion
}
