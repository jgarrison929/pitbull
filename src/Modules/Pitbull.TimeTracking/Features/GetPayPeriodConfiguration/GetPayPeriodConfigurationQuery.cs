using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetPayPeriodConfiguration;

/// <summary>
/// Query to get the tenant's pay period configuration
/// </summary>
public record GetPayPeriodConfigurationQuery : IQuery<PayPeriodConfigurationDto>;

public sealed class GetPayPeriodConfigurationHandler(PitbullDbContext db)
    : IRequestHandler<GetPayPeriodConfigurationQuery, Result<PayPeriodConfigurationDto>>
{
    public async Task<Result<PayPeriodConfigurationDto>> Handle(
        GetPayPeriodConfigurationQuery request, CancellationToken cancellationToken)
    {
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            // Return default configuration if none exists
            return Result.Success(new PayPeriodConfigurationDto
            {
                Id = Guid.Empty,
                Type = PayPeriodType.Weekly,
                WeekStartDay = DayOfWeek.Sunday,
                SemiMonthlyFirstDay = 1,
                SemiMonthlySecondDay = 16,
                AutoLockEnabled = false,
                AutoLockDaysAfterEnd = 3,
                PeriodsToGenerateAhead = 4,
                BiWeeklyReferenceDate = null,
                EnforcementEnabled = true
            });
        }

        return Result.Success(PayPeriodMapper.ToDto(config));
    }
}
