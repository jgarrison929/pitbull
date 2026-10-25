using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/admin/health-dashboard")]
[Authorize(Policy = "SystemAdmin.Health")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Health Dashboard")]
public class AdminHealthDashboardController(IHealthDashboardService healthDashboardService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(AdminHealthDashboardDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var data = await healthDashboardService.GetAsync(cancellationToken);
        return Ok(data);
    }
}
