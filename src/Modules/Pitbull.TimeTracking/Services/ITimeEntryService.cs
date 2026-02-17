using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Features.BulkSubmitTimeEntries;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.ExportVistaTimesheet;
using Pitbull.TimeTracking.Features.GetReviewQueue;
using Pitbull.TimeTracking.Features.GetLaborCostReport;
using Pitbull.TimeTracking.Features.GetYesterdayCrewEntries;
using Pitbull.TimeTracking.Features.GetTimeEntriesByProject;
using Pitbull.TimeTracking.Features.ListTimeEntries;
using Pitbull.TimeTracking.Features.ReviewTimeEntries;
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
        Guid? foremanId,
        CancellationToken cancellationToken = default);

    Task<Result<YesterdayCrewEntriesResult>> GetYesterdayCrewEntriesAsync(
        Guid foremanId,
        DateOnly? targetDate = null,
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

    Task<Result<ReviewQueueResult>> GetReviewQueueAsync(
        DateOnly? startDate,
        DateOnly? endDate,
        Guid? projectId,
        Guid? supervisorId,
        Guid currentEmployeeId,
        CancellationToken cancellationToken = default);

    Task<Employee?> GetEmployeeByEmailAsync(string email, CancellationToken cancellationToken = default);

    // Command operations
    Task<Result<TimeEntryDto>> CreateTimeEntryAsync(CreateTimeEntryCommand command, CancellationToken cancellationToken = default);

    Task<Result<TimeEntryDto>> UpdateTimeEntryAsync(UpdateTimeEntryCommand command, CancellationToken cancellationToken = default);

    Task<Result<BatchCreateTimeEntriesResult>> BatchCreateTimeEntriesAsync(BatchCreateTimeEntriesCommand command, CancellationToken cancellationToken = default);

    Task<Result<BulkSubmitTimeEntriesResult>> BulkSubmitTimeEntriesAsync(BulkSubmitTimeEntriesCommand command, CancellationToken cancellationToken = default);

    Task<Result<ReviewTimeEntriesResult>> ReviewTimeEntriesAsync(
        ReviewTimeEntriesCommand command,
        Guid reviewedByEmployeeId,
        CancellationToken cancellationToken = default);
}
