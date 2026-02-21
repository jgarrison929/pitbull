using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Guided migration accelerator for importing data from legacy ERP systems
/// (Vista, Sage 300, Foundation, QuickBooks) into Pitbull.
/// Extends the existing DataImportController with source detection, field mapping,
/// and a 6-stage validation pipeline.
/// </summary>
[ApiController]
[Route("api/migration")]
[Authorize(Roles = "Admin,Manager")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Migration Accelerator")]
public class MigrationAcceleratorController(
    IMigrationAcceleratorService migrationService,
    PitbullDbContext db) : ControllerBase
{
    // ── Migration Projects ──────────────────────────────────────────────

    /// <summary>
    /// Create a new migration project to track a multi-batch import from a legacy system.
    /// </summary>
    [HttpPost("projects")]
    [ProducesResponseType(typeof(MigrationProjectDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateProject([FromBody] CreateMigrationProjectRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Migration project name is required" });

        var project = new MigrationProject
        {
            Name = request.Name.Trim(),
            SourceSystem = request.SourceSystem?.Trim().ToLowerInvariant() ?? "generic",
            SourceVersion = request.SourceVersion?.Trim(),
            Notes = request.Notes?.Trim(),
            Status = MigrationProjectStatus.Draft,
        };

        db.Set<MigrationProject>().Add(project);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetProject), new { id = project.Id }, ToDto(project));
    }

    /// <summary>
    /// List all migration projects for the current company.
    /// </summary>
    [HttpGet("projects")]
    [ProducesResponseType(typeof(IReadOnlyList<MigrationProjectDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListProjects(CancellationToken ct)
    {
        var projects = await db.Set<MigrationProject>()
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new MigrationProjectDto(
                p.Id, p.Name, p.SourceSystem, p.SourceVersion, p.Status,
                p.TotalRecords, p.ImportedRecords, p.FailedRecords,
                p.CompletedAt, p.Notes, p.CreatedAt))
            .ToListAsync(ct);

        return Ok(projects);
    }

    /// <summary>
    /// Get a specific migration project by ID.
    /// </summary>
    [HttpGet("projects/{id:guid}")]
    [ProducesResponseType(typeof(MigrationProjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProject(Guid id, CancellationToken ct)
    {
        var project = await db.Set<MigrationProject>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (project == null)
            return NotFound(new { error = "Migration project not found" });

        return Ok(ToDto(project));
    }

    // ── Source Detection ────────────────────────────────────────────────

    /// <summary>
    /// Upload a CSV file and auto-detect the source ERP system from column headers.
    /// Returns the detected source system with confidence score and suggested entity type.
    /// </summary>
    [HttpPost("projects/{id:guid}/detect-format")]
    [ProducesResponseType(typeof(DetectFormatResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DetectFormat(Guid id, [FromForm] IFormFile file, CancellationToken ct)
    {
        var project = await db.Set<MigrationProject>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (project == null)
            return NotFound(new { error = "Migration project not found" });

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "A CSV file is required" });

        using var stream = file.OpenReadStream();
        var csv = await CsvParser.ParseAsync(stream, 100, ct);

        var detection = migrationService.DetectSourceSystem(csv.Headers);

        // Update project with detected source system if confidence is high
        if (detection.Confidence >= 0.5m)
        {
            project.SourceSystem = detection.SourceSystem;
            await db.SaveChangesAsync(ct);
        }

        return Ok(new DetectFormatResponse(
            detection.SourceSystem,
            detection.DisplayName,
            detection.Confidence,
            csv.Headers,
            csv.Rows.Count));
    }

    // ── Field Mapping ───────────────────────────────────────────────────

    /// <summary>
    /// Set field mappings for a migration project.
    /// If no mappings are provided, returns the default suggested mappings based on detected source system.
    /// </summary>
    [HttpPost("projects/{id:guid}/map-fields")]
    [ProducesResponseType(typeof(MapFieldsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MapFields(Guid id, [FromBody] MapFieldsRequest request, CancellationToken ct)
    {
        var project = await db.Set<MigrationProject>()
            .Include(p => p.FieldMappings)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (project == null)
            return NotFound(new { error = "Migration project not found" });

        if (request.Mappings != null && request.Mappings.Count > 0)
        {
            // Replace existing mappings
            db.Set<FieldMapping>().RemoveRange(project.FieldMappings);

            for (var i = 0; i < request.Mappings.Count; i++)
            {
                var m = request.Mappings[i];
                project.FieldMappings.Add(new FieldMapping
                {
                    MigrationProjectId = project.Id,
                    TenantId = project.TenantId,
                    EntityType = m.EntityType,
                    SourceColumn = m.SourceColumn,
                    TargetField = m.TargetField,
                    TransformRule = m.TransformRule,
                    IsRequired = m.IsRequired,
                    SortOrder = i,
                });
            }

            await db.SaveChangesAsync(ct);

            return Ok(new MapFieldsResponse(
                project.Id,
                project.FieldMappings.Select(fm => new FieldMappingDto(
                    fm.Id, fm.EntityType, fm.SourceColumn, fm.TargetField,
                    fm.TransformRule, fm.IsRequired, fm.SortOrder)).ToList(),
                null));
        }

        // Return default suggestions
        var suggestions = migrationService.GetDefaultMappings(
            project.SourceSystem,
            request.EntityType ?? "vendor",
            request.SourceHeaders ?? []);

        return Ok(new MapFieldsResponse(project.Id, null, suggestions.ToList()));
    }

    // ── Validation ──────────────────────────────────────────────────────

    /// <summary>
    /// Run the 6-stage validation pipeline against uploaded data using the project's field mappings.
    /// </summary>
    [HttpPost("projects/{id:guid}/validate")]
    [ProducesResponseType(typeof(ValidationPipelineResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Validate(Guid id, [FromForm] IFormFile file, [FromQuery] string entityType = "vendor", CancellationToken ct = default)
    {
        var project = await db.Set<MigrationProject>()
            .Include(p => p.FieldMappings)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (project == null)
            return NotFound(new { error = "Migration project not found" });

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "A CSV file is required for validation" });

        var mappings = project.FieldMappings
            .Where(fm => fm.EntityType.Equals(entityType, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (mappings.Count == 0)
            return BadRequest(new { error = $"No field mappings configured for entity type '{entityType}'. Configure mappings first." });

        using var stream = file.OpenReadStream();
        var csv = await CsvParser.ParseAsync(stream, 10_000, ct);

        var result = await migrationService.ValidateAsync(entityType, csv.Rows, mappings, ct);

        // Update project stats
        project.TotalRecords = result.TotalRows;
        project.ImportedRecords = result.ValidRows;
        project.FailedRecords = result.ErrorCount;
        project.Status = result.ErrorCount == 0
            ? MigrationProjectStatus.Validated
            : MigrationProjectStatus.InProgress;
        project.ValidationReport = JsonSerializer.Serialize(new
        {
            result.TotalRows,
            result.ValidRows,
            result.ErrorCount,
            result.WarningCount,
            TopErrors = result.Errors.Take(50),
            TopWarnings = result.Warnings.Take(50),
        });

        await db.SaveChangesAsync(ct);

        return Ok(result);
    }

    // ── Execute Import ──────────────────────────────────────────────────

    /// <summary>
    /// Execute the import for a validated migration project.
    /// Delegates to the existing DataImportService after applying field mappings.
    /// </summary>
    [HttpPost("projects/{id:guid}/execute")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Execute(Guid id, CancellationToken ct)
    {
        var project = await db.Set<MigrationProject>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (project == null)
            return NotFound(new { error = "Migration project not found" });

        if (project.Status != MigrationProjectStatus.Validated)
            return BadRequest(new { error = "Project must be validated before execution. Run validation first." });

        project.Status = MigrationProjectStatus.InProgress;
        await db.SaveChangesAsync(ct);

        // The actual import execution delegates to existing DataImportService.
        // This endpoint marks the project as in-progress; the client then uses
        // the existing import/confirm endpoints with the migration project context.
        return Ok(new { projectId = project.Id, status = project.Status.ToString(), message = "Migration project marked as in-progress. Use the import endpoints to execute individual entity imports." });
    }

    // ── Report ──────────────────────────────────────────────────────────

    /// <summary>
    /// Get the validation/import report for a migration project.
    /// </summary>
    [HttpGet("projects/{id:guid}/report")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReport(Guid id, CancellationToken ct)
    {
        var project = await db.Set<MigrationProject>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (project == null)
            return NotFound(new { error = "Migration project not found" });

        object? parsedReport = null;
        if (!string.IsNullOrEmpty(project.ValidationReport))
        {
            try { parsedReport = JsonSerializer.Deserialize<object>(project.ValidationReport); }
            catch { parsedReport = project.ValidationReport; }
        }

        return Ok(new
        {
            project = ToDto(project),
            validationReport = parsedReport,
        });
    }

    // ── Source Profiles ──────────────────────────────────────────────────

    /// <summary>
    /// List supported source ERP systems with export guides.
    /// </summary>
    [HttpGet("source-profiles")]
    [ProducesResponseType(typeof(IReadOnlyList<SourceSystemProfile>), StatusCodes.Status200OK)]
    public IActionResult GetSourceProfiles()
    {
        return Ok(migrationService.GetSourceProfiles());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static MigrationProjectDto ToDto(MigrationProject p) => new(
        p.Id, p.Name, p.SourceSystem, p.SourceVersion, p.Status,
        p.TotalRecords, p.ImportedRecords, p.FailedRecords,
        p.CompletedAt, p.Notes, p.CreatedAt);
}

// ── Request / Response DTOs ─────────────────────────────────────────────

public record CreateMigrationProjectRequest(
    string Name,
    string? SourceSystem = null,
    string? SourceVersion = null,
    string? Notes = null);

public record MigrationProjectDto(
    Guid Id,
    string Name,
    string SourceSystem,
    string? SourceVersion,
    MigrationProjectStatus Status,
    int TotalRecords,
    int ImportedRecords,
    int FailedRecords,
    DateTime? CompletedAt,
    string? Notes,
    DateTime CreatedAt);

public record DetectFormatResponse(
    string SourceSystem,
    string DisplayName,
    decimal Confidence,
    IReadOnlyList<string> Headers,
    int RowCount);

public record MapFieldsRequest(
    string? EntityType = null,
    IReadOnlyList<string>? SourceHeaders = null,
    IReadOnlyList<FieldMappingInput>? Mappings = null);

public record FieldMappingInput(
    string EntityType,
    string SourceColumn,
    string TargetField,
    string? TransformRule = null,
    bool IsRequired = false);

public record FieldMappingDto(
    Guid Id,
    string EntityType,
    string SourceColumn,
    string TargetField,
    string? TransformRule,
    bool IsRequired,
    int SortOrder);

public record MapFieldsResponse(
    Guid ProjectId,
    IReadOnlyList<FieldMappingDto>? SavedMappings,
    IReadOnlyList<SuggestedFieldMapping>? Suggestions);
