using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.Features.ChartOfAccounts;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/chart-of-accounts")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Chart Of Accounts")]
public class ChartOfAccountsController(IChartOfAccountService chartOfAccountService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListChartOfAccountsResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        ListChartOfAccountsQuery query = new(search, isActive, page, pageSize);
        var result = await chartOfAccountService.ListChartOfAccountsAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("tree")]
    [ProducesResponseType(typeof(IReadOnlyList<ChartOfAccountTreeNodeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetTree()
    {
        var result = await chartOfAccountService.GetTreeAsync();
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ChartOfAccountDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await chartOfAccountService.GetChartOfAccountAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(ChartOfAccountDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateChartOfAccountRequest request)
    {
        CreateChartOfAccountCommand command = new(
            AccountNumber: request.AccountNumber,
            AccountName: request.AccountName,
            AccountType: request.AccountType,
            ParentAccountId: request.ParentAccountId,
            Description: request.Description,
            IsActive: request.IsActive,
            NormalBalance: request.NormalBalance,
            DepartmentId: request.DepartmentId,
            IsSubledgerControl: request.IsSubledgerControl
        );

        var result = await chartOfAccountService.CreateChartOfAccountAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ChartOfAccountDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateChartOfAccountRequest request)
    {
        UpdateChartOfAccountCommand command = new(
            ChartOfAccountId: id,
            AccountNumber: request.AccountNumber,
            AccountName: request.AccountName,
            AccountType: request.AccountType,
            ParentAccountId: request.ParentAccountId,
            ClearParentAccountId: request.ClearParentAccountId,
            Description: request.Description,
            IsActive: request.IsActive,
            NormalBalance: request.NormalBalance,
            DepartmentId: request.DepartmentId,
            ClearDepartmentId: request.ClearDepartmentId,
            IsSubledgerControl: request.IsSubledgerControl
        );

        var result = await chartOfAccountService.UpdateChartOfAccountAsync(command);
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

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await chartOfAccountService.DeleteChartOfAccountAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

public record CreateChartOfAccountRequest(
    string AccountNumber,
    string AccountName,
    Pitbull.Core.Domain.AccountType AccountType,
    Guid? ParentAccountId = null,
    string? Description = null,
    bool IsActive = true,
    Pitbull.Core.Domain.NormalBalance? NormalBalance = null,
    Guid? DepartmentId = null,
    bool IsSubledgerControl = false
);

public record UpdateChartOfAccountRequest(
    string? AccountNumber = null,
    string? AccountName = null,
    Pitbull.Core.Domain.AccountType? AccountType = null,
    Guid? ParentAccountId = null,
    bool ClearParentAccountId = false,
    string? Description = null,
    bool? IsActive = null,
    Pitbull.Core.Domain.NormalBalance? NormalBalance = null,
    Guid? DepartmentId = null,
    bool ClearDepartmentId = false,
    bool? IsSubledgerControl = null
);
