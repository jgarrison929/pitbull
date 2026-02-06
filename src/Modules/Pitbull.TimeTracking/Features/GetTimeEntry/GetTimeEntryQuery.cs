using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetTimeEntry;

/// <summary>
/// Query to get a single time entry by ID
/// </summary>
public record GetTimeEntryQuery(Guid TimeEntryId) : IRequest<Result<TimeEntryDto>>;

public sealed class GetTimeEntryHandler(PitbullDbContext db)
    : IRequestHandler<GetTimeEntryQuery, Result<TimeEntryDto>>
{
    public async Task<Result<TimeEntryDto>> Handle(
        GetTimeEntryQuery request, CancellationToken cancellationToken)
    {
        var timeEntry = await db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .FirstOrDefaultAsync(te => te.Id == request.TimeEntryId, cancellationToken);

        if (timeEntry == null)
            return Result.Failure<TimeEntryDto>("Time entry not found", "NOT_FOUND");

        return Result.Success(TimeEntryMapper.ToDto(timeEntry));
    }
}
