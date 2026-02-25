using Hangfire;
using Hangfire.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Jobs;
using Pitbull.Core.Jobs;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Enqueue and monitor background jobs.
/// </summary>
[ApiController]
[Route("api/jobs")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Jobs")]
public class JobsController(
    IBackgroundJobClient backgroundJobClient,
    JobStorage jobStorage,
    ITenantContext tenantContext,
    ICompanyContext companyContext) : ControllerBase
{
    internal const string TenantIdParam = "TenantId";

    /// <summary>
    /// Enqueue a one-off background job.
    /// </summary>
    [HttpPost("enqueue")]
    [ProducesResponseType(typeof(EnqueueJobResponse), StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult Enqueue([FromBody] EnqueueJobRequest request)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "system";

        var jobContext = new JobContext
        {
            TenantId = tenantContext.TenantId,
            CompanyId = companyContext.CompanyId,
            UserId = userId,
        };

        string jobId;

        switch (request.JobType)
        {
            case JobType.PdfGeneration:
            {
                if (request.PdfParams is null)
                    return BadRequest(new { error = "PdfParams required for PdfGeneration jobs", code = "VALIDATION_ERROR" });

                var validationError = ValidatePdfParams(request.PdfParams);
                if (validationError is not null)
                    return BadRequest(new { error = validationError, code = "VALIDATION_ERROR" });

                jobId = backgroundJobClient.Enqueue<PdfGenerationJob>(
                    job => job.RunWithParamsAsync(jobContext, request.PdfParams, CancellationToken.None));
                break;
            }

            case JobType.AiBatchProcessing:
            {
                if (request.AiParams is null)
                    return BadRequest(new { error = "AiParams required for AiBatchProcessing jobs", code = "VALIDATION_ERROR" });

                jobId = backgroundJobClient.Enqueue<AiBatchProcessingJob>(
                    job => job.RunOperationAsync(jobContext, request.AiParams, CancellationToken.None));
                break;
            }

            default:
                return BadRequest(new { error = $"Unknown job type: {request.JobType}", code = "VALIDATION_ERROR" });
        }

        // Store tenantId as a job parameter for ownership checks on status queries
        using var connection = jobStorage.GetConnection();
        connection.SetJobParameter(jobId, TenantIdParam, tenantContext.TenantId.ToString());

        return Accepted(new EnqueueJobResponse { JobId = jobId });
    }

    /// <summary>
    /// Check the status of a background job. Returns 404 if the job belongs to a different tenant.
    /// </summary>
    [HttpGet("{jobId}/status")]
    [ProducesResponseType(typeof(JobStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetStatus(string jobId)
    {
        using var connection = jobStorage.GetConnection();

        var jobData = connection.GetJobData(jobId);
        if (jobData is null)
            return NotFound(new { error = "Job not found", code = "NOT_FOUND" });

        // Verify the caller's tenant owns this job
        var jobTenantId = connection.GetJobParameter(jobId, TenantIdParam);
        if (jobTenantId is null || !Guid.TryParse(jobTenantId, out var parsedTenantId)
            || parsedTenantId != tenantContext.TenantId)
        {
            // Return 404 (not 403) to avoid revealing that the job exists for another tenant
            return NotFound(new { error = "Job not found", code = "NOT_FOUND" });
        }

        var monitoringApi = jobStorage.GetMonitoringApi();
        var jobDetails = monitoringApi.JobDetails(jobId);
        var currentState = jobDetails?.History.Count > 0 ? jobDetails.History[0].StateName : jobData.State;

        return Ok(new JobStatusResponse
        {
            JobId = jobId,
            State = currentState,
            CreatedAt = jobData.CreatedAt,
            History = jobDetails?.History.Select(h => new JobStateHistoryEntry
            {
                State = h.StateName,
                Timestamp = h.CreatedAt,
                Reason = h.Reason,
            }).ToList() ?? []
        });
    }

    private static string? ValidatePdfParams(PdfGenerationParams p) => p.ReportType switch
    {
        PdfReportType.ProjectCost when !p.ProjectId.HasValue
            => "ProjectId is required for ProjectCost reports",
        PdfReportType.Wh347 when !p.PayrollRunId.HasValue
            => "PayrollRunId is required for WH-347 reports",
        PdfReportType.SubmittalLog when !p.ProjectId.HasValue
            => "ProjectId is required for SubmittalLog reports",
        PdfReportType.PunchList when !p.ProjectId.HasValue
            => "ProjectId is required for PunchList reports",
        _ => null
    };
}

// ── Request / Response DTOs ──────────────────────────────────────

public enum JobType
{
    PdfGeneration,
    AiBatchProcessing
}

public sealed class EnqueueJobRequest
{
    public JobType JobType { get; init; }
    public PdfGenerationParams? PdfParams { get; init; }
    public AiBatchParams? AiParams { get; init; }
}

public sealed class EnqueueJobResponse
{
    public string JobId { get; init; } = string.Empty;
}

public sealed class JobStatusResponse
{
    public string JobId { get; init; } = string.Empty;
    public string State { get; init; } = string.Empty;
    public DateTime? CreatedAt { get; init; }
    public List<JobStateHistoryEntry> History { get; init; } = [];
}

public sealed class JobStateHistoryEntry
{
    public string State { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
    public string? Reason { get; init; }
}
