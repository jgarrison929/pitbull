using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.CostCode;

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
public class CostCodesController(ICostCodeService costCodeService) : ControllerBase
{
    /// <summary>
    /// List cost codes with optional filtering
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ListCostCodesResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] CostType? costType,
        [FromQuery] bool? isActive,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        var query = new ListCostCodesQuery(costType, isActive, search, page, pageSize);
        var result = await costCodeService.ListCostCodesAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Get a specific cost code by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CostCodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await costCodeService.GetCostCodeAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Create a new cost code
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CostCodeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateCostCodeRequest request)
    {
        var command = new CreateCostCodeCommand(
            Code: request.Code,
            Description: request.Description,
            Division: request.Division,
            CostType: request.CostType,
            IsActive: request.IsActive
        );

        var result = await costCodeService.CreateCostCodeAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById),
            new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Update an existing cost code
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CostCodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCostCodeRequest request)
    {
        var command = new UpdateCostCodeCommand(
            CostCodeId: id,
            Code: request.Code,
            Description: request.Description,
            Division: request.Division,
            CostType: request.CostType,
            IsActive: request.IsActive
        );

        var result = await costCodeService.UpdateCostCodeAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Delete (soft delete) a cost code
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await costCodeService.DeleteCostCodeAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return NoContent();
    }
}

public record CreateCostCodeRequest(
    string Code,
    string Description,
    string? Division = null,
    CostType CostType = CostType.Labor,
    bool IsActive = true
);

public record UpdateCostCodeRequest(
    string? Code = null,
    string? Description = null,
    string? Division = null,
    CostType? CostType = null,
    bool? IsActive = null
);
