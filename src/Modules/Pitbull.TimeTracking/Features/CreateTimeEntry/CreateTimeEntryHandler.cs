using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Features.CreateTimeEntry;

public sealed class CreateTimeEntryHandler(PitbullDbContext db)
    : IRequestHandler<CreateTimeEntryCommand, Result<TimeEntryDto>>
{
    public async Task<Result<TimeEntryDto>> Handle(
        CreateTimeEntryCommand request, CancellationToken cancellationToken)
    {
        // Validate that employee exists and is active
        var employee = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && e.IsActive, cancellationToken);

        if (employee == null)
            return Result.Failure<TimeEntryDto>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        // Validate that project exists and is accessible
        var project = await db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, cancellationToken);

        if (project == null)
            return Result.Failure<TimeEntryDto>("Project not found", "PROJECT_NOT_FOUND");

        // Validate project is in an active status (not closed/completed)
        if (project.Status == ProjectStatus.Completed || project.Status == ProjectStatus.Closed)
            return Result.Failure<TimeEntryDto>(
                "Cannot log time to a completed or closed project",
                "PROJECT_INACTIVE");

        // Validate employee is assigned to this project
        var hasAssignment = await db.Set<ProjectAssignment>()
            .AnyAsync(pa => pa.EmployeeId == request.EmployeeId
                         && pa.ProjectId == request.ProjectId
                         && pa.IsActive
                         && pa.StartDate <= request.Date
                         && (pa.EndDate == null || pa.EndDate >= request.Date),
                      cancellationToken);

        if (!hasAssignment)
            return Result.Failure<TimeEntryDto>(
                "Employee is not assigned to this project",
                "NOT_ASSIGNED_TO_PROJECT");

        // Validate that cost code exists and is active
        var costCode = await db.Set<CostCode>()
            .FirstOrDefaultAsync(cc => cc.Id == request.CostCodeId && cc.IsActive, cancellationToken);

        if (costCode == null)
            return Result.Failure<TimeEntryDto>("Cost code not found or inactive", "COSTCODE_NOT_FOUND");

        // Check for duplicate time entry on the same date
        var existingEntry = await db.Set<TimeEntry>()
            .AnyAsync(te => te.Date == request.Date
                         && te.EmployeeId == request.EmployeeId
                         && te.ProjectId == request.ProjectId
                         && te.CostCodeId == request.CostCodeId,
                      cancellationToken);

        if (existingEntry)
            return Result.Failure<TimeEntryDto>(
                "Time entry already exists for this employee, project, and cost code on this date",
                "DUPLICATE_ENTRY");

        var timeEntry = new TimeEntry
        {
            Date = request.Date,
            EmployeeId = request.EmployeeId,
            ProjectId = request.ProjectId,
            CostCodeId = request.CostCodeId,
            RegularHours = request.RegularHours,
            OvertimeHours = request.OvertimeHours,
            DoubletimeHours = request.DoubletimeHours,
            Description = request.Description,
            Status = TimeEntryStatus.Submitted
        };

        db.Set<TimeEntry>().Add(timeEntry);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(TimeEntryMapper.ToDto(timeEntry));
    }
}