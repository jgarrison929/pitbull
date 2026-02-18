using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Pitbull.Api.Features.SeedData;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Demo;

/// <summary>
/// Creates/ensures a single demo tenant + demo user and seeds realistic sample data.
/// Intended to be used in a public, shared demo environment (e.g. Railway).
/// </summary>
public sealed class DemoBootstrapper(
    PitbullDbContext db,
    TenantContext tenantContext,
    CompanyContext companyContext,
    UserManager<AppUser> userManager,
    RoleSeeder roleSeeder,
    ISeedDataService seedDataService,
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
        var company = await EnsureDefaultCompanyAsync(tenant.Id, tenant.Name, cancellationToken);
        await EnsureDemoUserAsync(demo, tenant.Id, company.Id, cancellationToken);

        // Establish tenant context for EF audit fields.
        tenantContext.TenantId = tenant.Id;
        tenantContext.TenantName = tenant.Name;

        // Establish company context for EF auto-set of CompanyId on ICompanyScoped entities.
        companyContext.CompanyId = company.Id;
        companyContext.CompanyCode = company.Code;
        companyContext.CompanyName = company.Name;
        companyContext.SetAccessibleCompanies([company.Id]);

        // IMPORTANT: app.current_tenant is a connection/session setting (used by Postgres RLS).
        // Ensure it is set on the same connection used for the seed operation.
        // When using NpgsqlRetryingExecutionStrategy, we must wrap user-initiated transactions
        // in an execution strategy to allow for retries on transient failures.
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            // Use set_config() which supports parameters (unlike SET LOCAL which doesn't).
            // The 'true' argument makes it local to the current transaction.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.current_tenant', {tenant.Id.ToString()}, true)");
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.current_company', {company.Id.ToString()}, true)");

            // Seed domain data (projects/bids/etc). This is idempotent per tenant.
            var result = await seedDataService.SeedAsync(cancellationToken);

            if (result.IsSuccess || result.ErrorCode == "ALREADY_EXISTS")
            {
                // Ensure demo users have Employee records (for /api/employees/my-crew)
                await EnsureDemoEmployeeRecordsAsync(demo, cancellationToken);

                await tx.CommitAsync(cancellationToken);

                if (result.IsSuccess)
                    logger.LogInformation("Demo seed complete: {Summary}", result.Value!.Summary);
                else
                    logger.LogInformation("Demo seed skipped: {Message}", result.Error);

                return;
            }

            logger.LogWarning("Demo seed failed: {Code} {Message}", result.ErrorCode, result.Error);
        });
    }

    /// <summary>
    /// Ensures a default company exists for the tenant.
    /// This is required for multi-company support - all company-scoped entities need a CompanyId.
    /// </summary>
    private async Task<Company> EnsureDefaultCompanyAsync(Guid tenantId, string tenantName, CancellationToken ct)
    {
        var company = await db.Set<Company>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.IsDefault && !c.IsDeleted, ct);

        if (company is not null)
        {
            logger.LogInformation("Default company already exists for tenant {TenantId}: {CompanyName}", tenantId, company.Name);
            return company;
        }

        company = new Company
        {
            TenantId = tenantId,
            Code = "01",
            Name = tenantName,
            IsDefault = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "system"
        };

        db.Set<Company>().Add(company);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Created default company {CompanyId} ({Code}) for tenant {TenantId}", company.Id, company.Code, tenantId);
        return company;
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

    private async Task EnsureDemoUserAsync(DemoOptions demo, Guid tenantId, Guid companyId, CancellationToken ct)
    {
        // Always ensure roles exist for the tenant
        logger.LogInformation("Ensuring roles exist for tenant {TenantId}", tenantId);
        await roleSeeder.EnsureRolesForTenantAsync(tenantId, ct);

        if (string.IsNullOrWhiteSpace(demo.UserEmail))
        {
            logger.LogWarning("Demo user email not configured; skipping demo user setup");
            return;
        }

        var user = await userManager.FindByEmailAsync(demo.UserEmail);

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
        else
        {
            logger.LogInformation("Demo user {Email} already exists (ID: {UserId}, TenantId: {TenantId})",
                demo.UserEmail, user.Id, user.TenantId);

            // Ensure demo user password stays in sync with config
            if (!string.IsNullOrWhiteSpace(demo.UserPassword))
            {
                var passwordValid = await userManager.CheckPasswordAsync(user, demo.UserPassword);
                if (!passwordValid)
                {
                    logger.LogInformation("Resetting demo user password to match config");
                    var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
                    var resetResult = await userManager.ResetPasswordAsync(user, resetToken, demo.UserPassword);
                    if (resetResult.Succeeded)
                        logger.LogInformation("Demo user password reset successfully");
                    else
                        logger.LogWarning("Failed to reset demo user password: {Errors}",
                            string.Join(", ", resetResult.Errors.Select(e => e.Description)));
                }
            }
        }

        // Ensure user has access to the default company
        await EnsureUserCompanyAccessAsync(user.Id, tenantId, companyId, ct);

        // Always ensure demo user has Admin role (even if user already existed)
        logger.LogInformation("Assigning Admin role to demo user {Email} (TenantId: {TenantId})",
            demo.UserEmail, user.TenantId);
        await roleSeeder.AssignRoleToUserAsync(user, RoleSeeder.Roles.Admin, ct);

        // Verify the role was actually assigned
        var hasAdminRole = await roleSeeder.UserHasRoleAsync(user, RoleSeeder.Roles.Admin);
        if (hasAdminRole)
        {
            logger.LogInformation("Demo user {Email} confirmed to have Admin role", demo.UserEmail);
        }
        else
        {
            logger.LogError("Demo user {Email} FAILED to get Admin role - check RoleSeeder logs", demo.UserEmail);
        }

        // The demo.UserEmail user was already handled above. If additional
        // hard-coded accounts are needed, add them via DemoOptions instead.
    }

    /// <summary>
    /// Ensures that demo user emails have corresponding Employee records so
    /// /api/employees/my-crew can resolve the supervisor by email.
    /// Must run inside the RLS transaction after seed data exists.
    /// </summary>
    private async Task EnsureDemoEmployeeRecordsAsync(DemoOptions demo, CancellationToken ct)
    {
        var demoEmail = demo.UserEmail;
        if (string.IsNullOrWhiteSpace(demoEmail))
            return;

        // Look up by EmployeeNumber (the unique key) instead of email to avoid
        // mismatches when the demo email config changes. Use IgnoreQueryFilters
        // to bypass RLS/tenant filters during bootstrap.
        const string supEmployeeNumber = "DEMO-SUP";
        var superintendent = await db.Set<Employee>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.EmployeeNumber == supEmployeeNumber && !e.IsDeleted, ct);

        if (superintendent is not null)
        {
            // Update email if demo config changed
            if (superintendent.Email != demoEmail)
            {
                logger.LogInformation("Updating DEMO-SUP email from {OldEmail} to {NewEmail}", superintendent.Email, demoEmail);
                superintendent.Email = demoEmail;
                await db.SaveChangesAsync(ct);
            }
            logger.LogInformation("Employee record already exists for {EmployeeNumber} (ID: {Id})", supEmployeeNumber, superintendent.Id);
        }
        else
        {
            superintendent = new Employee
            {
                EmployeeNumber = "DEMO-SUP",
                FirstName = demo.UserFirstName,
                LastName = demo.UserLastName,
                Email = demoEmail,
                Phone = "(555) 000-0001",
                Title = "Superintendent",
                Classification = EmployeeClassification.Supervisor,
                BaseHourlyRate = 65.00m,
                HireDate = new DateOnly(2015, 1, 15),
                IsActive = true,
                Notes = $"Demo superintendent linked to {demoEmail}"
            };

            db.Set<Employee>().Add(superintendent);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Created Employee {EmployeeNumber} ({Email})", superintendent.EmployeeNumber, demoEmail);
        }

        // Always ensure crew members point to this superintendent
        var crewNumbers = new[] { "DEMO-007", "DEMO-008", "DEMO-009", "DEMO-010", "DEMO-011", "DEMO-012", "DEMO-013", "DEMO-014" };
        var crewMembers = await db.Set<Employee>()
            .IgnoreQueryFilters()
            .Where(e => crewNumbers.Contains(e.EmployeeNumber) && !e.IsDeleted)
            .ToListAsync(ct);

        var crewRepaired = 0;
        foreach (var crew in crewMembers)
        {
            if (crew.SupervisorId != superintendent.Id)
            {
                crew.SupervisorId = superintendent.Id;
                crewRepaired++;
            }
        }

        if (crewRepaired > 0)
            await db.SaveChangesAsync(ct);

        // Always ensure superintendent is assigned to active seed projects
        var projects = await db.Set<Pitbull.Projects.Domain.Project>()
            .IgnoreQueryFilters()
            .Where(p => !p.IsDeleted && p.Status == Pitbull.Projects.Domain.ProjectStatus.Active)
            .Take(3)
            .ToListAsync(ct);

        var projectsAssigned = 0;
        foreach (var project in projects)
        {
            var alreadyAssigned = await db.Set<ProjectAssignment>()
                .IgnoreQueryFilters()
                .AnyAsync(pa => pa.EmployeeId == superintendent.Id && pa.ProjectId == project.Id && !pa.IsDeleted, ct);

            if (!alreadyAssigned)
            {
                db.Set<ProjectAssignment>().Add(new ProjectAssignment
                {
                    EmployeeId = superintendent.Id,
                    ProjectId = project.Id,
                    StartDate = new DateOnly(2025, 1, 1),
                    IsActive = true,
                    Role = AssignmentRole.Supervisor,
                    Notes = "Demo superintendent"
                });
                projectsAssigned++;
            }
        }

        if (projectsAssigned > 0)
            await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Demo employee {Email}: {CrewCount} crew linked ({Repaired} repaired), {ProjectCount} project assignments ({NewAssigned} new)",
            demoEmail, crewMembers.Count, crewRepaired, projects.Count, projectsAssigned);
    }

    /// <summary>
    /// Ensures the user has access to the specified company.
    /// </summary>
    private async Task EnsureUserCompanyAccessAsync(Guid userId, Guid tenantId, Guid companyId, CancellationToken ct)
    {
        var existingAccess = await db.Set<UserCompanyAccess>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(uca => uca.UserId == userId && uca.CompanyId == companyId && !uca.IsDeleted, ct);

        if (existingAccess is not null)
        {
            logger.LogInformation("User {UserId} already has access to company {CompanyId}", userId, companyId);
            return;
        }

        var access = new UserCompanyAccess
        {
            TenantId = tenantId,
            UserId = userId,
            CompanyId = companyId,
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "system"
        };

        db.Set<UserCompanyAccess>().Add(access);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Granted user {UserId} access to company {CompanyId}", userId, companyId);
    }
}
