using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Logging;

namespace Pitbull.Api.Features.CompanyProvisioning;

/// <summary>
/// Service that provisions a new company within an existing tenant.
/// Creates the company entity, applies a chart of accounts template,
/// sets up initial accounting periods, and grants admin user access.
/// </summary>
public interface ICompanyProvisioningService
{
    /// <summary>
    /// Provisions a new company with the given configuration.
    /// Returns the created company and a summary of what was provisioned.
    /// </summary>
    Task<CompanyProvisioningResult> ProvisionAsync(
        CompanyProvisioningRequest request,
        CancellationToken ct = default);
}

public class CompanyProvisioningService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    ILogger<CompanyProvisioningService> logger) : ICompanyProvisioningService
{
    public async Task<CompanyProvisioningResult> ProvisionAsync(
        CompanyProvisioningRequest request,
        CancellationToken ct = default)
    {
        var tenantId = tenantContext.TenantId;

        // ── Validate ─────────────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(request.Code))
            throw new ArgumentException("Company code is required");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Company name is required");

        // Check duplicate code within tenant
        var codeExists = await db.Set<Company>()
            .IgnoreQueryFilters()
            .AnyAsync(c => c.TenantId == tenantId && c.Code == request.Code && !c.IsDeleted, ct);

        if (codeExists)
            throw new InvalidOperationException($"A company with code '{request.Code}' already exists in this tenant");

        // Validate template
        if (!string.IsNullOrWhiteSpace(request.CoaTemplateKey) &&
            !ChartOfAccountsTemplates.All.ContainsKey(request.CoaTemplateKey))
            throw new ArgumentException($"Unknown chart of accounts template: '{request.CoaTemplateKey}'");

        // ── Create Company ───────────────────────────────────────────
        var company = new Company
        {
            TenantId = tenantId,
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            ShortName = request.ShortName?.Trim(),
            TaxId = request.TaxId?.Trim(),
            Address = request.Address?.Trim(),
            City = request.City?.Trim(),
            State = request.State?.Trim(),
            ZipCode = request.ZipCode?.Trim(),
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim(),
            Website = request.Website?.Trim(),
            IndustryType = request.IndustryType?.Trim(),
            Currency = request.Currency ?? "USD",
            Timezone = request.Timezone ?? "America/Los_Angeles",
            DateFormat = request.DateFormat ?? "MM/dd/yyyy",
            FiscalYearStartMonth = request.FiscalYearStartMonth ?? 1,
            IsDefault = false,
            IsActive = true,
            SortOrder = request.SortOrder ?? 0,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "company-provisioning"
        };

        db.Set<Company>().Add(company);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Created company {CompanyId} ({Code}: {Name}) for tenant {TenantId}",
            company.Id, LogSafe.Text(company.Code), LogSafe.Text(company.Name), tenantId);

        // ── Apply Chart of Accounts Template ─────────────────────────
        var accountsCreated = 0;
        var templateKey = request.CoaTemplateKey ?? "construction-default";

        if (ChartOfAccountsTemplates.All.TryGetValue(templateKey, out var template))
        {
            var accounts = template.CreateAccounts();
            foreach (var account in accounts)
            {
                account.TenantId = tenantId;
                account.CompanyId = company.Id;
                account.CreatedAt = DateTime.UtcNow;
                account.CreatedBy = "company-provisioning";
            }

            db.Set<ChartOfAccount>().AddRange(accounts);
            await db.SaveChangesAsync(ct);
            accountsCreated = accounts.Count;

            logger.LogInformation(
                "Applied COA template '{Template}' ({Count} accounts) to company {CompanyId}",
                LogSafe.Text(templateKey), accountsCreated, company.Id);
        }

        // ── Create Accounting Periods ────────────────────────────────
        var periodsCreated = 0;
        var fiscalStartMonth = request.FiscalYearStartMonth ?? 1;
        var startYear = request.FiscalYearStart?.Year ?? DateTime.UtcNow.Year;
        var startMonth = request.FiscalYearStart?.Month ?? fiscalStartMonth;

        var periods = CreateAccountingPeriods(startYear, startMonth, request.PeriodsToCreate ?? 12);
        foreach (var period in periods)
        {
            period.TenantId = tenantId;
            period.CompanyId = company.Id;
            period.CreatedAt = DateTime.UtcNow;
            period.CreatedBy = "company-provisioning";
        }

        db.Set<AccountingPeriod>().AddRange(periods);
        await db.SaveChangesAsync(ct);
        periodsCreated = periods.Count;

        logger.LogInformation(
            "Created {Count} accounting periods for company {CompanyId} starting {StartMonth}/{StartYear}",
            periodsCreated, company.Id, startMonth, startYear);

        // ── Grant Admin User Access ──────────────────────────────────
        var accessGranted = 0;
        if (request.AdminUserId.HasValue && request.AdminUserId.Value != Guid.Empty)
        {
            var existingAccess = await db.Set<UserCompanyAccess>()
                .IgnoreQueryFilters()
                .AnyAsync(a => a.TenantId == tenantId
                    && a.UserId == request.AdminUserId.Value
                    && a.CompanyId == company.Id, ct);

            if (!existingAccess)
            {
                db.Set<UserCompanyAccess>().Add(new UserCompanyAccess
                {
                    TenantId = tenantId,
                    UserId = request.AdminUserId.Value,
                    CompanyId = company.Id,
                    IsDefault = false,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = "company-provisioning"
                });
                await db.SaveChangesAsync(ct);
                accessGranted = 1;

                logger.LogInformation(
                    "Granted user {UserId} access to company {CompanyId}",
                    request.AdminUserId.Value, company.Id);
            }
        }

        return new CompanyProvisioningResult(
            CompanyId: company.Id,
            CompanyCode: company.Code,
            CompanyName: company.Name,
            CoaTemplate: templateKey,
            AccountsCreated: accountsCreated,
            PeriodsCreated: periodsCreated,
            UserAccessGranted: accessGranted,
            Summary: $"Provisioned company '{company.Name}' ({company.Code}) with {accountsCreated} GL accounts, " +
                     $"{periodsCreated} accounting periods, and {accessGranted} user access grant(s)."
        );
    }

    /// <summary>
    /// Creates monthly accounting periods starting from the given month/year.
    /// First period is Open, rest are Open (the system will close them as needed).
    /// </summary>
    private static List<AccountingPeriod> CreateAccountingPeriods(int startYear, int startMonth, int count)
    {
        var periods = new List<AccountingPeriod>();

        for (var i = 0; i < count; i++)
        {
            var periodDate = new DateTime(startYear, startMonth, 1).AddMonths(i);
            var startDate = new DateOnly(periodDate.Year, periodDate.Month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);

            // Period number within the fiscal year (1-12 cycle)
            var periodNumber = (i % 12) + 1;

            periods.Add(new AccountingPeriod
            {
                PeriodNumber = periodNumber,
                FiscalYear = periodDate.Year,
                PeriodName = periodDate.ToString("MMMM yyyy"),
                StartDate = startDate,
                EndDate = endDate,
                Status = PeriodStatus.Open
            });
        }

        return periods;
    }
}

// ── Request / Result DTOs ────────────────────────────────────────────

public record CompanyProvisioningRequest
{
    // Company details
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? ShortName { get; init; }
    public string? TaxId { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? ZipCode { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? Website { get; init; }
    public string? IndustryType { get; init; }
    public string? Currency { get; init; }
    public string? Timezone { get; init; }
    public string? DateFormat { get; init; }
    public int? FiscalYearStartMonth { get; init; }
    public int? SortOrder { get; init; }

    // COA template
    public string? CoaTemplateKey { get; init; }

    // Accounting periods
    public DateOnly? FiscalYearStart { get; init; }
    public int? PeriodsToCreate { get; init; }

    // User access
    public Guid? AdminUserId { get; init; }
}

public record CompanyProvisioningResult(
    Guid CompanyId,
    string CompanyCode,
    string CompanyName,
    string CoaTemplate,
    int AccountsCreated,
    int PeriodsCreated,
    int UserAccessGranted,
    string Summary);
