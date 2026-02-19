using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.Equipment;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Equipment management for tracking equipment used on projects.
/// Equipment is tenant-scoped (shared across companies).
/// </summary>
[ApiController]
[Route("api/equipment")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Equipment")]
public class EquipmentController(IEquipmentService equipmentService) : ControllerBase
{
    /// <summary>
    /// List equipment with optional filtering
    /// </summary>
    /// <remarks>
    /// Returns paginated equipment list with optional filters by active status, type, and search term.
    /// </remarks>
    /// <param name="isActive">Filter by active status</param>
    /// <param name="type">Filter by equipment type</param>
    /// <param name="searchTerm">Search in code, name, or description</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 25, max: 100)</param>
    /// <returns>Paginated list of equipment</returns>
    /// <response code="200">Equipment list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [ProducesResponseType(typeof(ListEquipmentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] bool? isActive,
        [FromQuery] EquipmentType? type,
        [FromQuery] string? searchTerm,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var query = new ListEquipmentQuery(isActive, type, searchTerm, page, pageSize);
        var result = await equipmentService.ListEquipmentAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Get equipment by ID
    /// </summary>
    /// <param name="id">Equipment unique identifier</param>
    /// <returns>Equipment details</returns>
    /// <response code="200">Equipment found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Equipment not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EquipmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await equipmentService.GetEquipmentAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = "NOT_FOUND" })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    /// <summary>
    /// Create a new equipment item
    /// </summary>
    /// <remarks>
    /// Creates equipment with a unique code within the tenant.
    /// Equipment is shared across all companies in the tenant.
    ///
    /// Sample request:
    ///
    ///     POST /api/equipment
    ///     {
    ///         "code": "EX-001",
    ///         "name": "CAT 320 Excavator",
    ///         "description": "2020 Caterpillar 320 GC Hydraulic Excavator",
    ///         "type": "HeavyEquipment",
    ///         "hourlyRate": 150.00,
    ///         "billingRate": 185.00,
    ///         "serialNumber": "CAT0320GC123456"
    ///     }
    ///
    /// </remarks>
    /// <param name="request">Equipment details</param>
    /// <returns>The newly created equipment</returns>
    /// <response code="201">Equipment created successfully</response>
    /// <response code="400">Validation error or duplicate code</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(EquipmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateEquipmentRequest request)
    {
        var command = new CreateEquipmentCommand(
            Code: request.Code,
            Name: request.Name,
            Description: request.Description,
            Type: request.Type,
            HourlyRate: request.HourlyRate,
            BillingRate: request.BillingRate,
            IsActive: request.IsActive,
            SerialNumber: request.SerialNumber,
            LicensePlate: request.LicensePlate
        );

        var result = await equipmentService.CreateEquipmentAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById),
            new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Update an existing equipment item
    /// </summary>
    /// <remarks>
    /// Updates equipment details. Only provided fields are updated.
    /// </remarks>
    /// <param name="id">Equipment unique identifier</param>
    /// <param name="request">Fields to update (all optional)</param>
    /// <returns>Updated equipment</returns>
    /// <response code="200">Equipment updated</response>
    /// <response code="400">Validation error or duplicate code</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Equipment not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EquipmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEquipmentRequest request)
    {
        var command = new UpdateEquipmentCommand(
            EquipmentId: id,
            Code: request.Code,
            Name: request.Name,
            Description: request.Description,
            Type: request.Type,
            HourlyRate: request.HourlyRate,
            BillingRate: request.BillingRate,
            IsActive: request.IsActive,
            SerialNumber: request.SerialNumber,
            LicensePlate: request.LicensePlate
        );

        var result = await equipmentService.UpdateEquipmentAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error, code = "NOT_FOUND" }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Delete (soft delete) an equipment item
    /// </summary>
    /// <remarks>
    /// Soft deletes equipment. Existing time entries referencing this equipment are preserved.
    /// </remarks>
    /// <param name="id">Equipment unique identifier</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Equipment deleted</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Equipment not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await equipmentService.DeleteEquipmentAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = "NOT_FOUND" })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

// Request DTOs
public record CreateEquipmentRequest(
    string Code,
    string Name,
    string? Description = null,
    EquipmentType Type = EquipmentType.Other,
    decimal HourlyRate = 0,
    decimal? BillingRate = null,
    bool IsActive = true,
    string? SerialNumber = null,
    string? LicensePlate = null
);

public record UpdateEquipmentRequest(
    string? Code = null,
    string? Name = null,
    string? Description = null,
    EquipmentType? Type = null,
    decimal? HourlyRate = null,
    decimal? BillingRate = null,
    bool? IsActive = null,
    string? SerialNumber = null,
    string? LicensePlate = null
);
