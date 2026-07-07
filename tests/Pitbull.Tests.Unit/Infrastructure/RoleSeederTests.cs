using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Infrastructure;

public class RoleSeederTests
{
    [Fact]
    public async Task EnsureRolesForTenantAsync_IsIdempotent_DoesNotDuplicateRoles()
    {
        var tenantId = Guid.NewGuid();
        using var db = TestDbContextFactory.Create();

        var roleStore = new Mock<IRoleStore<AppRole>>();
        var roleManager = new Mock<RoleManager<AppRole>>(
            roleStore.Object, null!, null!, null!, null!);
        roleManager.Setup(r => r.CreateAsync(It.IsAny<AppRole>()))
            .Callback<AppRole>(role =>
            {
                db.Set<AppRole>().Add(role);
                db.SaveChanges();
            })
            .ReturnsAsync(IdentityResult.Success);

        var userStore = new Mock<IUserStore<AppUser>>();
        var userManager = new Mock<UserManager<AppUser>>(
            userStore.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        var seeder = new RoleSeeder(
            roleManager.Object,
            userManager.Object,
            db,
            NullLogger<RoleSeeder>.Instance);

        await seeder.EnsureRolesForTenantAsync(tenantId);
        await seeder.EnsureRolesForTenantAsync(tenantId);

        roleManager.Verify(r => r.CreateAsync(It.IsAny<AppRole>()), Times.Exactly(5));
        var stored = await db.Set<AppRole>()
            .IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId)
            .Select(r => r.Name)
            .ToListAsync();
        stored.Should().HaveCount(5);
        stored.Should().OnlyHaveUniqueItems();
        stored.Should().Contain($"{tenantId}:{RoleSeeder.Roles.Admin}");
    }
}