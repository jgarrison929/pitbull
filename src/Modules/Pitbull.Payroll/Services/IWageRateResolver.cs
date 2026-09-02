using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Payroll.Services;

public sealed record WageRateRequest(
    Guid EmployeeId,
    Guid ProjectId,
    DateOnly WorkDate,
    Guid? WorkClassificationId,
    string? ShiftCode,
    string? ZoneCode);

public sealed record WageRateResult(
    decimal RegularRate,
    decimal OvertimeMultiplier,
    decimal DoubletimeMultiplier,
    RateSource RateSource,
    Guid? WorkClassificationId,
    Guid? WagePackageId,
    string OverlayPack);

public interface IWageRateResolver
{
    Task<Result<WageRateResult>> ResolveAsync(WageRateRequest request, CancellationToken cancellationToken = default);
}
