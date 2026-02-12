using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;

namespace Pitbull.TimeTracking.Features.BatchCreateTimeEntries;

public sealed class BatchCreateTimeEntriesHandler(PitbullDbContext db, IPayPeriodService payPeriodService)
    : IRequestHandler<BatchCreateTimeEntriesCommand, Result<BatchCreateTimeEntriesResult>>
{
    public async Task<Result<BatchCreateTimeEntriesResult>> Handle(
        BatchCreateTimeEntriesCommand request, CancellationToken cancellationToken)
    {
        var results = new List<BatchEntryResult>();
        var createdEntries = new List<TimeEntry>();

        // Pre-load all referenced entities for efficient validation
        var employeeIds = request.Entries.Select(e => e.EmployeeId).Distinct().ToList();
        var projectIds = request.Entries.Select(e => e.ProjectId).Distinct().ToList();
        var costCodeIds = request.Entries.Select(e => e.CostCodeId).Distinct().ToList();

        // Pre-check all unique dates for pay period locks
        var uniqueDates = request.Entries.Select(e => e.Date).Distinct().ToList();
        var lockedDateErrors = new Dictionary<DateOnly, string>();
        foreach (var date in uniqueDates)
        {
            var error = await payPeriodService.ValidateTimeEntryDateAsync(date, cancellationToken);
            if (error != null)
                lockedDateErrors[date] = error;
        }

        var employees = await db.Set<Employee>()
            .Where(e => employeeIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, cancellationToken);

        var projects = await db.Set<Project>()
            .Where(p => projectIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        var costCodes = await db.Set<CostCode>()
            .Where(cc => costCodeIds.Contains(cc.Id))
            .ToDictionaryAsync(cc => cc.Id, cancellationToken);

        // Get all project assignments for the employees/projects/dates in this batch
        var minDate = request.Entries.Min(e => e.Date);
        var maxDate = request.Entries.Max(e => e.Date);

        var assignments = await db.Set<ProjectAssignment>()
            .Where(pa => employeeIds.Contains(pa.EmployeeId)
                      && projectIds.Contains(pa.ProjectId)
                      && pa.IsActive
                      && pa.StartDate <= maxDate
                      && (pa.EndDate == null || pa.EndDate >= minDate))
            .ToListAsync(cancellationToken);

        // Check for existing entries to detect duplicates
        var existingEntries = await db.Set<TimeEntry>()
            .Where(te => employeeIds.Contains(te.EmployeeId)
                      && projectIds.Contains(te.ProjectId)
                      && te.Date >= minDate
                      && te.Date <= maxDate)
            .Select(te => new { te.Date, te.EmployeeId, te.ProjectId, te.CostCodeId })
            .ToListAsync(cancellationToken);

        var existingSet = existingEntries
            .Select(e => $"{e.Date}|{e.EmployeeId}|{e.ProjectId}|{e.CostCodeId}")
            .ToHashSet();

        // Process each entry
        for (int i = 0; i < request.Entries.Count; i++)
        {
            var entry = request.Entries[i];
            var employeeName = employees.TryGetValue(entry.EmployeeId, out var emp) 
                ? emp.FullName 
                : "Unknown";

            // Check if date falls in a locked pay period
            if (lockedDateErrors.TryGetValue(entry.Date, out var payPeriodError))
            {
                results.Add(new BatchEntryResult(
                    i, null, entry.EmployeeId, employeeName, false,
                    payPeriodError, "PAY_PERIOD_LOCKED"));
                continue;
            }

            // Validate employee
            if (!employees.TryGetValue(entry.EmployeeId, out var employee) || !employee.IsActive)
            {
                results.Add(new BatchEntryResult(
                    i, null, entry.EmployeeId, employeeName, false,
                    "Employee not found or inactive", "EMPLOYEE_NOT_FOUND"));
                continue;
            }

            // Validate project
            if (!projects.TryGetValue(entry.ProjectId, out var project))
            {
                results.Add(new BatchEntryResult(
                    i, null, entry.EmployeeId, employeeName, false,
                    "Project not found", "PROJECT_NOT_FOUND"));
                continue;
            }

            // Check project status
            if (project.Status == ProjectStatus.Completed || project.Status == ProjectStatus.Closed)
            {
                results.Add(new BatchEntryResult(
                    i, null, entry.EmployeeId, employeeName, false,
                    "Cannot log time to a completed or closed project", "PROJECT_INACTIVE"));
                continue;
            }

            // Validate cost code
            if (!costCodes.TryGetValue(entry.CostCodeId, out var costCode) || !costCode.IsActive)
            {
                results.Add(new BatchEntryResult(
                    i, null, entry.EmployeeId, employeeName, false,
                    "Cost code not found or inactive", "COSTCODE_NOT_FOUND"));
                continue;
            }

            // Check project assignment
            var hasAssignment = assignments.Any(pa =>
                pa.EmployeeId == entry.EmployeeId &&
                pa.ProjectId == entry.ProjectId &&
                pa.StartDate <= entry.Date &&
                (pa.EndDate == null || pa.EndDate >= entry.Date));

            if (!hasAssignment)
            {
                results.Add(new BatchEntryResult(
                    i, null, entry.EmployeeId, employeeName, false,
                    "Employee is not assigned to this project", "NOT_ASSIGNED_TO_PROJECT"));
                continue;
            }

            // Check for duplicate
            var key = $"{entry.Date}|{entry.EmployeeId}|{entry.ProjectId}|{entry.CostCodeId}";
            if (existingSet.Contains(key))
            {
                results.Add(new BatchEntryResult(
                    i, null, entry.EmployeeId, employeeName, false,
                    "Time entry already exists for this employee, project, and cost code on this date",
                    "DUPLICATE_ENTRY"));
                continue;
            }

            // Also check against entries we're creating in this batch
            var batchDuplicateKey = $"{entry.Date}|{entry.EmployeeId}|{entry.ProjectId}|{entry.CostCodeId}";
            if (createdEntries.Any(ce => 
                ce.Date == entry.Date && 
                ce.EmployeeId == entry.EmployeeId && 
                ce.ProjectId == entry.ProjectId && 
                ce.CostCodeId == entry.CostCodeId))
            {
                results.Add(new BatchEntryResult(
                    i, null, entry.EmployeeId, employeeName, false,
                    "Duplicate entry in batch for this employee, project, and cost code",
                    "DUPLICATE_IN_BATCH"));
                continue;
            }

            // Create the time entry
            var timeEntry = new TimeEntry
            {
                Date = entry.Date,
                EmployeeId = entry.EmployeeId,
                ProjectId = entry.ProjectId,
                CostCodeId = entry.CostCodeId,
                RegularHours = entry.RegularHours,
                OvertimeHours = entry.OvertimeHours,
                DoubletimeHours = entry.DoubletimeHours,
                Description = entry.Description,
                Status = TimeEntryStatus.Submitted
            };

            createdEntries.Add(timeEntry);
            results.Add(new BatchEntryResult(
                i, timeEntry.Id, entry.EmployeeId, employeeName, true, null, null));
        }

        // Determine if we should commit based on AllowPartialSuccess setting
        var failureCount = results.Count(r => !r.Success);
        var successCount = results.Count(r => r.Success);

        if (!request.AllowPartialSuccess && failureCount > 0)
        {
            // Rollback: don't save anything
            return Result.Success(new BatchCreateTimeEntriesResult(
                request.Entries.Count,
                0,
                failureCount,
                results.Select(r => r with { 
                    Success = false, 
                    TimeEntryId = null,
                    Error = r.Success ? "Rollback due to other validation errors" : r.Error,
                    ErrorCode = r.Success ? "BATCH_ROLLBACK" : r.ErrorCode
                }).ToList()));
        }

        // Save successful entries
        if (createdEntries.Count > 0)
        {
            db.Set<TimeEntry>().AddRange(createdEntries);
            await db.SaveChangesAsync(cancellationToken);

            // Update results with actual IDs (generated on save)
            for (int i = 0; i < results.Count; i++)
            {
                if (results[i].Success)
                {
                    var createdEntry = createdEntries.FirstOrDefault(ce => 
                        ce.EmployeeId == results[i].EmployeeId);
                    if (createdEntry != null)
                    {
                        results[i] = results[i] with { TimeEntryId = createdEntry.Id };
                    }
                }
            }
        }

        return Result.Success(new BatchCreateTimeEntriesResult(
            request.Entries.Count,
            successCount,
            failureCount,
            results));
    }
}
