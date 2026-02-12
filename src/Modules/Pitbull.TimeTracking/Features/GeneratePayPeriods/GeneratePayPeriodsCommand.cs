using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;

namespace Pitbull.TimeTracking.Features.GeneratePayPeriods;

/// <summary>
/// Command to generate pay periods based on configuration
/// </summary>
public record GeneratePayPeriodsCommand(
    DateOnly? FromDate = null,
    int? PeriodsToGenerate = null
) : ICommand<GeneratePayPeriodsResult>;

public record GeneratePayPeriodsResult(
    int PeriodsCreated,
    int PeriodsSkipped,
    List<PayPeriodDto> CreatedPeriods
);

public sealed class GeneratePayPeriodsHandler(
    PitbullDbContext db, 
    IPayPeriodService payPeriodService,
    ITenantContext tenantContext)
    : IRequestHandler<GeneratePayPeriodsCommand, Result<GeneratePayPeriodsResult>>
{
    public async Task<Result<GeneratePayPeriodsResult>> Handle(
        GeneratePayPeriodsCommand request, CancellationToken cancellationToken)
    {
        // Get configuration
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            return Result.Failure<GeneratePayPeriodsResult>(
                "Pay period configuration not found. Please configure pay periods first.",
                "CONFIG_NOT_FOUND");
        }

        var fromDate = request.FromDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var periodsToGenerate = request.PeriodsToGenerate ?? config.PeriodsToGenerateAhead;

        // Generate period boundaries
        var periodsToCreate = payPeriodService.GenerateFuturePeriods(config, fromDate, periodsToGenerate);

        // Get existing periods to avoid duplicates
        var existingPeriodStarts = await db.Set<PayPeriod>()
            .Select(p => p.StartDate)
            .ToListAsync(cancellationToken);

        var existingStartDates = existingPeriodStarts.ToHashSet();

        var createdPeriods = new List<PayPeriod>();
        var skippedCount = 0;

        foreach (var (startDate, endDate) in periodsToCreate)
        {
            if (existingStartDates.Contains(startDate))
            {
                skippedCount++;
                continue;
            }

            var period = new PayPeriod
            {
                TenantId = tenantContext.TenantId,
                StartDate = startDate,
                EndDate = endDate,
                Status = PayPeriodStatus.Open
            };

            db.Set<PayPeriod>().Add(period);
            createdPeriods.Add(period);
            existingStartDates.Add(startDate);
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(new GeneratePayPeriodsResult(
            createdPeriods.Count,
            skippedCount,
            createdPeriods.Select(PayPeriodMapper.ToDto).ToList()
        ));
    }
}
