using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Core.Jobs;

/// <summary>
/// Base class for background jobs. Provides multi-tenant context restoration and
/// structured logging for all derived jobs.
///
/// Simple jobs (no extra params): override <see cref="RunAsync"/> and call
/// <see cref="ExecuteAsync"/> as the Hangfire entry point.
///
/// Parameterized jobs: define a custom entry method, call <see cref="InitializeContext"/>
/// and <see cref="BeginJobScope"/> at the top, then run the job logic.
/// </summary>
public abstract class BackgroundJobBase : IBackgroundJob
{
    private readonly TenantContext _tenantContext;
    private readonly CompanyContext _companyContext;

    protected ILogger Logger { get; }

    protected BackgroundJobBase(
        TenantContext tenantContext,
        CompanyContext companyContext,
        ILogger logger)
    {
        _tenantContext = tenantContext;
        _companyContext = companyContext;
        Logger = logger;
    }

    /// <summary>
    /// Restores multi-tenant context from the serialized <see cref="JobContext"/>.
    /// Called automatically by <see cref="ExecuteAsync"/> for simple jobs,
    /// or manually at the top of parameterized job entry methods.
    /// </summary>
    protected void InitializeContext(JobContext context)
    {
        _tenantContext.TenantId = context.TenantId;
        _tenantContext.TenantName = "BackgroundJob";
        _companyContext.CompanyId = context.CompanyId;
        _companyContext.CompanyCode = "BG";
        _companyContext.CompanyName = "BackgroundJob";
    }

    /// <summary>
    /// Creates a structured logging scope with tenant, user, and job metadata.
    /// Dispose the return value when the job completes.
    /// </summary>
    protected IDisposable? BeginJobScope(JobContext context)
    {
        return Logger.BeginScope(new Dictionary<string, object>
        {
            ["TenantId"] = context.TenantId,
            ["CompanyId"] = context.CompanyId,
            ["UserId"] = context.UserId,
            ["CorrelationId"] = context.CorrelationId,
            ["JobType"] = GetType().Name
        });
    }

    /// <summary>
    /// Entry point for simple jobs. Restores tenant context, logs lifecycle, delegates to RunAsync.
    /// </summary>
    public async Task<Result> ExecuteAsync(JobContext context, CancellationToken ct)
    {
        InitializeContext(context);
        using var _ = BeginJobScope(context);

        Logger.LogInformation("Starting background job {JobType}", GetType().Name);

        try
        {
            var result = await RunAsync(context, ct);

            if (result.IsSuccess)
                Logger.LogInformation("Background job {JobType} completed successfully", GetType().Name);
            else
                Logger.LogWarning("Background job {JobType} failed: {Error}", GetType().Name, result.Error);

            return result;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            Logger.LogWarning("Background job {JobType} was cancelled", GetType().Name);
            throw; // Let Hangfire handle cancellation
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Background job {JobType} threw an exception", GetType().Name);
            throw; // Let Hangfire retry
        }
    }

    /// <summary>
    /// Override in simple jobs to implement the job logic.
    /// Not used by parameterized jobs (they define their own entry method).
    /// </summary>
    protected virtual Task<Result> RunAsync(JobContext context, CancellationToken ct)
    {
        throw new NotImplementedException(
            $"{GetType().Name} must override RunAsync or define a custom entry method.");
    }
}
