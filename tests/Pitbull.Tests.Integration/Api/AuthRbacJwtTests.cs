using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Pitbull.Api.Controllers;
using Pitbull.Api.Services;
using Pitbull.Core.Constants;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

/// <summary>
/// Verifies login JWT includes RBAC permission claims resolved without tenant query-filter context
/// (regression for demo PM empty-permissions bug).
/// </summary>
[Collection(DatabaseCollection.Name)]
public sealed class AuthRbacJwtTests(PostgresFixture db) : IAsyncLifetime
{
    private PitbullApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new PitbullApiFactory(db.AppConnectionString);
        using var client = _factory.CreateClient();
        (await client.GetAsync("/health/live")).EnsureSuccessStatusCode();
    }

    public async Task DisposeAsync()
    {
        _factory.Dispose();
        await Task.CompletedTask;
    }

    [Fact]
    public async Task Login_UserWithProjectManagerRbac_IncludesBillingViewInJwt()
    {
        await db.ResetAsync();

        var email = $"pm-rbac-{Guid.NewGuid():N}@test.local";
        const string password = "SecurePass123!";

        // Open register creates a new tenant (admin). Join same-tenant PM via identity seed — not TenantId on register.
        var (adminClient, adminAuth, tenantId) = await _factory.CreateAuthenticatedClientAsync();
        var companyId = PitbullApiFactory.ExtractCompanyId(adminAuth.Token)
            ?? throw new InvalidOperationException("Admin JWT missing company_id");

        Guid pmUserId;
        using (var scope = _factory.Services.CreateScope())
        {
            var roleService = scope.ServiceProvider.GetRequiredService<IRoleService>();
            var context = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
            var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
            tenantContext.TenantId = tenantId;
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.current_tenant', {tenantId.ToString()}, false)");

            await roleService.ListRolesAsync(CancellationToken.None);

            var pmRole = await context.RbacRoles
                .FirstAsync(r => r.TenantId == tenantId && r.Name == PermissionConstants.RoleTemplates.ProjectManager);

            var userManager = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<Pitbull.Core.Domain.AppUser>>();
            var user = new Pitbull.Core.Domain.AppUser
            {
                UserName = email,
                Email = email,
                FirstName = "PM",
                LastName = "Rbac",
                TenantId = tenantId,
                Status = Pitbull.Core.Domain.UserStatus.Active,
                EmailConfirmed = true
            };
            var created = await userManager.CreateAsync(user, password);
            Assert.True(created.Succeeded, string.Join(", ", created.Errors.Select(e => e.Description)));
            pmUserId = user.Id;

            context.Set<Pitbull.Core.Domain.UserCompanyAccess>().Add(new Pitbull.Core.Domain.UserCompanyAccess
            {
                TenantId = tenantId,
                UserId = user.Id,
                CompanyId = companyId,
                IsDefault = true,
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();

            await roleService.AssignUserRoleAsync(pmUserId, pmRole.Id, CancellationToken.None);
        }

        _ = adminClient; // ensure admin client lifetime not optimized away

        var loginClient = _factory.CreateClient();
        var login = await loginClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        login.EnsureSuccessStatusCode();

        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(TestJsonOptions.Default)
            ?? throw new InvalidOperationException("Empty login body");

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(auth.Token);
        var permissions = jwt.Claims.Where(c => c.Type == "permissions").Select(c => c.Value).ToList();

        Assert.Contains(PermissionConstants.BillingView, permissions);
        Assert.Contains(PermissionConstants.TimeTrackingApprove, permissions);
    }
}
