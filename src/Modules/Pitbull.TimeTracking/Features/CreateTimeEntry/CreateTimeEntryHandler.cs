using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
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
            return Result.Failure<TimeEntryDto>("Employee not found or inactive");

        // Check for duplicate time entry on the same date
        var existingEntry = await db.Set<TimeEntry>()
            .AnyAsync(te => te.Date == request.Date 
                         && te.EmployeeId == request.EmployeeId 
                         && te.ProjectId == request.ProjectId
                         && te.CostCodeId == request.CostCodeId, 
                      cancellationToken);

        if (existingEntry)
            return Result.Failure<TimeEntryDto>("Time entry already exists for this employee, project, and cost code on this date");

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