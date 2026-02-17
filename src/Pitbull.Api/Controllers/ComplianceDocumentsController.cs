using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/compliance-documents")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Compliance Documents")]
public class ComplianceDocumentsController(IComplianceDocumentService complianceDocumentService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ComplianceDocumentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? entityType,
        [FromQuery] Guid? entityId,
        [FromQuery] string? status,
        [FromQuery] string? documentType,
        CancellationToken cancellationToken)
    {
        try
        {
            var items = await complianceDocumentService.ListAsync(
                new ComplianceDocumentListQuery(entityType, entityId, status, documentType),
                cancellationToken);

            return Ok(items);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ComplianceDocumentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var item = await complianceDocumentService.GetByIdAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager,Supervisor")]
    [ProducesResponseType(typeof(ComplianceDocumentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateComplianceDocumentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var created = await complianceDocumentService.CreateAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Manager,Supervisor")]
    [ProducesResponseType(typeof(ComplianceDocumentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateComplianceDocumentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await complianceDocumentService.UpdateAsync(id, request, cancellationToken);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await complianceDocumentService.DeleteAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("expiring")]
    [ProducesResponseType(typeof(IReadOnlyList<ComplianceDocumentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetExpiring([FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        var items = await complianceDocumentService.GetExpiringAsync(days, cancellationToken);
        return Ok(items);
    }

    [HttpGet("expired")]
    [ProducesResponseType(typeof(IReadOnlyList<ComplianceDocumentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetExpired(CancellationToken cancellationToken)
    {
        var items = await complianceDocumentService.GetExpiredAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost("update-statuses")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateStatuses(CancellationToken cancellationToken)
    {
        var updated = await complianceDocumentService.UpdateStatusesAsync(cancellationToken);
        return Ok(new { updated });
    }

    [HttpGet("score")]
    [ProducesResponseType(typeof(ComplianceScoreDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetComplianceScore(
        [FromQuery] string entityType,
        [FromQuery] Guid entityId,
        CancellationToken cancellationToken)
    {
        try
        {
            var score = await complianceDocumentService.GetComplianceScoreAsync(entityType, entityId, cancellationToken);
            return Ok(score);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ComplianceDashboardDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboard(CancellationToken cancellationToken)
    {
        var dashboard = await complianceDocumentService.GetDashboardSummaryAsync(cancellationToken);
        return Ok(dashboard);
    }
}
