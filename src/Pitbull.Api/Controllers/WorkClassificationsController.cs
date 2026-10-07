using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Payroll.Features.WorkClassifications;
using Pitbull.Payroll.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/classifications")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll Classifications")]
public class WorkClassificationsController(IWorkClassificationService workClassificationService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "Payroll.ViewRates")]
    [ProducesResponseType(typeof(ListWorkClassificationsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] bool? isActive, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var result = await workClassificationService.ListAsync(new ListWorkClassificationsQuery(isActive, search, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Payroll.ViewRates")]
    [ProducesResponseType(typeof(WorkClassificationDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await workClassificationService.GetAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpPost]
    [Authorize(Policy = "Payroll.ManageRates")]
    [ProducesResponseType(typeof(WorkClassificationDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateWorkClassificationCommand command)
    {
        var result = await workClassificationService.CreateAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Payroll.ManageRates")]
    [ProducesResponseType(typeof(WorkClassificationDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkClassificationCommand command)
    {
        var result = await workClassificationService.UpdateAsync(command with { Id = id });
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
        var result = await workClassificationService.DeleteAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return NoContent();
    }
}
