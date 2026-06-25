using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Services;

/// <summary>
/// Handles the provisioning of new tenants with default data.
/// Called after tenant + company creation during registration.
/// Seeds cost codes, permissions, and module defaults so the workspace isn't empty.
/// </summary>
public interface ITenantProvisioningService
{
    Task ProvisionTenantAsync(Guid tenantId, Guid companyId, CancellationToken ct = default);
}

public class TenantProvisioningService(
    PitbullDbContext db,
    RoleSeeder roleSeeder,
    ILogger<TenantProvisioningService> logger) : ITenantProvisioningService
{
    /// <summary>
    /// Seeds all default data for a newly created tenant and company.
    /// This is idempotent — safe to call multiple times for the same tenant.
    /// </summary>
    public async Task ProvisionTenantAsync(Guid tenantId, Guid companyId, CancellationToken ct = default)
    {
        logger.LogInformation("Provisioning tenant {TenantId} with company {CompanyId}", tenantId, companyId);

        // Guard: verify the company exists, belongs to the correct tenant, and is not deleted
        var company = await db.Set<Company>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == companyId && c.TenantId == tenantId && !c.IsDeleted, ct);

        if (company is null)
            throw new InvalidOperationException($"Company {companyId} not found or does not belong to tenant {tenantId}");

        // 1. Ensure roles exist
        await roleSeeder.EnsureRolesForTenantAsync(tenantId, ct);

        // 2. Seed default cost codes (tenant-scoped, not company-scoped)
        await SeedDefaultCostCodesAsync(tenantId, ct);

        // 3. Seed default RBAC permissions
        await SeedDefaultPermissionsAsync(tenantId, ct);

        logger.LogInformation("Tenant {TenantId} provisioning complete", tenantId);
    }

    private async Task SeedDefaultCostCodesAsync(Guid tenantId, CancellationToken ct)
    {
        var existing = await db.Set<CostCode>()
            .IgnoreQueryFilters()
            .AnyAsync(cc => cc.TenantId == tenantId && !cc.IsDeleted, ct);

        if (existing)
        {
            logger.LogDebug("Cost codes already exist for tenant {TenantId}, skipping seed", tenantId);
            return;
        }

        var defaultCostCodes = new[]
        {
            ("LAB", "Labor", "Labor"),
            ("01-000", "General Conditions", "01 - General Requirements"),
            ("02-000", "Site Work", "02 - Existing Conditions"),
            ("03-000", "Concrete", "03 - Concrete"),
            ("04-000", "Masonry", "04 - Masonry"),
            ("05-000", "Metals", "05 - Metals"),
            ("06-000", "Wood & Plastics", "06 - Wood, Plastics, Composites"),
            ("07-000", "Thermal & Moisture Protection", "07 - Thermal & Moisture"),
            ("08-000", "Doors & Windows", "08 - Openings"),
            ("09-000", "Finishes", "09 - Finishes"),
            ("10-000", "Specialties", "10 - Specialties"),
            ("15-000", "Mechanical", "15 - Mechanical"),
            ("16-000", "Electrical", "16 - Electrical"),
        };

        foreach (var (code, description, division) in defaultCostCodes)
        {
            db.Set<CostCode>().Add(new CostCode
            {
                TenantId = tenantId,
                Code = code,
                Description = description,
                Division = division,
                CostType = CostType.Labor,
                IsActive = true,
                IsCompanyStandard = true,
                CreatedBy = "system"
            });
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} default cost codes for tenant {TenantId}", defaultCostCodes.Length, tenantId);
    }

    private async Task SeedDefaultPermissionsAsync(Guid tenantId, CancellationToken ct)
    {
        var existing = await db.Set<Pitbull.Core.Entities.Permission>()
            .IgnoreQueryFilters()
            .AnyAsync(p => p.TenantId == tenantId && !p.IsDeleted, ct);

        if (existing)
        {
            logger.LogDebug("Permissions already exist for tenant {TenantId}, skipping seed", tenantId);
            return;
        }

        var defaultPermissions = new[]
        {
            ("projects.view", "Projects", "View projects"),
            ("projects.create", "Projects", "Create projects"),
            ("projects.edit", "Projects", "Edit projects"),
            ("projects.delete", "Projects", "Delete projects"),
            ("bids.view", "Bids", "View bids"),
            ("bids.create", "Bids", "Create bids"),
            ("bids.edit", "Bids", "Edit bids"),
            ("contracts.view", "Contracts", "View contracts"),
            ("contracts.create", "Contracts", "Create contracts"),
            ("contracts.edit", "Contracts", "Edit contracts"),
            ("employees.view", "Employees", "View employees"),
            ("employees.create", "Employees", "Create employees"),
            ("employees.edit", "Employees", "Edit employees"),
            ("reports.view", "Reports", "View reports"),
            ("reports.export", "Reports", "Export reports"),
            ("settings.view", "Settings", "View settings"),
            ("settings.edit", "Settings", "Edit settings"),
            ("users.view", "Users", "View users"),
            ("users.invite", "Users", "Invite users"),
            ("users.manage", "Users", "Manage users"),
        };

        foreach (var (name, category, description) in defaultPermissions)
        {
            db.Set<Pitbull.Core.Entities.Permission>().Add(new Pitbull.Core.Entities.Permission
            {
                TenantId = tenantId,
                Name = name,
                Category = category,
                Description = description,
                CreatedBy = "system"
            });
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} default permissions for tenant {TenantId}", defaultPermissions.Length, tenantId);
    }
}
