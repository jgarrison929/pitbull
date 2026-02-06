using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.TimeTracking.Features.ExportVistaTimesheet;

/// <summary>
/// Query to export approved time entries in Vista/Viewpoint compatible CSV format.
/// This enables integration with the Vista ERP system's timesheet import functionality.
/// </summary>
public sealed record ExportVistaTimesheetQuery(
    /// <summary>
    /// Start date for the export period (inclusive)
    /// </summary>
    DateOnly StartDate,
    
    /// <summary>
    /// End date for the export period (inclusive)
    /// </summary>
    DateOnly EndDate,
    
    /// <summary>
    /// Optional: Filter to specific project
    /// </summary>
    Guid? ProjectId = null
) : IRequest<Result<VistaExportResult>>;

/// <summary>
/// Result containing the CSV content and metadata
/// </summary>
public sealed record VistaExportResult
{
    /// <summary>
    /// CSV content ready for download
    /// </summary>
    public required string CsvContent { get; init; }
    
    /// <summary>
    /// Suggested filename for the export
    /// </summary>
    public required string FileName { get; init; }
    
    /// <summary>
    /// Number of time entry rows included
    /// </summary>
    public int RowCount { get; init; }
    
    /// <summary>
    /// Total hours in the export
    /// </summary>
    public decimal TotalHours { get; init; }
    
    /// <summary>
    /// Export date range
    /// </summary>
    public required DateOnly StartDate { get; init; }
    public required DateOnly EndDate { get; init; }
    
    /// <summary>
    /// Number of unique employees in export
    /// </summary>
    public int EmployeeCount { get; init; }
    
    /// <summary>
    /// Number of unique projects in export
    /// </summary>
    public int ProjectCount { get; init; }
}
