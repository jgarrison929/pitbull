using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.FinancialStatements;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/financial-statements")]
[Authorize(Policy = "Accounting.ViewGL")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Financial Statements")]
public class FinancialStatementsController(IFinancialStatementService financialStatementService) : ControllerBase
{
    [HttpGet("trial-balance")]
    [ProducesResponseType(typeof(TrialBalanceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetTrialBalance(
        [FromQuery] DateOnly? periodStart,
        [FromQuery] DateOnly? periodEnd)
    {
        var result = await financialStatementService.GetTrialBalanceAsync(periodStart, periodEnd);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("balance-sheet")]
    [ProducesResponseType(typeof(BalanceSheetResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetBalanceSheet([FromQuery] DateOnly? asOfDate)
    {
        var result = await financialStatementService.GetBalanceSheetAsync(asOfDate);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("income-statement")]
    [ProducesResponseType(typeof(IncomeStatementResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetIncomeStatement(
        [FromQuery] DateOnly? periodStart,
        [FromQuery] DateOnly? periodEnd)
    {
        var result = await financialStatementService.GetIncomeStatementAsync(periodStart, periodEnd);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}
