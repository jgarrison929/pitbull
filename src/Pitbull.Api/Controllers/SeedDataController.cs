using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Api.Features.SeedData;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Seed data endpoint for demo purposes.
/// Only available in Development environment.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SeedDataController(IMediator mediator, IWebHostEnvironment env) : ControllerBase
{
    /// <summary>
    /// Seeds the database with realistic construction demo data.
    /// Creates sample projects, bids, and bid line items.
    /// Development environment only.
    /// </summary>
    [HttpPost]
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
