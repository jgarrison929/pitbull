using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Payroll.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/components")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll Pay Components")]
public class PayComponentsController(IPayComponentService payComponentService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "Payroll.ViewRates")]
    public async Task<IActionResult> List()
    {
        var result = await payComponentService.ListAsync();
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpPost]
    [Authorize(Policy = "Payroll.ManageRates")]
    public async Task<IActionResult> Create([FromBody] CreatePayComponentCommand command)
    {
        var result = await payComponentService.CreateAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }
}
