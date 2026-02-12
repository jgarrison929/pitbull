using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetYesterdayCrewEntries;

public sealed class GetYesterdayCrewEntriesHandler(PitbullDbContext db)
    : IRequestHandler<GetYesterdayCrewEntriesQuery, Result<YesterdayCrewEntriesResult>>
{
    public async Task<Result<YesterdayCrewEntriesResult>> Handle(
        GetYesterdayCrewEntriesQuery request, CancellationToken cancellationToken)
    {
        // Validate foreman exists and is a supervisor
        var foreman = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.ForemanId && e.IsActive, cancellationToken);

        if (foreman == null)
            return Result.Failure<YesterdayCrewEntriesResult>(
                "Foreman not found or inactive", "FOREMAN_NOT_FOUND");

        // Get the target date (yesterday by default)
        var entriesDate = request.TargetDate ?? DateOnly.FromDateTime(DateTime.Today.AddDays(-1));

        // Get all employees supervised by this foreman
        var crewEmployeeIds = await db.Set<Employee>()
            .Where(e => e.SupervisorId == request.ForemanId && e.IsActive)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

        if (crewEmployeeIds.Count == 0)
        {
            // Return empty result - foreman has no crew assigned
            return Result.Success(new YesterdayCrewEntriesResult(
                entriesDate, 0, 0, 0, []));
        }

        // Get all time entries for the crew on the target date
        var entries = await db.Set<TimeEntry>()
            .Where(te => crewEmployeeIds.Contains(te.EmployeeId) && te.Date == entriesDate)
            .Include(te => te.Employee)
            .Include(te => te.Project)
            .Include(te => te.CostCode)
            .OrderBy(te => te.Employee.LastName)
            .ThenBy(te => te.Employee.FirstName)
            .ToListAsync(cancellationToken);

        // Group by employee
        var employeeEntries = entries
            .GroupBy(te => te.EmployeeId)
            .Select(g => new YesterdayCrewEmployeeEntries(
                g.Key,
                g.First().Employee.FullName,
                g.First().Employee.EmployeeNumber,
                g.Select(te => new YesterdayTimeEntryDto(
                    te.ProjectId,
                    te.Project.Name,
                    te.Project.Number,
                    te.CostCodeId,
                    te.CostCode.Code,
                    te.CostCode.Description,
                    te.RegularHours,
                    te.OvertimeHours,
                    te.DoubletimeHours,
                    te.TotalHours,
                    te.Description
                )).ToList()
            ))
            .ToList();

        var totalHours = entries.Sum(e => e.TotalHours);
        var uniqueEmployees = entries.Select(e => e.EmployeeId).Distinct().Count();

        return Result.Success(new YesterdayCrewEntriesResult(
            entriesDate,
            uniqueEmployees,
            entries.Count,
            totalHours,
            employeeEntries
        ));
    }
}
