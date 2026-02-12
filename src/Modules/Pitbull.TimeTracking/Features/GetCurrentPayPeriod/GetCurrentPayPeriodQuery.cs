using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;

namespace Pitbull.TimeTracking.Features.GetCurrentPayPeriod;

/// <summary>
/// Query to get the current (or specified date's) pay period
/// </summary>
public record GetCurrentPayPeriodQuery(DateOnly? Date = null) : IQuery<PayPeriodDto>;

public sealed class GetCurrentPayPeriodHandler(PitbullDbContext db, IPayPeriodService payPeriodService)
    : IRequestHandler<GetCurrentPayPeriodQuery, Result<PayPeriodDto>>
{
    public async Task<Result<PayPeriodDto>> Handle(
        GetCurrentPayPeriodQuery request, CancellationToken cancellationToken)
    {
        var targetDate = request.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // Try to find an existing pay period for this date
        var period = await db.Set<PayPeriod>()
            .Include(p => p.LockedBy)
            .Include(p => p.ProcessedBy)
            .Where(p => p.StartDate <= targetDate && p.EndDate >= targetDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (period != null)
        {
            return Result.Success(PayPeriodMapper.ToDto(period));
        }

        // If no period exists, calculate what it would be based on config
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            // Return a default weekly period if no config exists
            var (start, end) = CalculateDefaultWeeklyPeriod(targetDate);
            return Result.Success(new PayPeriodDto
            {
                Id = Guid.Empty, // Indicates not yet created
                StartDate = start,
                EndDate = end,
                Status = PayPeriodStatus.Open,
                CreatedAt = DateTime.UtcNow
            });
        }

        // Calculate period boundaries based on configuration
        var (startDate, endDate) = payPeriodService.CalculatePeriodBoundaries(targetDate, config);

        return Result.Success(new PayPeriodDto
        {
            Id = Guid.Empty, // Indicates not yet created
            StartDate = startDate,
            EndDate = endDate,
            Status = PayPeriodStatus.Open,
            CreatedAt = DateTime.UtcNow
        });
    }

    private static (DateOnly Start, DateOnly End) CalculateDefaultWeeklyPeriod(DateOnly date)
    {
        // Default to Sunday-Saturday week
        var daysToSubtract = ((int)date.DayOfWeek - (int)DayOfWeek.Sunday + 7) % 7;
        var start = date.AddDays(-daysToSubtract);
        var end = start.AddDays(6);
        return (start, end);
    }
}
