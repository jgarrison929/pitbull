using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.LockPayPeriod;

/// <summary>
/// Command to lock a pay period
/// </summary>
public record LockPayPeriodCommand(
    Guid PayPeriodId,
    Guid LockedById,
    string? Notes = null
) : ICommand<PayPeriodDto>;

public sealed class LockPayPeriodHandler(PitbullDbContext db)
    : IRequestHandler<LockPayPeriodCommand, Result<PayPeriodDto>>
{
    public async Task<Result<PayPeriodDto>> Handle(
        LockPayPeriodCommand request, CancellationToken cancellationToken)
    {
        var period = await db.Set<PayPeriod>()
            .Include(p => p.LockedBy)
            .FirstOrDefaultAsync(p => p.Id == request.PayPeriodId, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status == PayPeriodStatus.Locked)
            return Result.Failure<PayPeriodDto>("Pay period is already locked", "ALREADY_LOCKED");

        if (period.Status == PayPeriodStatus.Processed)
            return Result.Failure<PayPeriodDto>("Pay period has been processed and cannot be locked again", "ALREADY_PROCESSED");

        // Verify the locker exists
        var locker = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.LockedById && e.IsActive, cancellationToken);

        if (locker == null)
            return Result.Failure<PayPeriodDto>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        // Lock the period
        period.Status = PayPeriodStatus.Locked;
        period.LockedAt = DateTime.UtcNow;
        period.LockedById = request.LockedById;
        period.Notes = request.Notes;
        period.LockedBy = locker;

        // Create audit log
        var auditLog = new AuditLog
        {
            Action = "PayPeriodLocked",
            ResourceType = "PayPeriod",
            ResourceId = period.Id.ToString(),
            Description = $"Pay period {period.StartDate:MMM d} - {period.EndDate:MMM d, yyyy} locked by {locker.FirstName} {locker.LastName}",
            UserId = request.LockedById.ToString()
        };
        db.Set<AuditLog>().Add(auditLog);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }
}
