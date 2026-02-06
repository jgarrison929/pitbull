using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Pitbull.Api.Features.SeedData;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Demo;

/// <summary>
/// Creates/ensures a single demo tenant + demo user and seeds realistic sample data.
/// Intended to be used in a public, shared demo environment (e.g. Railway).
/// </summary>
public sealed class DemoBootstrapper(
    PitbullDbContext db,
    TenantContext tenantContext,
    UserManager<AppUser> userManager,
    RoleSeeder roleSeeder,
    IMediator mediator,
    IOptions<DemoOptions> options,
    ILogger<DemoBootstrapper> logger)
{
    public async Task EnsureSeededIfEnabledAsync(CancellationToken cancellationToken = default)
    {
        var demo = options.Value;
        if (!demo.Enabled || !demo.SeedOnStartup)
            return;

        logger.LogInformation("Demo bootstrap enabled; ensuring demo tenant + seed data");

        var tenant = await EnsureTenantAsync(demo, cancellationToken);
        await EnsureDemoUserAsync(demo, tenant.Id, cancellationToken);

        // Establish tenant context for EF audit fields.
        tenantContext.TenantId = tenant.Id;
        tenantContext.TenantName = tenant.Name;

        // IMPORTANT: app.current_tenant is a connection/session setting (used by Postgres RLS).
        // Ensure it is set on the same connection used for the seed operation.
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            "SET LOCAL app.current_tenant = @p0",
            tenant.Id.ToString());

        // Seed domain data (projects/bids/etc). This is idempotent per tenant.
        var result = await mediator.Send(new SeedDataCommand(), cancellationToken);

        if (result.IsSuccess)
        {
            await tx.CommitAsync(cancellationToken);
            logger.LogInformation("Demo seed complete: {Summary}", result.Value!.Summary);
            return;
        }

        // Treat already-seeded as success for bootstrap runs
        if (result.ErrorCode == "ALREADY_EXISTS")
        {
            await tx.CommitAsync(cancellationToken);
            logger.LogInformation("Demo seed skipped: {Message}", result.Error);
            return;
        }

        logger.LogWarning("Demo seed failed: {Code} {Message}", result.ErrorCode, result.Error);
    }

    private async Task<Tenant> EnsureTenantAsync(DemoOptions demo, CancellationToken ct)
    {
        Tenant? tenant;

        if (demo.TenantId is not null && demo.TenantId != Guid.Empty)
        {
            tenant = await db.Tenants.SingleOrDefaultAsync(t => t.Id == demo.TenantId, ct);
            if (tenant is null)
            {
                tenant = new Tenant
                {
                    Id = demo.TenantId.Value,
                    Name = demo.TenantName,
                    Slug = demo.TenantSlug,
                    Status = TenantStatus.Active,
                    Plan = TenantPlan.Standard,
                    CreatedAt = DateTime.UtcNow
                };

                db.Tenants.Add(tenant);
                await db.SaveChangesAsync(ct);

                logger.LogInformation("Created demo tenant {TenantId} ({Slug})", tenant.Id, tenant.Slug);
            }

            return tenant;
        }

        tenant = await db.Tenants.SingleOrDefaultAsync(t => t.Slug == demo.TenantSlug, ct);
        if (tenant is not null)
            return tenant;

        tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = demo.TenantName,
            Slug = demo.TenantSlug,
            Status = TenantStatus.Active,
            Plan = TenantPlan.Standard,
            CreatedAt = DateTime.UtcNow
        };

        db.Tenants.Add(tenant);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Created demo tenant {TenantId} ({Slug})", tenant.Id, tenant.Slug);
        return tenant;
    }

    private async Task EnsureDemoUserAsync(DemoOptions demo, Guid tenantId, CancellationToken ct)
    {
        // Always ensure roles exist for the tenant
        await roleSeeder.EnsureRolesForTenantAsync(tenantId, ct);

        if (string.IsNullOrWhiteSpace(demo.UserEmail))
            return;

        var user = await userManager.FindByEmailAsync(demo.UserEmail);
        var userExisted = user is not null;
        
        if (user is null)
        {
            if (string.IsNullOrWhiteSpace(demo.UserPassword))
            {
                logger.LogWarning("Demo user password not set; skipping demo user creation");
                return;
            }

            user = new AppUser
            {
                UserName = demo.UserEmail,
                Email = demo.UserEmail,
                EmailConfirmed = true,
                FirstName = demo.UserFirstName,
                LastName = demo.UserLastName,
                TenantId = tenantId,
                Type = UserType.Internal,
                Status = UserStatus.Active
            };

            var result = await userManager.CreateAsync(user, demo.UserPassword);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                logger.LogWarning("Failed to create demo user: {Errors}", errors);
                return;
            }

            logger.LogInformation("Created demo user {Email}", demo.UserEmail);
        }

        // Always ensure demo user has Admin role
        await roleSeeder.AssignRoleToUserAsync(user, RoleSeeder.Roles.Admin, ct);
        
        if (userExisted)
            logger.LogInformation("Ensured demo user {Email} has Admin role", demo.UserEmail);
    }
}
