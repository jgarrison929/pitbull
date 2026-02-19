using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;
using Pitbull.Core.Entities;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Data Import/Export")]
public class DataImportController(
    IDataImportService dataImportService,
    IDataExportService dataExportService,
    ILogger<DataImportController> logger) : ControllerBase
{
    [HttpPost("import/employees")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(ImportPreviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ImportEmployees([FromForm] IFormFile file, CancellationToken cancellationToken)
        => await PreviewImport(ImportBatchTypes.Employees, file, cancellationToken);

    [HttpPost("import/projects")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(ImportPreviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ImportProjects([FromForm] IFormFile file, CancellationToken cancellationToken)
        => await PreviewImport(ImportBatchTypes.Projects, file, cancellationToken);

    [HttpPost("import/cost-codes")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(ImportPreviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ImportCostCodes([FromForm] IFormFile file, CancellationToken cancellationToken)
        => await PreviewImport(ImportBatchTypes.CostCodes, file, cancellationToken);

    [HttpPost("import/equipment")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(ImportPreviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ImportEquipment([FromForm] IFormFile file, CancellationToken cancellationToken)
        => await PreviewImport(ImportBatchTypes.Equipment, file, cancellationToken);

    [HttpPost("import/time-entries")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(ImportPreviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ImportTimeEntries([FromForm] IFormFile file, CancellationToken cancellationToken)
        => await PreviewImport(ImportBatchTypes.TimeEntries, file, cancellationToken);

    [HttpPost("import/{type}/confirm/{importId:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(ImportCommitResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ConfirmImport(
        [FromRoute] string type,
        [FromRoute] Guid importId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await dataImportService.ConfirmAsync(type, importId, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Import confirmation failed");
            return BadRequest(new { error = "Import confirmation failed", code = "IMPORT_ERROR" });
        }
    }

    [HttpGet("import/history")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(IReadOnlyList<ImportBatchHistoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetImportHistory([FromQuery] int take = 100, CancellationToken cancellationToken = default)
    {
        var history = await dataImportService.GetHistoryAsync(take, cancellationToken);
        return Ok(history);
    }

    [HttpGet("export/time-entries")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> ExportTimeEntries(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        [FromQuery] string format = "vista",
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(format, "vista", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Only format=vista is supported for time entries export" });

        try
        {
            var export = await dataExportService.ExportTimeEntriesVistaAsync(from, to, cancellationToken);
            return File(Encoding.UTF8.GetBytes(export.Content), export.ContentType, export.FileName);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Time entries export failed");
            return BadRequest(new { error = "Export failed. Please try again.", code = "EXPORT_ERROR" });
        }
    }

    [HttpGet("export/employees")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> ExportEmployees(
        [FromQuery] string format = "csv",
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Only format=csv is supported for employees export" });

        var export = await dataExportService.ExportEmployeesCsvAsync(cancellationToken);
        return File(Encoding.UTF8.GetBytes(export.Content), export.ContentType, export.FileName);
    }

    [HttpGet("export/projects")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> ExportProjects(
        [FromQuery] string format = "csv",
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Only format=csv is supported for projects export" });

        var export = await dataExportService.ExportProjectsCsvAsync(cancellationToken);
        return File(Encoding.UTF8.GetBytes(export.Content), export.ContentType, export.FileName);
    }

    [HttpGet("export/cost-codes")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> ExportCostCodes(
        [FromQuery] string format = "csv",
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Only format=csv is supported for cost codes export" });

        var export = await dataExportService.ExportCostCodesCsvAsync(cancellationToken);
        return File(Encoding.UTF8.GetBytes(export.Content), export.ContentType, export.FileName);
    }

    private async Task<IActionResult> PreviewImport(string type, IFormFile file, CancellationToken cancellationToken)
    {
        try
        {
            var result = await dataImportService.PreviewAsync(type, file, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            logger.LogWarning(ex, "Import preview failed for type {Type}", type);
            return BadRequest(new { error = "Import preview failed. Please check the file format.", code = "IMPORT_ERROR" });
        }
    }
}
