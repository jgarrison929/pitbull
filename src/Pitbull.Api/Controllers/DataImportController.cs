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
    IDataExportService dataExportService) : ControllerBase
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
            return BadRequest(new { error = ex.Message });
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
            return BadRequest(new { error = ex.Message });
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
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
