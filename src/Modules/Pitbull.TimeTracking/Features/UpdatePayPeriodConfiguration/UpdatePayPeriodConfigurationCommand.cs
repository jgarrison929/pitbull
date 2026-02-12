using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.UpdatePayPeriodConfiguration;

/// <summary>
/// Command to update (or create) the tenant's pay period configuration
/// </summary>
public record UpdatePayPeriodConfigurationCommand(
    PayPeriodType Type,
    DayOfWeek WeekStartDay,
    int SemiMonthlyFirstDay,
    int SemiMonthlySecondDay,
    bool AutoLockEnabled,
    int AutoLockDaysAfterEnd,
    int PeriodsToGenerateAhead,
    DateOnly? BiWeeklyReferenceDate,
    bool EnforcementEnabled
) : ICommand<PayPeriodConfigurationDto>;

public class UpdatePayPeriodConfigurationValidator : AbstractValidator<UpdatePayPeriodConfigurationCommand>
{
    public UpdatePayPeriodConfigurationValidator()
    {
        RuleFor(x => x.SemiMonthlyFirstDay)
            .InclusiveBetween(1, 28)
            .WithMessage("Semi-monthly first day must be between 1 and 28");

        RuleFor(x => x.SemiMonthlySecondDay)
            .InclusiveBetween(2, 31)
            .WithMessage("Semi-monthly second day must be between 2 and 31");

        RuleFor(x => x)
            .Must(x => x.SemiMonthlySecondDay > x.SemiMonthlyFirstDay)
            .WithMessage("Semi-monthly second day must be greater than first day");

        RuleFor(x => x.AutoLockDaysAfterEnd)
            .InclusiveBetween(0, 30)
            .WithMessage("Auto-lock days must be between 0 and 30");

        RuleFor(x => x.PeriodsToGenerateAhead)
            .InclusiveBetween(1, 12)
            .WithMessage("Periods to generate ahead must be between 1 and 12");
    }
}

public sealed class UpdatePayPeriodConfigurationHandler(PitbullDbContext db, ITenantContext tenantContext)
    : IRequestHandler<UpdatePayPeriodConfigurationCommand, Result<PayPeriodConfigurationDto>>
{
    public async Task<Result<PayPeriodConfigurationDto>> Handle(
        UpdatePayPeriodConfigurationCommand request, CancellationToken cancellationToken)
    {
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            // Create new configuration
            config = new PayPeriodConfiguration
            {
                TenantId = tenantContext.TenantId
            };
            db.Set<PayPeriodConfiguration>().Add(config);
        }

        // Update configuration
        config.Type = request.Type;
        config.WeekStartDay = request.WeekStartDay;
        config.SemiMonthlyFirstDay = request.SemiMonthlyFirstDay;
        config.SemiMonthlySecondDay = request.SemiMonthlySecondDay;
        config.AutoLockEnabled = request.AutoLockEnabled;
        config.AutoLockDaysAfterEnd = request.AutoLockDaysAfterEnd;
        config.PeriodsToGenerateAhead = request.PeriodsToGenerateAhead;
        config.BiWeeklyReferenceDate = request.BiWeeklyReferenceDate;
        config.EnforcementEnabled = request.EnforcementEnabled;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(config));
    }
}
