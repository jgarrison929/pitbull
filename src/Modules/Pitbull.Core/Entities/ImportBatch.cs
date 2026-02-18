using Pitbull.Core.Domain;

namespace Pitbull.Core.Entities;

public static class ImportBatchStatuses
{
    public const string Pending = "Pending";
    public const string Processing = "Processing";
    public const string Completed = "Completed";
    public const string Failed = "Failed";
}

public static class ImportBatchTypes
{
    public const string Employees = "employees";
    public const string Projects = "projects";
    public const string CostCodes = "cost-codes";
    public const string Equipment = "equipment";
    public const string TimeEntries = "time-entries";

    public static readonly HashSet<string> ValidTypes =
    [
        Employees,
        Projects,
        CostCodes,
        Equipment,
        TimeEntries
    ];
}

public class ImportBatch : BaseEntity
{
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = ImportBatchStatuses.Pending;
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int ErrorRows { get; set; }
    public string ErrorDetails { get; set; } = "{}";
    public DateTime? CompletedAt { get; set; }
}
