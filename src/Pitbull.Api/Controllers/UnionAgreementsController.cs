using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features.UnionAgreements;
using Pitbull.Payroll.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/agreements")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll Union Agreements")]
public class UnionAgreementsController(IUnionAgreementService unionAgreementService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "Payroll.ViewRates")]
    [ProducesResponseType(typeof(ListUnionAgreementsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] UnionAgreementStatus? status, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var result = await unionAgreementService.ListAsync(new ListUnionAgreementsQuery(status, search, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Payroll.ViewRates")]
    [ProducesResponseType(typeof(UnionAgreementDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await unionAgreementService.GetAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpPost]
    [Authorize(Policy = "Payroll.ManageAgreements")]
    [ProducesResponseType(typeof(UnionAgreementDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateUnionAgreementCommand command)
    {
        var result = await unionAgreementService.CreateAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Payroll.ManageAgreements")]
    [ProducesResponseType(typeof(UnionAgreementDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUnionAgreementCommand command)
    {
        var result = await unionAgreementService.UpdateAsync(command with { Id = id });
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Payroll.ManageAgreements")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await unionAgreementService.DeleteAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return NoContent();
    }
}
