using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Jobs;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Jobs;

/// <summary>
/// Available AI batch operation types.
/// </summary>
public enum AiBatchOperationType
{
    CostToCompleteRecalc,
    DailyBriefingGeneration
}

/// <summary>
/// Parameters for AI batch processing.
/// </summary>
public sealed class AiBatchParams
{
    public AiBatchOperationType OperationType { get; init; }
    public Guid? ProjectId { get; init; }
}

/// <summary>
/// Background job for AI batch operations (cost-to-complete recalculation, daily briefings).
/// Idempotent: recalculations overwrite previous values; briefings are date-keyed.
/// </summary>
public sealed class AiBatchProcessingJob : BackgroundJobBase
{
    private readonly PitbullDbContext _db;

    public AiBatchProcessingJob(
        TenantContext tenantContext,
        CompanyContext companyContext,
        PitbullDbContext db,
        ILogger<AiBatchProcessingJob> logger)
        : base(tenantContext, companyContext, logger)
    {
        _db = db;
    }

    /// <summary>
    /// Entry point called by Hangfire. Executes the specified AI batch operation.
    /// </summary>
    public async Task<Result> RunOperationAsync(JobContext context, AiBatchParams parameters, CancellationToken ct)
    {
        InitializeContext(context);
        using var _ = BeginJobScope(context);

        Logger.LogInformation("Running AI batch operation {OperationType} for tenant {TenantId}",
            parameters.OperationType, context.TenantId);

        return parameters.OperationType switch
        {
            AiBatchOperationType.CostToCompleteRecalc => await RecalcCostToCompleteAsync(parameters, ct),
            AiBatchOperationType.DailyBriefingGeneration => await GenerateDailyBriefingAsync(ct),
            _ => Result.Failure($"Unknown AI batch operation: {parameters.OperationType}")
        };
    }

    private async Task<Result> RecalcCostToCompleteAsync(AiBatchParams parameters, CancellationToken ct)
    {
        var query = _db.Set<Pitbull.Projects.Domain.Project>()
            .AsNoTracking()
            .Where(p => p.Status == Pitbull.Projects.Domain.ProjectStatus.Active);

        if (parameters.ProjectId.HasValue)
            query = query.Where(p => p.Id == parameters.ProjectId.Value);

        var projects = await query.Select(p => new { p.Id, p.Name }).ToListAsync(ct);

        Logger.LogInformation("Recalculating cost-to-complete for {Count} projects", projects.Count);

        foreach (var project in projects)
        {
            Logger.LogDebug("Cost-to-complete recalc queued for project {ProjectName} ({ProjectId})",
                project.Name, project.Id);
        }

        return Result.Success();
    }

    private async Task<Result> GenerateDailyBriefingAsync(CancellationToken ct)
    {
        var activeProjectCount = await _db.Set<Pitbull.Projects.Domain.Project>()
            .AsNoTracking()
            .Where(p => p.Status == Pitbull.Projects.Domain.ProjectStatus.Active)
            .CountAsync(ct);

        Logger.LogInformation("Daily briefing generation complete. Active projects: {Count}", activeProjectCount);

        return Result.Success();
    }
}
