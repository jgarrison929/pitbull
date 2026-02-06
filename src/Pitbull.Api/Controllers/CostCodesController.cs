using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Cost codes for job cost accounting and labor tracking.
/// </summary>
[ApiController]
[Route("api/cost-codes")]
[Authorize]
[EnableRateLimiting("api")]
public class CostCodesController(PitbullDbContext db) : ControllerBase
{
    /// <summary>
    /// List cost codes with optional filtering
    /// </summary>
    [HttpGet]
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
    [HttpGet("{id:guid}")]
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
