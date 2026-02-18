using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Core.Data;
using Pitbull.ProjectManagement.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("AI")]
public class AiController(
    IAiService aiService,
    IAiApiKeyService aiApiKeyService,
    PitbullDbContext db) : ControllerBase
{
    private Guid GetTenantId()
    {
        var tenantClaim = User.FindFirst("tenant_id")?.Value;
        return Guid.TryParse(tenantClaim, out var tid) ? tid : Guid.Empty;
    }

    // ── Key Management ──────────────────────────────────────────────

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var keys = await db.Set<Pitbull.AI.Domain.AiApiKey>()
            .Where(k => k.TenantId == tenantId && !k.IsDeleted)
            .Select(k => new AiKeyInfoDto(k.Provider, k.KeyFingerprint, k.CreatedAt))
            .ToListAsync(ct);

        return Ok(new AiSettingsDto(keys));
    }

    [HttpPost("settings/keys")]
    public async Task<IActionResult> StoreKey(
        [FromBody] StoreAiKeyRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        await aiApiKeyService.StoreKeyAsync(tenantId, request.Provider, request.ApiKey, null, ct);
        return Ok(new { stored = true, provider = request.Provider });
    }

    [HttpDelete("settings/keys/{provider}")]
    public async Task<IActionResult> RevokeKey(string provider, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        await aiApiKeyService.RevokeKeyAsync(tenantId, provider, ct);
        return Ok(new { revoked = true, provider });
    }

    // ── Document Intelligence ───────────────────────────────────────

    [HttpPost("projects/{projectId}/daily-reports/{reportId}/summary")]
    public async Task<IActionResult> SummarizeDailyReport(
        Guid projectId, Guid reportId, CancellationToken ct)
    {
        var report = await db.Set<PmDailyReport>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == reportId && r.ProjectId == projectId, ct);

        if (report is null)
            return NotFound(new { error = "Daily report not found", code = "NOT_FOUND" });

        var crews = await db.Set<PmDailyReportCrew>()
            .AsNoTracking()
            .Where(c => c.DailyReportId == reportId)
            .ToListAsync(ct);

        var content = BuildDailyReportContent(report, crews);

        var aiRequest = new AiCompletionRequest(
            "You are a construction project manager assistant. Summarize the following daily field report into a concise executive summary. Highlight key activities, weather impacts, crew information, safety concerns, and any delays. Keep it under 200 words.",
            content,
            AiCapability.TextGeneration,
            1024,
            0.3m);

        var tenantId = GetTenantId();
        var result = await aiService.CompleteAsync(tenantId, aiRequest, null, ct);

        if (!result.IsSuccess)
            return StatusCode(503, new { error = result.Error, code = result.ErrorCode });

        return Ok(new AiSummaryResponse(
            result.Value!.Content,
            result.Value.Model,
            result.Value.Provider,
            (long)result.Value.Latency.TotalMilliseconds));
    }

    [HttpPost("projects/{projectId}/submittals/{submittalId}/review")]
    public async Task<IActionResult> ReviewSubmittal(
        Guid projectId, Guid submittalId, CancellationToken ct)
    {
        var submittal = await db.Set<PmSubmittal>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == submittalId && s.ProjectId == projectId, ct);

        if (submittal is null)
            return NotFound(new { error = "Submittal not found", code = "NOT_FOUND" });

        var content = BuildSubmittalContent(submittal);

        var aiRequest = new AiCompletionRequest(
            "You are a construction submittal reviewer. Analyze the following submittal information and provide a review covering: 1) Completeness of the submission, 2) Spec section compliance observations, 3) Potential concerns or questions for the subcontractor, 4) Recommendation (Approve, Approve as Noted, Revise & Resubmit, or Reject). Be specific and actionable.",
            content,
            AiCapability.Analysis,
            2048,
            0.2m);

        var tenantId = GetTenantId();
        var result = await aiService.CompleteAsync(tenantId, aiRequest, null, ct);

        if (!result.IsSuccess)
            return StatusCode(503, new { error = result.Error, code = result.ErrorCode });

        return Ok(new AiReviewResponse(
            result.Value!.Content,
            result.Value.Model,
            result.Value.Provider,
            (long)result.Value.Latency.TotalMilliseconds));
    }

    // ── Content Builders ────────────────────────────────────────────

    private static string BuildDailyReportContent(PmDailyReport report, List<PmDailyReportCrew> crews)
    {
        var lines = new List<string>
        {
            $"Report Date: {report.ReportDate:yyyy-MM-dd}",
            $"Report Type: {report.ReportType}",
            $"Status: {report.Status}",
            $"Weather: {report.WeatherSummary ?? "Not recorded"}",
        };

        if (report.TemperatureLow.HasValue || report.TemperatureHigh.HasValue)
            lines.Add($"Temperature: {report.TemperatureLow}°F - {report.TemperatureHigh}°F");

        if (!string.IsNullOrWhiteSpace(report.Precipitation))
            lines.Add($"Precipitation: {report.Precipitation}");

        if (!string.IsNullOrWhiteSpace(report.Wind))
            lines.Add($"Wind: {report.Wind}");

        if (!string.IsNullOrWhiteSpace(report.WorkNarrative))
            lines.Add($"\nWork Narrative:\n{report.WorkNarrative}");

        if (!string.IsNullOrWhiteSpace(report.DelaysNarrative))
            lines.Add($"\nDelays:\n{report.DelaysNarrative}");

        if (!string.IsNullOrWhiteSpace(report.SafetyNarrative))
            lines.Add($"\nSafety:\n{report.SafetyNarrative}");

        if (crews.Count > 0)
        {
            lines.Add($"\nCrew ({crews.Count} companies):");
            foreach (var crew in crews)
                lines.Add($"  - {crew.CompanyName} ({crew.Trade}): {crew.HeadCount} workers, {crew.HoursWorked}h");
        }

        return string.Join("\n", lines);
    }

    private static string BuildSubmittalContent(PmSubmittal submittal)
    {
        var lines = new List<string>
        {
            $"Submittal #{submittal.SubmittalNumber}",
            $"Title: {submittal.Title}",
            $"Type: {submittal.SubmittalType}",
            $"Status: {submittal.Status}",
            $"Revision: {submittal.RevisionNumber}",
        };

        if (!string.IsNullOrWhiteSpace(submittal.SpecSectionCode))
            lines.Add($"Spec Section: {submittal.SpecSectionCode} - {submittal.SpecSectionTitle}");

        if (!string.IsNullOrWhiteSpace(submittal.Description))
            lines.Add($"\nDescription:\n{submittal.Description}");

        if (submittal.RequiredByDate.HasValue)
            lines.Add($"Required By: {submittal.RequiredByDate:yyyy-MM-dd}");

        if (submittal.SubmittedDate.HasValue)
            lines.Add($"Submitted: {submittal.SubmittedDate:yyyy-MM-dd}");

        if (submittal.IsSubstitutionRequest)
            lines.Add("Note: This is a substitution request");

        return string.Join("\n", lines);
    }
}

// ── DTOs ────────────────────────────────────────────────────────────

public record AiSettingsDto(List<AiKeyInfoDto> Keys);
public record AiKeyInfoDto(string Provider, string Fingerprint, DateTime CreatedAt);
public record StoreAiKeyRequest(string Provider, string ApiKey);
public record AiSummaryResponse(string Summary, string Model, string Provider, long LatencyMs);
public record AiReviewResponse(string Review, string Model, string Provider, long LatencyMs);
