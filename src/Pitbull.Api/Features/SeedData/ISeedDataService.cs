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
    /// <param name="useExternalTransaction">
    /// When true, skips creating an internal transaction (caller is responsible for transaction management).
    /// Used by DemoBootstrapper which already wraps the call in its own transaction with RLS set_config.
    /// </param>
    /// <returns>Result containing seed data statistics</returns>
    Task<Result<SeedDataResult>> SeedAsync(CancellationToken cancellationToken = default, bool useExternalTransaction = false);
}
