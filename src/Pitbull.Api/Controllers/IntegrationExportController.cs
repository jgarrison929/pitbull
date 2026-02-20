using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/integrations/export")]
[Authorize(Roles = "Admin,Manager")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Integrations")]
public class IntegrationExportController(
    IIntegrationExportService exportService,
    ILogger<IntegrationExportController> logger) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Export(
        [FromBody] IntegrationExportRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var options = new ExportOptions
            {
                DateFrom = request.DateFrom,
                DateTo = request.DateTo,
                ProjectId = request.ProjectId,
                Status = request.Status
            };

            var result = await exportService.ExportAsync(
                request.EntityType,
                request.Format,
                options,
                cancellationToken);

            return File(result.Content, result.ContentType, result.FileName);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Integration export failed for {EntityType} in {Format}", request.EntityType, request.Format);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("formats")]
    [ProducesResponseType(typeof(IReadOnlyList<ExportFormatInfo>), StatusCodes.Status200OK)]
    public IActionResult GetFormats()
    {
        var formats = exportService.GetSupportedFormats();
        return Ok(formats);
    }
}

public record IntegrationExportRequest
{
    public ExportEntityType EntityType { get; init; }
    public ExportFormat Format { get; init; }
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public Guid? ProjectId { get; init; }
    public string? Status { get; init; }
}
