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
        var allCompanies = await EnsureSubsidiaryCompaniesAsync(tenant.Id, company, cancellationToken);
        await EnsureDemoUserAsync(demo, tenant.Id, company.Id, cancellationToken);
        await EnsureAllDemoUsersAsync(tenant.Id, allCompanies, demo.UserPassword, cancellationToken);

        // Grant all-company access to any user missing it (fixes users who registered
        // via standard /register before we added demo-aware multi-company access).
        await GrantAllCompanyAccessToAllUsersAsync(tenant.Id, allCompanies, cancellationToken);

        // Establish tenant context for EF audit fields.
        tenantContext.TenantId = tenant.Id;
        tenantContext.TenantName = tenant.Name;

        // Establish company context for EF auto-set of CompanyId on ICompanyScoped entities.
        companyContext.CompanyId = company.Id;
        companyContext.CompanyCode = company.Code;
        companyContext.CompanyName = company.Name;
        companyContext.SetAccessibleCompanies(allCompanies.Values.Select(c => c.Id));

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
            // useExternalTransaction: true — we already have a transaction with RLS set_config.
            // SeedAsync must NOT start a nested transaction or it will throw.
            var result = await seedDataService.SeedAsync(cancellationToken, useExternalTransaction: true);

            if (result.IsSuccess || result.ErrorCode == "ALREADY_EXISTS")
            {
                // Ensure demo users have Employee records (for /api/employees/my-crew)
                await EnsureDemoEmployeeRecordsAsync(demo, cancellationToken);
                await EnsureAllDemoEmployeesAsync(allCompanies, cancellationToken);

                // Assign PM-level and executive demo users to seed projects
                await EnsureDemoProjectAssignmentsAsync(cancellationToken);

                // Dismiss onboarding checklists for demo users so the wizard doesn't show
                var undismissedChecklists = await db.Set<OnboardingChecklist>()
                    .Where(c => !c.Dismissed)
                    .ToListAsync(cancellationToken);

                foreach (var cl in undismissedChecklists)
                    cl.Dismissed = true;

                if (undismissedChecklists.Count > 0)
                {
                    await db.SaveChangesAsync(cancellationToken);
                    logger.LogInformation("Dismissed {Count} onboarding checklists for demo users", undismissedChecklists.Count);
                }

                await tx.CommitAsync(cancellationToken);

                if (result.IsSuccess)
                    logger.LogInformation("Demo seed complete: {Summary}", result.Value!.Summary);
                else
                    logger.LogInformation("Demo seed skipped: {Message}", result.Error);

                return;
            }

            logger.LogWarning("Demo seed failed: {Code} {Message}", result.ErrorCode, result.Error);
        });

        // Post-seed maintenance: keep time entry dates current so dashboard KPIs have data
        await RefreshTimeEntryDatesAsync(tenant.Id, cancellationToken);

        // Fix retention model: retention is held on contract value from execution, not accumulated per billing.
        // Billings are paid in full; retention is a separate hold released only at closeout.
        await FixRetentionModelAsync(tenant.Id, cancellationToken);
    }

    /// <summary>
    /// Corrects the retention model on all subcontracts:
    /// - Active/InProgress/Complete: RetainageHeld = CurrentValue × RetainagePercent / 100
    /// - ClosedOut: RetainageHeld = 0 (released)
    /// - PaidToDate = BilledToDate (billings paid in full; retention is a separate hold)
    /// Idempotent — runs every startup and only updates rows that need fixing.
    /// </summary>
    private async Task FixRetentionModelAsync(Guid tenantId, CancellationToken ct)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.current_tenant', {tenantId.ToString()}, true)", ct);

            // Fix active/in-progress/complete: retention = % of contract value, paid = billed
            var fixedActive = await db.Database.ExecuteSqlRawAsync(@"
                UPDATE ""Subcontracts""
                SET ""RetainageHeld"" = ROUND(""CurrentValue"" * ""RetainagePercent"" / 100, 2),
                    ""PaidToDate"" = ""BilledToDate""
                WHERE ""TenantId"" = {0}
                  AND ""IsDeleted"" = false
                  AND ""Status"" != 4
                  AND (""RetainageHeld"" != ROUND(""CurrentValue"" * ""RetainagePercent"" / 100, 2)
                       OR ""PaidToDate"" != ""BilledToDate"")",
                [tenantId], ct);

            // Fix closed-out: retention released, fully paid
            var fixedClosed = await db.Database.ExecuteSqlRawAsync(@"
                UPDATE ""Subcontracts""
                SET ""RetainageHeld"" = 0,
                    ""PaidToDate"" = ""BilledToDate""
                WHERE ""TenantId"" = {0}
                  AND ""IsDeleted"" = false
                  AND ""Status"" = 4
                  AND (""RetainageHeld"" != 0 OR ""PaidToDate"" != ""BilledToDate"")",
                [tenantId], ct);

            // Also fix RetentionHold records to match
            var fixedHolds = await db.Database.ExecuteSqlRawAsync(@"
                UPDATE ""RetentionHolds"" rh
                SET ""RetainedAmount"" = ROUND(s.""CurrentValue"" * s.""RetainagePercent"" / 100, 2),
                    ""ReleasedAmount"" = CASE WHEN s.""Status"" = 4
                        THEN ROUND(s.""CurrentValue"" * s.""RetainagePercent"" / 100, 2)
                        ELSE 0 END
                FROM ""Subcontracts"" s
                WHERE rh.""ContractId"" = s.""Id""
                  AND s.""TenantId"" = {0}
                  AND s.""IsDeleted"" = false",
                [tenantId], ct);

            await tx.CommitAsync(ct);

            if (fixedActive + fixedClosed > 0)
                logger.LogInformation(
                    "Fixed retention model: {Active} active/complete + {Closed} closed-out subcontracts updated, {Holds} retention holds corrected",
                    fixedActive, fixedClosed, fixedHolds);
        });
    }

    /// <summary>
    /// Shifts all time entry dates forward so the newest entry is "today".
    /// This keeps dashboard KPIs (Hours This Week, Hours Last Week) populated
    /// even when the DB was seeded days/weeks ago.
    /// </summary>
    private async Task RefreshTimeEntryDatesAsync(Guid tenantId, CancellationToken ct)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.current_tenant', {tenantId.ToString()}, true)", ct);

            var maxDate = await db.Set<TimeEntry>()
                .AsNoTracking()
                .OrderByDescending(te => te.Date)
                .Select(te => (DateOnly?)te.Date)
                .FirstOrDefaultAsync(ct);

            if (maxDate is null)
            {
                await tx.CommitAsync(ct);
                return;
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var offsetDays = today.DayNumber - maxDate.Value.DayNumber;

            if (offsetDays <= 0)
            {
                await tx.CommitAsync(ct);
                return;
            }

            var updated = await db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE time_entries SET \"Date\" = \"Date\" + {offsetDays} WHERE \"TenantId\" = {tenantId} AND \"IsDeleted\" = false", ct);

            await tx.CommitAsync(ct);
            logger.LogInformation("Refreshed time entry dates: shifted {Updated} rows forward by {Days} days", updated, offsetDays);
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
        // Scope by TenantId to prevent cross-tenant lookups in multi-tenant deployments.
        var currentTenantId = tenantContext.TenantId;
        const string supEmployeeNumber = "DEMO-SUP";
        var superintendent = await db.Set<Employee>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.TenantId == currentTenantId && e.EmployeeNumber == supEmployeeNumber && !e.IsDeleted, ct);

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
            .Where(e => e.TenantId == currentTenantId && crewNumbers.Contains(e.EmployeeNumber) && !e.IsDeleted)
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
            .Where(p => p.TenantId == currentTenantId && !p.IsDeleted && p.Status == Pitbull.Projects.Domain.ProjectStatus.Active)
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
    /// Grants all-company access to every user in the tenant that's missing it.
    /// Fixes users who registered via standard /register before demo-aware multi-company access.
    /// </summary>
    private async Task GrantAllCompanyAccessToAllUsersAsync(
        Guid tenantId,
        Dictionary<string, Company> allCompanies,
        CancellationToken ct)
    {
        var allUsers = await userManager.Users
            .Where(u => u.TenantId == tenantId)
            .Select(u => u.Id)
            .ToListAsync(ct);

        var existingAccess = await db.Set<UserCompanyAccess>()
            .IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId)
            .Select(a => new { a.UserId, a.CompanyId })
            .ToListAsync(ct);

        var accessLookup = existingAccess.Select(a => (a.UserId, a.CompanyId)).ToHashSet();
        var added = 0;

        foreach (var userId in allUsers)
        {
            foreach (var company in allCompanies.Values)
            {
                if (!accessLookup.Contains((userId, company.Id)))
                {
                    db.Set<UserCompanyAccess>().Add(new UserCompanyAccess
                    {
                        TenantId = tenantId,
                        UserId = userId,
                        CompanyId = company.Id,
                        IsDefault = false,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = "demo-bootstrap-fix"
                    });
                    added++;
                }
            }
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Granted {Count} missing company access records to {Users} users", added, allUsers.Count);
        }
    }

    /// <summary>
    /// Ensures the user has access to the specified company.
    /// </summary>
    private async Task EnsureUserCompanyAccessAsync(Guid userId, Guid tenantId, Guid companyId, CancellationToken ct, bool isDefault = true)
    {
        // Check for any existing record, including soft-deleted ones.
        // Scope by tenantId to prevent cross-tenant lookups.
        var existingAccess = await db.Set<UserCompanyAccess>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(uca => uca.TenantId == tenantId && uca.UserId == userId && uca.CompanyId == companyId, ct);

        if (existingAccess is not null)
        {
            if (existingAccess.IsDeleted)
            {
                // Revive soft-deleted record instead of creating a duplicate
                existingAccess.IsDeleted = false;
                existingAccess.DeletedAt = null;
                existingAccess.DeletedBy = null;
                existingAccess.IsDefault = isDefault;
                existingAccess.UpdatedAt = DateTime.UtcNow;
                existingAccess.UpdatedBy = "system";
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Revived soft-deleted company access for user {UserId} to company {CompanyId}", userId, companyId);
            }
            return;
        }

        var access = new UserCompanyAccess
        {
            TenantId = tenantId,
            UserId = userId,
            CompanyId = companyId,
            IsDefault = isDefault,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "system"
        };

        db.Set<UserCompanyAccess>().Add(access);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Granted user {UserId} access to company {CompanyId}", userId, companyId);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Multi-company + ~45 role-based demo accounts
    // ────────────────────────────────────────────────────────────────────────

    private const string ParentCode = "01";
    private const string WaterInfraCode = "02";   // Summit Water Infrastructure — civil/water GC ($400M)
    private const string HighwayCode = "03";       // Summit Highway Division — heavy highway GC/sub ($40M)
    private const string ElectricalCode = "04";    // Summit Electric Co. — electrical sub ($30M)

    private static readonly string[] AllCompanyCodes = [ParentCode, WaterInfraCode, HighwayCode, ElectricalCode];

    /// <summary>
    /// A single demo user definition: identity, role, employee info, and company access.
    /// </summary>
    private record DemoUserDef(
        string Email,
        string FirstName,
        string LastName,
        string Title,
        string Role,
        string EmployeeNumber,
        EmployeeClassification Classification,
        decimal HourlyRate,
        string DefaultCompanyCode,
        string[] CompanyCodes);

    // ── C-Suite ──────────────────────────────────────────────────────────
    // All get Admin role + access to every company.

    private static readonly DemoUserDef[] DemoUsers =
    [
        // C-Suite (11)
        new("ceo@demo.example.com",           "Richard",   "Morrison",   "Chief Executive Officer",          RoleSeeder.Roles.Admin,      "DEMO-CEO",   EmployeeClassification.Salaried,   250.00m, ParentCode, AllCompanyCodes),
        new("coo@demo.example.com",           "Patricia",  "Chen",       "Chief Operating Officer",          RoleSeeder.Roles.Admin,      "DEMO-COO",   EmployeeClassification.Salaried,   225.00m, ParentCode, AllCompanyCodes),
        new("cfo@demo.example.com",           "David",     "Blackwell",  "Chief Financial Officer",          RoleSeeder.Roles.Admin,      "DEMO-CFO",   EmployeeClassification.Salaried,   225.00m, ParentCode, AllCompanyCodes),
        new("cao@demo.example.com",           "Sandra",    "Martinez",   "Chief Administrative Officer",     RoleSeeder.Roles.Admin,      "DEMO-CAO",   EmployeeClassification.Salaried,   200.00m, ParentCode, AllCompanyCodes),
        new("cio@demo.example.com",           "James",     "Tanaka",     "Chief Information Officer",        RoleSeeder.Roles.Admin,      "DEMO-CIO",   EmployeeClassification.Salaried,   200.00m, ParentCode, AllCompanyCodes),
        new("cto@demo.example.com",           "Andrew",    "Foster",     "Chief Technology Officer",         RoleSeeder.Roles.Admin,      "DEMO-CTO",   EmployeeClassification.Salaried,   200.00m, ParentCode, AllCompanyCodes),
        new("ciso@demo.example.com",          "Michelle",  "Okonjo",     "Chief Information Security Officer", RoleSeeder.Roles.Admin,    "DEMO-CISO",  EmployeeClassification.Salaried,   190.00m, ParentCode, AllCompanyCodes),
        new("cro@demo.example.com",           "Robert",    "Garrison",   "Chief Revenue Officer",            RoleSeeder.Roles.Admin,      "DEMO-CRO",   EmployeeClassification.Salaried,   200.00m, ParentCode, AllCompanyCodes),
        new("cpo@demo.example.com",           "Lisa",      "Nguyen",     "Chief People Officer",             RoleSeeder.Roles.Admin,      "DEMO-CPO",   EmployeeClassification.Salaried,   190.00m, ParentCode, AllCompanyCodes),
        new("safety-chief@demo.example.com",  "Thomas",    "Reeves",     "Chief Safety Officer",             RoleSeeder.Roles.Admin,      "DEMO-CSO",   EmployeeClassification.Salaried,   175.00m, ParentCode, AllCompanyCodes),
        new("cos@demo.example.com",           "Jennifer",  "Blake",      "Chief of Staff",                   RoleSeeder.Roles.Admin,      "DEMO-COS",   EmployeeClassification.Salaried,   175.00m, ParentCode, AllCompanyCodes),

        // VP Level (8) — Manager role, access to all companies
        new("vp-legal@demo.example.com",      "Catherine", "Holloway",   "VP of Legal",                      RoleSeeder.Roles.Manager,    "DEMO-VPL",   EmployeeClassification.Salaried,   165.00m, ParentCode, AllCompanyCodes),
        new("vp-hr@demo.example.com",         "Maria",     "Vasquez",    "VP of HR",                         RoleSeeder.Roles.Manager,    "DEMO-VPHR",  EmployeeClassification.Salaried,   155.00m, ParentCode, AllCompanyCodes),
        new("vp-it@demo.example.com",         "Kevin",     "Park",       "VP of IT",                         RoleSeeder.Roles.Manager,    "DEMO-VPIT",  EmployeeClassification.Salaried,   155.00m, ParentCode, AllCompanyCodes),
        new("vp-innovation@demo.example.com",  "Sarah",    "Lindgren",   "VP of Innovation",                 RoleSeeder.Roles.Manager,    "DEMO-VPIN",  EmployeeClassification.Salaried,   150.00m, ParentCode, AllCompanyCodes),
        new("vp-estimating@demo.example.com",  "Michael",  "DeLuca",     "VP of Estimating",                 RoleSeeder.Roles.Manager,    "DEMO-VPES",  EmployeeClassification.Salaried,   160.00m, ParentCode, AllCompanyCodes),
        new("vp-ops@demo.example.com",         "Brian",    "Kowalski",   "VP of Operations",                 RoleSeeder.Roles.Manager,    "DEMO-VPOP",  EmployeeClassification.Salaried,   160.00m, ParentCode, AllCompanyCodes),
        new("vp-accounting@demo.example.com",  "Angela",   "Washington", "VP of Accounting",                 RoleSeeder.Roles.Manager,    "DEMO-VPAC",  EmployeeClassification.Salaried,   155.00m, ParentCode, AllCompanyCodes),
        new("vp-controller@demo.example.com",  "Diane",    "Schmidt",    "VP Controller",                    RoleSeeder.Roles.Manager,    "DEMO-VPCR",  EmployeeClassification.Salaried,   155.00m, ParentCode, AllCompanyCodes),

        // Sr Director Level (6) — Manager role, parent company only
        new("sr-dir-accounting@demo.example.com", "Nancy",  "Fielding",  "Sr Director of Accounting",        RoleSeeder.Roles.Manager,    "DEMO-SDA",   EmployeeClassification.Salaried,   120.00m, ParentCode, [ParentCode]),
        new("sr-dir-hr@demo.example.com",         "Rachel", "Torres",    "Sr Director of HR",                RoleSeeder.Roles.Manager,    "DEMO-SDH",   EmployeeClassification.Salaried,   115.00m, ParentCode, [ParentCode]),
        new("sr-dir-legal@demo.example.com",      "Mark",   "Jennings",  "Sr Director of Legal/Risk",        RoleSeeder.Roles.Manager,    "DEMO-SDL",   EmployeeClassification.Salaried,   120.00m, ParentCode, [ParentCode]),
        new("sr-dir-it@demo.example.com",         "Daniel", "Rossi",     "Sr Director of IT",                RoleSeeder.Roles.Manager,    "DEMO-SDI",   EmployeeClassification.Salaried,   115.00m, ParentCode, [ParentCode]),
        new("sr-dir-innovation@demo.example.com", "Priya",  "Patel",     "Sr Director of Innovation",        RoleSeeder.Roles.Manager,    "DEMO-SDN",   EmployeeClassification.Salaried,   110.00m, ParentCode, [ParentCode]),
        new("sr-dir-safety@demo.example.com",     "Carlos", "Mendez",    "Sr Director of Safety",            RoleSeeder.Roles.Manager,    "DEMO-SDS",   EmployeeClassification.Salaried,   110.00m, ParentCode, [ParentCode]),

        // Manager Level (6) — Manager role, parent company only
        new("mgr-accounting@demo.example.com",  "Karen",    "Liu",       "Accounting Manager",               RoleSeeder.Roles.Manager,    "DEMO-MA",    EmployeeClassification.Salaried,    95.00m, ParentCode, [ParentCode]),
        new("mgr-hr@demo.example.com",          "Trevor",   "Banks",     "HR Manager",                       RoleSeeder.Roles.Manager,    "DEMO-MH",    EmployeeClassification.Salaried,    90.00m, ParentCode, [ParentCode]),
        new("mgr-it@demo.example.com",          "Scott",    "Yamamoto",  "IT Manager",                       RoleSeeder.Roles.Manager,    "DEMO-MI",    EmployeeClassification.Salaried,    90.00m, ParentCode, [ParentCode]),
        new("mgr-safety@demo.example.com",      "Rosa",     "Alvarez",   "Safety Manager",                   RoleSeeder.Roles.Manager,    "DEMO-MS",    EmployeeClassification.Salaried,    85.00m, ParentCode, [ParentCode]),
        new("mgr-payroll@demo.example.com",     "Amy",      "Cooper",    "Payroll Manager",                  RoleSeeder.Roles.Manager,    "DEMO-MP",    EmployeeClassification.Salaried,    85.00m, ParentCode, [ParentCode]),
        new("mgr-purchasing@demo.example.com",  "Derek",    "Olson",     "Purchasing Manager",               RoleSeeder.Roles.Manager,    "DEMO-MPU",   EmployeeClassification.Salaried,    85.00m, ParentCode, [ParentCode, ElectricalCode]),

        // Staff Level (5) — User role, parent company only
        new("staff-accountant@demo.example.com", "Jessica",  "Tran",     "Staff Accountant",                 RoleSeeder.Roles.User,       "DEMO-SA",    EmployeeClassification.Salaried,    55.00m, ParentCode, [ParentCode]),
        new("ap-clerk@demo.example.com",         "Brandon",  "Wells",    "AP Clerk",                         RoleSeeder.Roles.User,       "DEMO-APC",   EmployeeClassification.Hourly,      38.00m, ParentCode, [ParentCode]),
        new("ar-clerk@demo.example.com",         "Megan",    "O'Brien",  "AR Clerk",                         RoleSeeder.Roles.User,       "DEMO-ARC",   EmployeeClassification.Hourly,      38.00m, ParentCode, [ParentCode]),
        new("payroll-clerk@demo.example.com",    "Tyler",    "Jackson",  "Payroll Clerk",                    RoleSeeder.Roles.User,       "DEMO-PRC",   EmployeeClassification.Hourly,      36.00m, ParentCode, [ParentCode]),
        new("hr-coordinator@demo.example.com",   "Samantha", "Cruz",     "HR Coordinator",                   RoleSeeder.Roles.User,       "DEMO-HRC",   EmployeeClassification.Hourly,      35.00m, ParentCode, [ParentCode]),

        // Project/Field — Sr Leadership (4) — Manager role, Summit Water Infrastructure
        new("sr-project-exec@demo.example.com",  "William",  "Hartley",  "Sr Project Executive",             RoleSeeder.Roles.Manager,    "DEMO-SPE",   EmployeeClassification.Salaried,   145.00m, WaterInfraCode, [WaterInfraCode]),
        new("project-exec@demo.example.com",     "Christine","Novak",    "Project Executive",                RoleSeeder.Roles.Manager,    "DEMO-PEX",   EmployeeClassification.Salaried,   130.00m, WaterInfraCode, [WaterInfraCode]),
        new("chief-estimator@demo.example.com",  "Paul",     "Bergstrom","Chief Estimator",                  RoleSeeder.Roles.Manager,    "DEMO-CE",    EmployeeClassification.Salaried,   125.00m, WaterInfraCode, [WaterInfraCode, HighwayCode]),
        new("chief-engineer@demo.example.com",   "Laura",    "Kim",      "Chief Engineer",                   RoleSeeder.Roles.Manager,    "DEMO-CHE",   EmployeeClassification.Salaried,   125.00m, WaterInfraCode, [WaterInfraCode, ElectricalCode]),

        // Project/Field — Project Management (7) — Supervisor role, Summit Water Infrastructure
        new("sr-pm@demo.example.com",            "Marcus",   "Williams", "Sr Project Manager",               RoleSeeder.Roles.Supervisor, "DEMO-SPM",   EmployeeClassification.Salaried,    95.00m, WaterInfraCode, [WaterInfraCode]),
        new("pm@demo.example.com",               "Ashley",   "Rodriguez","Project Manager",                  RoleSeeder.Roles.Supervisor, "DEMO-PM",    EmployeeClassification.Salaried,    85.00m, WaterInfraCode, [WaterInfraCode]),
        new("project-coord@demo.example.com",    "Natalie",  "Dunn",     "Project Coordinator",              RoleSeeder.Roles.User,       "DEMO-PC",    EmployeeClassification.Salaried,    55.00m, WaterInfraCode, [WaterInfraCode]),
        new("sr-project-eng@demo.example.com",   "Ryan",     "Mitchell", "Sr Project Engineer",              RoleSeeder.Roles.Supervisor, "DEMO-SPG",   EmployeeClassification.Salaried,    80.00m, WaterInfraCode, [WaterInfraCode]),
        new("project-eng@demo.example.com",      "Jasmine",  "Okafor",   "Project Engineer",                 RoleSeeder.Roles.User,       "DEMO-PEG",   EmployeeClassification.Salaried,    65.00m, WaterInfraCode, [WaterInfraCode]),
        new("field-eng@demo.example.com",        "Cody",     "Larsen",   "Field Engineer",                   RoleSeeder.Roles.User,       "DEMO-FE",    EmployeeClassification.Hourly,      48.00m, HighwayCode,    [WaterInfraCode, HighwayCode]),
        new("commissioning@demo.example.com",    "Evan",     "Phillips", "Commissioning Officer",            RoleSeeder.Roles.Supervisor, "DEMO-COM",   EmployeeClassification.Salaried,    75.00m, ElectricalCode, [WaterInfraCode, ElectricalCode]),

        // Estimating (2) — User role, Summit Highway Division (bidding lots of small jobs)
        new("sr-estimator@demo.example.com",     "Gregory",  "Townsend", "Sr Estimator",                     RoleSeeder.Roles.User,       "DEMO-SES",   EmployeeClassification.Salaried,    80.00m, HighwayCode, [HighwayCode]),
        new("estimator@demo.example.com",        "Hannah",   "Stewart",  "Estimator",                        RoleSeeder.Roles.User,       "DEMO-EST",   EmployeeClassification.Salaried,    60.00m, HighwayCode, [HighwayCode]),
    ];

    /// <summary>
    /// Creates/ensures 3 subsidiary companies alongside the existing parent company.
    /// Returns a dictionary of Code → Company for all 4 companies.
    /// </summary>
    private async Task<Dictionary<string, Company>> EnsureSubsidiaryCompaniesAsync(
        Guid tenantId, Company parentCompany, CancellationToken ct)
    {
        // Ensure the parent company has the right name for the demo org chart
        if (parentCompany.Name != "Summit Builders Group")
        {
            parentCompany.Name = "Summit Builders Group";
            parentCompany.ShortName = "PBG";
            parentCompany.IndustryType = "general-contractor";
            parentCompany.State = "CA";
            parentCompany.City = "Sacramento";
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Updated parent company name to Summit Builders Group");
        }

        var result = new Dictionary<string, Company> { [ParentCode] = parentCompany };

        var subsidiaries = new[]
        {
            (Code: WaterInfraCode, Name: "Summit Water Infrastructure", ShortName: "PWI"),
            (Code: HighwayCode,    Name: "Summit Highway Division",      ShortName: "VHD"),
            (Code: ElectricalCode, Name: "Summit Electric Co.",      ShortName: "CVE"),
        };

        foreach (var (code, name, shortName) in subsidiaries)
        {
            var company = await db.Set<Company>()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Code == code && !c.IsDeleted, ct);

            if (company is not null)
            {
                // Update name/shortname if the company was created with old values
                if (company.Name != name || company.ShortName != shortName)
                {
                    company.Name = name;
                    company.ShortName = shortName;
                    await db.SaveChangesAsync(ct);
                    logger.LogInformation("Updated subsidiary {Code} name to {Name} ({ShortName})", code, name, shortName);
                }
                result[code] = company;
                continue;
            }

            company = new Company
            {
                TenantId = tenantId,
                Code = code,
                Name = name,
                ShortName = shortName,
                IsDefault = false,
                IsActive = true,
                IndustryType = code == ElectricalCode ? "specialty-contractor" : "general-contractor",
                State = "CA",
                City = "Sacramento",
                SortOrder = int.Parse(code),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "system"
            };

            db.Set<Company>().Add(company);
            await db.SaveChangesAsync(ct);

            logger.LogInformation("Created subsidiary company {CompanyId} ({Code}: {Name})", company.Id, code, name);
            result[code] = company;
        }

        return result;
    }

    /// <summary>
    /// Creates AppUser + role assignment + company access for each demo user.
    /// Runs outside the RLS transaction (UserManager manages its own).
    /// Idempotent: skips users that already exist.
    /// </summary>
    private async Task EnsureAllDemoUsersAsync(
        Guid tenantId, Dictionary<string, Company> companies, string password, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("Demo password not configured; skipping role-based user creation");
            return;
        }

        var created = 0;
        var skipped = 0;

        foreach (var def in DemoUsers)
        {
            var user = await userManager.FindByEmailAsync(def.Email);

            if (user is null)
            {
                user = new AppUser
                {
                    UserName = def.Email,
                    Email = def.Email,
                    EmailConfirmed = true,
                    FirstName = def.FirstName,
                    LastName = def.LastName,
                    Title = def.Title,
                    TenantId = tenantId,
                    Type = UserType.Internal,
                    Status = UserStatus.Active,
                    CompanyId = companies[def.DefaultCompanyCode].Id
                };

                var result = await userManager.CreateAsync(user, password);
                if (!result.Succeeded)
                {
                    logger.LogWarning("Failed to create demo user {Email}: {Errors}",
                        def.Email, string.Join(", ", result.Errors.Select(e => e.Description)));
                    continue;
                }
                created++;
            }
            else
            {
                skipped++;
            }

            // Ensure role
            await roleSeeder.AssignRoleToUserAsync(user, def.Role, ct);

            // Ensure company access (first company is default)
            for (var i = 0; i < def.CompanyCodes.Length; i++)
            {
                var code = def.CompanyCodes[i];
                if (companies.TryGetValue(code, out var company))
                {
                    await EnsureUserCompanyAccessAsync(user.Id, tenantId, company.Id, ct, isDefault: i == 0);
                }
            }
        }

        logger.LogInformation("Demo role users: {Created} created, {Skipped} already existed", created, skipped);
    }

    /// <summary>
    /// Creates Employee records for all demo users inside the RLS transaction.
    /// Links each Employee to its AppUser via EmployeeId FK.
    /// Idempotent: skips employees that already exist (matched by EmployeeNumber).
    /// </summary>
    private async Task EnsureAllDemoEmployeesAsync(
        Dictionary<string, Company> companies, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        var created = 0;
        var skipped = 0;

        foreach (var def in DemoUsers)
        {
            // Check if employee already exists by EmployeeNumber within this tenant
            var existing = await db.Set<Employee>()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.EmployeeNumber == def.EmployeeNumber && !e.IsDeleted, ct);

            if (existing is not null)
            {
                skipped++;

                // Ensure the AppUser.EmployeeId FK is set
                var user = await userManager.FindByEmailAsync(def.Email);
                if (user is not null && user.EmployeeId != existing.Id)
                {
                    user.EmployeeId = existing.Id;
                    var updateResult = await userManager.UpdateAsync(user);
                    if (!updateResult.Succeeded)
                        logger.LogWarning("Failed to link EmployeeId for {Email}: {Errors}",
                            def.Email, string.Join(", ", updateResult.Errors.Select(e => e.Description)));
                }
                continue;
            }

            var homeCompanyId = companies.TryGetValue(def.DefaultCompanyCode, out var homeCo)
                ? homeCo.Id
                : (Guid?)null;

            var employee = new Employee
            {
                EmployeeNumber = def.EmployeeNumber,
                FirstName = def.FirstName,
                LastName = def.LastName,
                Email = def.Email,
                Title = def.Title,
                Classification = def.Classification,
                BaseHourlyRate = def.HourlyRate,
                HireDate = new DateOnly(2020, 1, 15),
                IsActive = true,
                HomeCompanyId = homeCompanyId,
                Notes = $"Demo account: {def.Title}"
            };

            db.Set<Employee>().Add(employee);
            await db.SaveChangesAsync(ct);

            // Link AppUser.EmployeeId → Employee.Id
            var appUser = await userManager.FindByEmailAsync(def.Email);
            if (appUser is not null)
            {
                appUser.EmployeeId = employee.Id;
                var linkResult = await userManager.UpdateAsync(appUser);
                if (!linkResult.Succeeded)
                    logger.LogWarning("Failed to link EmployeeId for {Email}: {Errors}",
                        def.Email, string.Join(", ", linkResult.Errors.Select(e => e.Description)));
            }

            created++;
        }

        logger.LogInformation("Demo employee records: {Created} created, {Skipped} already existed", created, skipped);
    }

    // ── PM & Executive project assignments ────────────────────────────────

    /// <summary>
    /// Employee numbers for PM-level demo users who need Manager assignments.
    /// </summary>
    private static readonly string[] PmEmployeeNumbers =
        ["DEMO-SPM", "DEMO-PM", "DEMO-PC", "DEMO-SPG", "DEMO-PEG", "DEMO-FE"];

    /// <summary>
    /// Employee numbers for executive/C-suite users who get Manager (viewer) assignments.
    /// </summary>
    private static readonly string[] ExecutiveEmployeeNumbers =
        ["DEMO-CEO", "DEMO-COO", "DEMO-CFO", "DEMO-CAO", "DEMO-CRO",
         "DEMO-SPE", "DEMO-PEX", "DEMO-CE", "DEMO-CHE"];

    /// <summary>
    /// Assigns PM-level demo users as Managers and executive demo users as Managers (viewers)
    /// to active seed projects so they see real data on their dashboards.
    /// Follows the same idempotent pattern as EnsureDemoEmployeeRecordsAsync.
    /// </summary>
    private async Task EnsureDemoProjectAssignmentsAsync(CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;

        var activeProjects = await db.Set<Pitbull.Projects.Domain.Project>()
            .IgnoreQueryFilters()
            .Where(p => !p.IsDeleted && p.Status == Pitbull.Projects.Domain.ProjectStatus.Active && p.TenantId == tenantId)
            .Take(5)
            .ToListAsync(ct);

        if (activeProjects.Count == 0)
        {
            logger.LogInformation("No active projects found; skipping demo project assignments");
            return;
        }

        var pmAssigned = await AssignEmployeesToProjectsAsync(PmEmployeeNumbers, activeProjects, AssignmentRole.Manager, "Demo PM assignment", ct);
        var execAssigned = await AssignEmployeesToProjectsAsync(ExecutiveEmployeeNumbers, activeProjects, AssignmentRole.Manager, "Demo executive viewer", ct);

        logger.LogInformation(
            "Demo project assignments: {PmCount} PM assignments, {ExecCount} executive assignments created across {ProjectCount} projects",
            pmAssigned, execAssigned, activeProjects.Count);
    }

    private async Task<int> AssignEmployeesToProjectsAsync(
        string[] employeeNumbers,
        List<Pitbull.Projects.Domain.Project> projects,
        AssignmentRole role,
        string notes,
        CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        var employees = await db.Set<Employee>()
            .IgnoreQueryFilters()
            .Where(e => e.TenantId == tenantId && employeeNumbers.Contains(e.EmployeeNumber) && !e.IsDeleted)
            .ToListAsync(ct);

        var created = 0;
        foreach (var employee in employees)
        {
            foreach (var project in projects)
            {
                var alreadyAssigned = await db.Set<ProjectAssignment>()
                    .IgnoreQueryFilters()
                    .AnyAsync(pa => pa.EmployeeId == employee.Id && pa.ProjectId == project.Id && !pa.IsDeleted, ct);

                if (alreadyAssigned) continue;

                db.Set<ProjectAssignment>().Add(new ProjectAssignment
                {
                    EmployeeId = employee.Id,
                    ProjectId = project.Id,
                    StartDate = new DateOnly(2025, 1, 1),
                    IsActive = true,
                    Role = role,
                    Notes = notes
                });
                created++;
            }
        }

        if (created > 0)
            await db.SaveChangesAsync(ct);

        return created;
    }
}
