using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.AccountingPeriods;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/accounting-periods")]
[Authorize(Policy = "Accounting.ManagePeriods")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Accounting Periods")]
public class AccountingPeriodsController(IAccountingPeriodService accountingPeriodService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListAccountingPeriodsResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] int? fiscalYear,
        [FromQuery] PeriodStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListAccountingPeriodsQuery query = new(fiscalYear, status, page, pageSize);
        var result = await accountingPeriodService.GetPeriodsAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AccountingPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await accountingPeriodService.GetPeriodAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(AccountingPeriodDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateAccountingPeriodRequest request)
    {
        CreateAccountingPeriodCommand command = new(
            PeriodNumber: request.PeriodNumber,
            FiscalYear: request.FiscalYear,
            PeriodName: request.PeriodName,
            StartDate: request.StartDate,
            EndDate: request.EndDate
        );

        var result = await accountingPeriodService.CreatePeriodAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await accountingPeriodService.DeletePeriodAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    [HttpPost("{id:guid}/close")]
    [ProducesResponseType(typeof(AccountingPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Close(Guid id)
    {
        Guid userId = GetCurrentUserId();
        var result = await accountingPeriodService.ClosePeriodAsync(id, userId);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/reopen")]
    [ProducesResponseType(typeof(AccountingPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Reopen(Guid id, [FromBody] ReopenPeriodRequest request)
    {
        var result = await accountingPeriodService.ReopenPeriodAsync(id, request.Reason);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    [HttpPost("seed/{fiscalYear:int}")]
    [ProducesResponseType(typeof(List<AccountingPeriodDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> SeedFiscalYear(int fiscalYear)
    {
        var result = await accountingPeriodService.SeedFiscalYearAsync(fiscalYear);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    private Guid GetCurrentUserId()
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out Guid parsed) ? parsed : Guid.Empty;
    }
}

public record CreateAccountingPeriodRequest(
    int PeriodNumber,
    int FiscalYear,
    string PeriodName,
    DateOnly StartDate,
    DateOnly EndDate
);

public record ReopenPeriodRequest(
    string Reason
);
