using Pitbull.Core.CQRS;

namespace Pitbull.Api.Features.SeedData;

/// <summary>
/// Service for seeding demo/test data into the database.
/// </summary>
public interface ISeedDataService
{
    /// <summary>
    /// Seeds the database with realistic construction demo data.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Result containing seed data statistics</returns>
    Task<Result<SeedDataResult>> SeedAsync(CancellationToken cancellationToken = default);
}
