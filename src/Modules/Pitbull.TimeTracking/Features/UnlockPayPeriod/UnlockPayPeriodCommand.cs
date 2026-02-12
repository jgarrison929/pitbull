using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.UnlockPayPeriod;

/// <summary>
/// Command to unlock a pay period (admin only, requires reason)
/// </summary>
public record UnlockPayPeriodCommand(
    Guid PayPeriodId,
    Guid UnlockedById,
    string Reason
) : ICommand<PayPeriodDto>;

public sealed class UnlockPayPeriodHandler(PitbullDbContext db)
    : IRequestHandler<UnlockPayPeriodCommand, Result<PayPeriodDto>>
{
    public async Task<Result<PayPeriodDto>> Handle(
        UnlockPayPeriodCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure<PayPeriodDto>("Reason is required to unlock a pay period", "REASON_REQUIRED");

        var period = await db.Set<PayPeriod>()
            .Include(p => p.LockedBy)
            .FirstOrDefaultAsync(p => p.Id == request.PayPeriodId, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status == PayPeriodStatus.Open)
            return Result.Failure<PayPeriodDto>("Pay period is already open", "ALREADY_OPEN");

        // Verify the unlocker exists
        var unlocker = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.UnlockedById && e.IsActive, cancellationToken);

        if (unlocker == null)
            return Result.Failure<PayPeriodDto>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        var previousStatus = period.Status;

        // Unlock the period
        period.Status = PayPeriodStatus.Open;
        period.Notes = $"Unlocked by {unlocker.FirstName} {unlocker.LastName}: {request.Reason}";

        // Create audit log (important for compliance)
        var auditLog = new AuditLog
        {
            Action = "PayPeriodUnlocked",
            ResourceType = "PayPeriod",
            ResourceId = period.Id.ToString(),
            Description = $"Pay period {period.StartDate:MMM d} - {period.EndDate:MMM d, yyyy} unlocked from {previousStatus} status. Reason: {request.Reason}",
            UserId = request.UnlockedById.ToString()
        };
        db.Set<AuditLog>().Add(auditLog);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }
}
