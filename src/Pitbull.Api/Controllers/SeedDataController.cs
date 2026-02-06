using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Features.SeedData;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Seed data endpoint for demo and development purposes.
/// Only available in the Development environment -- returns 404 in production.
/// Requires Admin role.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Development")]
public class SeedDataController(IMediator mediator, IWebHostEnvironment env) : ControllerBase
{
    /// <summary>
    /// Seed the database with demo construction data
    /// </summary>
    /// <remarks>
    /// Populates the current tenant with realistic sample data including:
    /// - Construction projects (various statuses and types)
    /// - Bids with detailed line items
    /// - Project phases
    ///
    /// This endpoint is **idempotent per tenant** -- calling it again after data
    /// already exists returns a 409 Conflict.
    ///
    /// **Development environment only.** Returns 404 in staging/production.
    /// </remarks>
    /// <returns>Summary of created records</returns>
    /// <response code="200">Data seeded successfully</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Not available (non-development environment)</response>
    /// <response code="409">Tenant already has seed data</response>
    [HttpPost]
    [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("seed")]
    [ProducesResponseType(typeof(SeedDataResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Seed()
    {
        if (!env.IsDevelopment())
            return NotFound(); // Hide endpoint entirely in non-dev environments

        var result = await mediator.Send(new SeedDataCommand());

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ALREADY_EXISTS")
                return Conflict(new { error = result.Error, code = result.ErrorCode });

            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        }

        return Ok(result.Value);
    }
}
