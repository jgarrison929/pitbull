using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.ExportVistaTimesheet;
using Pitbull.TimeTracking.Features.GetLaborCostReport;
using Pitbull.TimeTracking.Features.GetTimeEntriesByProject;
using Pitbull.TimeTracking.Features.ListTimeEntries;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for managing time entry operations, replacing MediatR-based handlers.
/// Provides direct, testable methods for all time entry-related business logic.
/// </summary>
public interface ITimeEntryService
{
    // Query operations
    Task<Result<TimeEntryDto>> GetTimeEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result<ListTimeEntriesResult>> ListTimeEntriesAsync(
        Guid? projectId,
        Guid? employeeId,
        DateOnly? startDate,
        DateOnly? endDate,
        TimeEntryStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<Result<ProjectTimeEntriesResult>> GetTimeEntriesByProjectAsync(
        Guid projectId,
        DateOnly? startDate,
        DateOnly? endDate,
        TimeEntryStatus? status,
        bool includeSummary,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<Result<LaborCostReportResponse>> GetLaborCostReportAsync(
        Guid? projectId,
        DateOnly? startDate,
        DateOnly? endDate,
        bool approvedOnly,
        CancellationToken cancellationToken = default);

    Task<Result<VistaExportResult>> ExportVistaTimesheetAsync(
        DateOnly startDate,
        DateOnly endDate,
        Guid? projectId,
        CancellationToken cancellationToken = default);

    // Command operations
    Task<Result<TimeEntryDto>> CreateTimeEntryAsync(CreateTimeEntryCommand command, CancellationToken cancellationToken = default);

    Task<Result<TimeEntryDto>> UpdateTimeEntryAsync(UpdateTimeEntryCommand command, CancellationToken cancellationToken = default);
}
