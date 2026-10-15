using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Payroll.Features.WagePackages;
using Pitbull.Payroll.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/packages")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll Wage Packages")]
public class WagePackagesController(IWagePackageService wagePackageService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "Payroll.ViewRates")]
    [ProducesResponseType(typeof(ListWagePackagesResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] Guid? unionAgreementId, [FromQuery] Guid? workClassificationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var result = await wagePackageService.ListAsync(new ListWagePackagesQuery(unionAgreementId, workClassificationId, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Payroll.ViewRates")]
    [ProducesResponseType(typeof(WagePackageDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await wagePackageService.GetAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpPost]
    [Authorize(Policy = "Payroll.ManageRates")]
    [ProducesResponseType(typeof(WagePackageDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateWagePackageCommand command)
    {
        var result = await wagePackageService.CreateAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Payroll.ManageRates")]
    [ProducesResponseType(typeof(WagePackageDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWagePackageCommand command)
    {
        var result = await wagePackageService.UpdateAsync(command with { Id = id });
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Payroll.ManageRates")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await wagePackageService.DeleteAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return NoContent();
    }
}
