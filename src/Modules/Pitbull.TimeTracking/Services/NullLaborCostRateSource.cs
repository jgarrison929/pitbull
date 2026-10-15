using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

public sealed class NullLaborCostRateSource : ILaborCostRateSource
{
    public Task<LaborRateQuote?> QuoteAsync(TimeEntry timeEntry, Employee employee, CancellationToken cancellationToken = default)
        => Task.FromResult<LaborRateQuote?>(null);
}
