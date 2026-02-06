using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Cost codes for job cost accounting and labor tracking.
/// Cost codes categorize labor by type of work (concrete, framing, electrical, etc.)
/// and are used to track costs against project budgets.
/// </summary>
[ApiController]
[Route("api/cost-codes")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Cost Codes")]
public class CostCodesController(PitbullDbContext db) : ControllerBase
{
    /// <summary>
    /// List cost codes with optional filtering
    /// </summary>
    /// <remarks>
    /// Returns paginated cost codes for use in time entry forms and reports.
    /// Default is active codes only. Search matches against code or description.
    ///
    /// Cost types:
    /// - Labor = 0 (default for time entries)
    /// - Material = 1
    /// - Equipment = 2
    /// - Subcontract = 3
    ///
    /// Divisions follow CSI MasterFormat conventions (01-16).
    /// </remarks>
    /// <param name="costType">Filter by cost type (Labor=0, Material=1, Equipment=2, Subcontract=3)</param>
    /// <param name="isActive">Filter by active status (default: true)</param>
    /// <param name="search">Search by code or description</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 100)</param>
    /// <returns>Paginated list of cost codes</returns>
    /// <response code="200">Cost codes list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)] // Paginated CostCodeDto list
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] CostType? costType,
        [FromQuery] bool? isActive,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        var query = db.Set<CostCode>().AsQueryable();

        // Default to active only
        if (isActive ?? true)
            query = query.Where(c => c.IsActive);

        if (costType.HasValue)
            query = query.Where(c => c.CostType == costType.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.ToLower();
            query = query.Where(c =>
                c.Code.ToLower().Contains(searchTerm) ||
                c.Description.ToLower().Contains(searchTerm));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(c => c.Code)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CostCodeDto(
                c.Id,
                c.Code,
                c.Description,
                c.Division,
                c.CostType,
                c.IsActive
            ))
            .ToListAsync();

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages
        });
    }

    /// <summary>
    /// Get a specific cost code by ID
    /// </summary>
    /// <remarks>
    /// Returns full cost code details for display or validation.
    /// </remarks>
    /// <param name="id">Cost code unique identifier</param>
    /// <returns>Cost code details</returns>
    /// <response code="200">Cost code found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Cost code not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CostCodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var costCode = await db.Set<CostCode>()
            .Where(c => c.Id == id)
            .Select(c => new CostCodeDto(
                c.Id,
                c.Code,
                c.Description,
                c.Division,
                c.CostType,
                c.IsActive
            ))
            .FirstOrDefaultAsync();

        if (costCode is null)
            return NotFound(new { error = "Cost code not found" });

        return Ok(costCode);
    }
}

public record CostCodeDto(
    Guid Id,
    string Code,
    string Description,
    string? Division,
    CostType CostType,
    bool IsActive
);
