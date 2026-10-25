using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Pitbull.Api.Services;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Api;

public class JwtTokenServiceTests
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;

    private static IConfiguration CreateConfiguration() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "SuperSecretTestKeyThatIsLongEnoughForHmacSha256Algorithm!!",
                ["Jwt:Issuer"] = "TestIssuer",
                ["Jwt:Audience"] = "TestAudience",
                ["Jwt:ExpirationMinutes"] = "60"
            })
            .Build();

    [Fact]
    public async Task CreateAccessToken_IncludesDemoJobTitleAndRoleProfileClaims()
    {
        using var db = TestDbContextFactory.Create();
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "ceo@demo.local",
            NormalizedEmail = "CEO@DEMO.LOCAL",
            UserName = "ceo@demo.local",
            NormalizedUserName = "CEO@DEMO.LOCAL",
            TenantId = TestTenantId,
            FirstName = "Demo",
            LastName = "CEO",
            Title = "Chief Executive Officer",
            IsDemoUser = true,
            Status = UserStatus.Active
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var svc = new JwtTokenService(db, CreateConfiguration());
        var token = await svc.CreateAccessTokenAsync(user, new List<string> { $"{TestTenantId}:Manager" });

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().Contain(c => c.Type == "is_demo_user" && c.Value == "true");
        jwt.Claims.Should().Contain(c => c.Type == "job_title" && c.Value == "Chief Executive Officer");
        jwt.Claims.Should().Contain(c => c.Type == "role_profile");
        jwt.Claims.Should().Contain(c => c.Type == "tenant_id" && c.Value == TestTenantId.ToString());
        jwt.Claims.Should().Contain(c => c.Type == JwtRegisteredClaimNames.Jti && !string.IsNullOrEmpty(c.Value));
        // Demo users must not get wildcard solely for being demo (no Admin RBAC).
        jwt.Claims.Where(c => c.Type == "permissions").Select(c => c.Value)
            .Should().NotContain("*");
    }

    [Fact]
    public async Task CreateAccessToken_IssuesUniqueJtiPerToken()
    {
        using var db = TestDbContextFactory.Create();
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "jti@test.com",
            NormalizedEmail = "JTI@TEST.COM",
            UserName = "jti@test.com",
            NormalizedUserName = "JTI@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "J",
            LastName = "Ti",
            Status = UserStatus.Active
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var svc = new JwtTokenService(db, CreateConfiguration());
        var a = await svc.CreateAccessTokenAsync(user, new List<string>());
        var b = await svc.CreateAccessTokenAsync(user, new List<string>());
        var jtiA = new JwtSecurityTokenHandler().ReadJwtToken(a).Id;
        var jtiB = new JwtSecurityTokenHandler().ReadJwtToken(b).Id;
        // JwtSecurityToken.Id maps to jti when present
        jtiA.Should().NotBeNullOrEmpty();
        jtiB.Should().NotBeNullOrEmpty();
        jtiA.Should().NotBe(jtiB);
    }

    [Fact]
    public async Task CreateAccessToken_WithActiveCompany_SetsCompanyClaims()
    {
        using var db = TestDbContextFactory.Create();
        var companyId = Guid.NewGuid();
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "pm@test.com",
            NormalizedEmail = "PM@TEST.COM",
            UserName = "pm@test.com",
            NormalizedUserName = "PM@TEST.COM",
            TenantId = TestTenantId,
            FirstName = "Project",
            LastName = "Manager",
            Status = UserStatus.Active
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var svc = new JwtTokenService(db, CreateConfiguration());
        var token = await svc.CreateAccessTokenAsync(
            user,
            new List<string> { $"{TestTenantId}:User" },
            activeCompanyId: companyId,
            companyIds: new[] { companyId });

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().Contain(c => c.Type == "company_id" && c.Value == companyId.ToString());
        jwt.Claims.Should().Contain(c => c.Type == "company_ids" && c.Value == companyId.ToString());
    }
}
