using Pitbull.Core.CQRS;

namespace Pitbull.Core.Jobs;

/// <summary>
/// Context carried by every background job to maintain multi-tenant isolation.
/// Captured at enqueue time and restored when the job executes.
/// </summary>
public sealed class JobContext
{
    public Guid TenantId { get; init; }
    public Guid CompanyId { get; init; }
    public string UserId { get; init; } = string.Empty;
    public string CorrelationId { get; init; } = Guid.NewGuid().ToString("N");
}

/// <summary>
/// Base interface for all background jobs. Implementations receive a <see cref="JobContext"/>
/// to restore multi-tenant context outside the HTTP pipeline.
/// </summary>
public interface IBackgroundJob
{
    Task<Result> ExecuteAsync(JobContext context, CancellationToken ct);
}

/// <summary>
/// Generic background job that accepts typed parameters.
/// </summary>
public interface IBackgroundJob<in TParams>
{
    Task<Result> ExecuteAsync(JobContext context, TParams parameters, CancellationToken ct);
}
