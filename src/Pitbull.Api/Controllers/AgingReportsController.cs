using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.Aging;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/aging-reports")]
[Authorize(Roles = "Admin,Manager")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Aging Reports")]
public class AgingReportsController(IAgingReportService agingService) : ControllerBase
{
    [HttpGet("vendors")]
    [ProducesResponseType(typeof(VendorAgingResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetVendorAging([FromQuery] DateOnly? asOfDate)
    {
        var result = await agingService.GetVendorAgingAsync(asOfDate);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("customers")]
    [ProducesResponseType(typeof(CustomerAgingResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetCustomerAging([FromQuery] DateOnly? asOfDate)
    {
        var result = await agingService.GetCustomerAgingAsync(asOfDate);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(AgingSummaryResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSummary([FromQuery] DateOnly? asOfDate)
    {
        var result = await agingService.GetAgingSummaryAsync(asOfDate);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}
