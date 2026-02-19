using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Reports.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Reports")]
public class ReportsController(IReportService reportService) : ControllerBase
{
    [HttpGet("labor-cost")]
    public async Task<IActionResult> GetLaborCost(
        [FromQuery] Guid? projectId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] string groupBy = "employee",
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await reportService.GetLaborCostReportAsync(projectId, from, to, groupBy, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to generate labor cost report", code = "REPORT_ERROR" });
        }
    }

    [HttpGet("project-profitability")]
    public async Task<IActionResult> GetProjectProfitability(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await reportService.GetProjectProfitabilityReportAsync(from, to, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to generate profitability report", code = "REPORT_ERROR" });
        }
    }

    [HttpGet("equipment-utilization")]
    public async Task<IActionResult> GetEquipmentUtilization(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await reportService.GetEquipmentUtilizationReportAsync(from, to, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to generate equipment utilization report", code = "REPORT_ERROR" });
        }
    }

    [HttpGet("weekly-summary")]
    public async Task<IActionResult> GetWeeklySummary(
        [FromQuery] DateOnly? weekOf,
        [FromQuery] Guid? projectId,
        CancellationToken cancellationToken = default)
    {
        var resolvedWeekOf = weekOf ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var result = await reportService.GetWeeklySummaryReportAsync(resolvedWeekOf, projectId, cancellationToken);
        return Ok(result);
    }
}
