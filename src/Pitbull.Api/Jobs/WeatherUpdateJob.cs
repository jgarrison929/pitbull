using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Jobs;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services.Weather;

namespace Pitbull.Api.Jobs;

/// <summary>
/// Recurring background job that fetches weather data for all active projects with GPS coordinates.
/// Scheduled every 6 hours via Hangfire. Idempotent — weather data is refreshed each run.
///
/// Runs as a system-level job without specific tenant context — queries all tenants using IgnoreQueryFilters.
/// </summary>
public sealed class WeatherUpdateJob : BackgroundJobBase
{
    private readonly PitbullDbContext _db;
    private readonly IWeatherService _weatherService;

    public WeatherUpdateJob(
        TenantContext tenantContext,
        CompanyContext companyContext,
        PitbullDbContext db,
        IWeatherService weatherService,
        ILogger<WeatherUpdateJob> logger)
        : base(tenantContext, companyContext, logger)
    {
        _db = db;
        _weatherService = weatherService;
    }

    protected override async Task<Result> RunAsync(JobContext context, CancellationToken ct)
    {
        var projects = await _db.Set<Pitbull.Projects.Domain.Project>()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => !p.IsDeleted
                && p.Status == Pitbull.Projects.Domain.ProjectStatus.Active
                && p.Latitude.HasValue
                && p.Longitude.HasValue)
            .Select(p => new { p.Id, p.Name, p.Latitude, p.Longitude, p.TenantId })
            .ToListAsync(ct);

        Logger.LogInformation("Updating weather for {Count} projects with GPS coordinates", projects.Count);

        var successCount = 0;
        var failureCount = 0;

        foreach (var project in projects)
        {
            ct.ThrowIfCancellationRequested();

            var result = await _weatherService.GetWeatherAsync(
                project.Latitude!.Value, project.Longitude!.Value, DateTime.UtcNow, ct);

            if (result.IsSuccess)
            {
                successCount++;
                Logger.LogDebug("Weather updated for project {ProjectName}: {Summary}, {Temp}°C",
                    project.Name, result.Value!.WeatherSummary, result.Value.CurrentTemperature);
            }
            else
            {
                failureCount++;
                Logger.LogWarning("Failed to fetch weather for project {ProjectName} ({ProjectId}): {Error}",
                    project.Name, project.Id, result.Error);
            }
        }

        Logger.LogInformation("Weather update complete: {Success} succeeded, {Failed} failed out of {Total}",
            successCount, failureCount, projects.Count);

        return Result.Success();
    }
}
