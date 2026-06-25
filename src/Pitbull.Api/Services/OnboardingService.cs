using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Services;

public interface IOnboardingService
{
    Task<OnboardingChecklistDto> GetOrCreateChecklistAsync(Guid userId, Guid companyId, CancellationToken ct = default);
    Task<OnboardingChecklistDto> UpdateChecklistItemAsync(Guid userId, Guid companyId, string itemName, bool completed, CancellationToken ct = default);
    Task DismissChecklistAsync(Guid userId, Guid companyId, CancellationToken ct = default);
    Task<OnboardingStatusDto> GetOnboardingStatusAsync(Guid userId, CancellationToken ct = default);
}

public class OnboardingService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ILogger<OnboardingService> logger) : IOnboardingService
{
    public async Task<OnboardingChecklistDto> GetOrCreateChecklistAsync(Guid userId, Guid companyId, CancellationToken ct = default)
    {
        var checklist = await db.Set<OnboardingChecklist>()
            .FirstOrDefaultAsync(c => c.UserId == userId && c.CompanyId == companyId, ct);

        if (checklist is null)
        {
            checklist = new OnboardingChecklist
            {
                TenantId = tenantContext.TenantId,
                UserId = userId,
                CompanyId = companyId,
                CreatedBy = userId.ToString()
            };
            db.Set<OnboardingChecklist>().Add(checklist);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Created onboarding checklist for user {UserId} in company {CompanyId}", userId, companyId);
        }

        await SyncChecklistFromTenantDataAsync(checklist, ct);

        return MapToDto(checklist);
    }

    public async Task<OnboardingChecklistDto> UpdateChecklistItemAsync(Guid userId, Guid companyId, string itemName, bool completed, CancellationToken ct = default)
    {
        var checklist = await db.Set<OnboardingChecklist>()
            .FirstOrDefaultAsync(c => c.UserId == userId && c.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Checklist not found");

        switch (itemName.ToLowerInvariant())
        {
            case "company_profile": checklist.CompanyProfileCompleted = completed; break;
            case "contractor_type": checklist.ContractorTypeSelected = completed; break;
            case "modules_activated": checklist.ModulesActivated = completed; break;
            case "modules_configured": checklist.ModulesConfigured = completed; break;
            case "team_invited": checklist.TeamMembersInvited = completed; break;
            case "first_project": checklist.FirstProjectCreated = completed; break;
            case "employees_added": checklist.EmployeesAdded = completed; break;
            case "cost_codes": checklist.CostCodesConfigured = completed; break;
            default: throw new ArgumentException($"Unknown checklist item: {itemName}");
        }

        if (checklist.IsFullyCompleted && checklist.CompletedAt is null)
        {
            checklist.CompletedAt = DateTime.UtcNow;
            logger.LogInformation("User {UserId} completed all onboarding steps", userId);
        }

        await db.SaveChangesAsync(ct);
        return MapToDto(checklist);
    }

    public async Task DismissChecklistAsync(Guid userId, Guid companyId, CancellationToken ct = default)
    {
        var checklist = await db.Set<OnboardingChecklist>()
            .FirstOrDefaultAsync(c => c.UserId == userId && c.CompanyId == companyId, ct);

        if (checklist is null) return;

        checklist.Dismissed = true;
        await db.SaveChangesAsync(ct);
    }

    public async Task<OnboardingStatusDto> GetOnboardingStatusAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return new OnboardingStatusDto(false, false, false, null);

        // Company query already has !IsDeleted via global query filter on BaseEntity
        var company = await db.Set<Company>()
            .FirstOrDefaultAsync(c => c.TenantId == user.TenantId && c.IsDefault, ct);

        var hasCompany = company is not null;

        // A company is "setup complete" if it has a non-default name (not "X's Company" pattern)
        var isSetupComplete = hasCompany && company!.Name != $"{user.FirstName}'s Company";

        // Checklist query also uses global query filter (!IsDeleted)
        var checklist = company is not null
            ? await db.Set<OnboardingChecklist>()
                .FirstOrDefaultAsync(c => c.UserId == userId && c.CompanyId == company.Id, ct)
            : null;

        return new OnboardingStatusDto(
            HasCompany: hasCompany,
            IsSetupComplete: isSetupComplete,
            IsChecklistDismissed: checklist?.Dismissed ?? false,
            Checklist: checklist is not null ? MapToDto(checklist) : null);
    }

    private async Task SyncChecklistFromTenantDataAsync(OnboardingChecklist checklist, CancellationToken ct)
    {
        var changed = false;

        if (!checklist.CostCodesConfigured)
        {
            var hasCostCodes = await db.Set<CostCode>()
                .AnyAsync(cc => cc.TenantId == tenantContext.TenantId && !cc.IsDeleted, ct);
            if (hasCostCodes)
            {
                checklist.CostCodesConfigured = true;
                changed = true;
            }
        }

        if (!checklist.EmployeesAdded)
        {
            var hasEmployees = await db.Set<Employee>()
                .AnyAsync(e => e.TenantId == tenantContext.TenantId && !e.IsDeleted, ct);
            if (hasEmployees)
            {
                checklist.EmployeesAdded = true;
                changed = true;
            }
        }

        if (!checklist.FirstProjectCreated)
        {
            var hasProjects = await db.Set<Project>()
                .AnyAsync(p => p.TenantId == tenantContext.TenantId && !p.IsDeleted, ct);
            if (hasProjects)
            {
                checklist.FirstProjectCreated = true;
                changed = true;
            }
        }

        if (changed)
        {
            if (checklist.IsFullyCompleted && checklist.CompletedAt is null)
                checklist.CompletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    private static OnboardingChecklistDto MapToDto(OnboardingChecklist c) => new(
        Id: c.Id,
        CompanyProfileCompleted: c.CompanyProfileCompleted,
        ContractorTypeSelected: c.ContractorTypeSelected,
        ModulesActivated: c.ModulesActivated,
        ModulesConfigured: c.ModulesConfigured,
        TeamMembersInvited: c.TeamMembersInvited,
        FirstProjectCreated: c.FirstProjectCreated,
        EmployeesAdded: c.EmployeesAdded,
        CostCodesConfigured: c.CostCodesConfigured,
        CompletedCount: c.CompletedCount,
        TotalItems: OnboardingChecklist.TotalItems,
        IsFullyCompleted: c.IsFullyCompleted,
        Dismissed: c.Dismissed,
        CompletedAt: c.CompletedAt);
}

// DTOs

public record OnboardingChecklistDto(
    Guid Id,
    bool CompanyProfileCompleted,
    bool ContractorTypeSelected,
    bool ModulesActivated,
    bool ModulesConfigured,
    bool TeamMembersInvited,
    bool FirstProjectCreated,
    bool EmployeesAdded,
    bool CostCodesConfigured,
    int CompletedCount,
    int TotalItems,
    bool IsFullyCompleted,
    bool Dismissed,
    DateTime? CompletedAt);

public record OnboardingStatusDto(
    bool HasCompany,
    bool IsSetupComplete,
    bool IsChecklistDismissed,
    OnboardingChecklistDto? Checklist);
