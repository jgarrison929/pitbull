namespace Pitbull.Api.Services;

/// <summary>
/// Constants for cache key names used by ICacheService.
/// Keys are automatically scoped by TenantId + CompanyId in CacheService.
/// </summary>
public static class CacheKeys
{
    public const string ChartOfAccountsTree = "chart-of-accounts:tree";
    public const string CostCodes = "cost-codes";
    public const string Projects = "projects";
    public const string Employees = "employees";
    public const string Companies = "companies";
    public const string ReportLaborCost = "report:labor-cost";
    public const string ReportProfitability = "report:profitability";
    public const string ReportEquipment = "report:equipment";
}

/// <summary>
/// Standard cache TTLs for reference data.
/// </summary>
public static class CacheDurations
{
    /// <summary>5 minutes — for rarely-changing reference data (chart of accounts, cost codes)</summary>
    public static readonly TimeSpan ReferenceData = TimeSpan.FromMinutes(5);

    /// <summary>2 minutes — for moderately-changing data (projects, employees)</summary>
    public static readonly TimeSpan DropdownData = TimeSpan.FromMinutes(2);

    /// <summary>2 minutes — for expensive report queries that change with new data</summary>
    public static readonly TimeSpan ReportData = TimeSpan.FromMinutes(2);
}
