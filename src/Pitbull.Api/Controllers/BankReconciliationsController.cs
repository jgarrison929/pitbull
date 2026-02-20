using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.BankReconciliation;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/bank-reconciliations")]
[Authorize(Policy = "Accounting.ManageBankAccounts")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Bank Reconciliation")]
public class BankReconciliationsController(IBankReconciliationService service) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListReconciliationsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? bankAccountId,
        [FromQuery] BankReconciliationStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await service.ListReconciliationsAsync(
            new ListReconciliationsQuery(bankAccountId, status, page, pageSize));
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BankReconciliationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await service.GetReconciliationAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpPost("start")]
    [ProducesResponseType(typeof(BankReconciliationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Start([FromBody] StartReconciliationRequest request)
    {
        var command = new StartReconciliationCommand(
            BankAccountId: request.BankAccountId,
            StatementDate: request.StatementDate,
            StatementEndingBalance: request.StatementEndingBalance
        );

        var result = await service.StartReconciliationAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPost("{id:guid}/match")]
    [ProducesResponseType(typeof(BankReconciliationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> MatchTransaction(Guid id, [FromBody] MatchTransactionRequest request)
    {
        var command = new MatchTransactionCommand(
            ReconciliationId: id,
            BankTransactionId: request.BankTransactionId,
            JournalEntryId: request.JournalEntryId
        );

        var result = await service.MatchTransactionAsync(command);
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

    [HttpPost("{id:guid}/unmatch")]
    [ProducesResponseType(typeof(BankReconciliationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UnmatchTransaction(Guid id, [FromBody] UnmatchTransactionRequest request)
    {
        var command = new UnmatchTransactionCommand(
            ReconciliationId: id,
            BankTransactionId: request.BankTransactionId
        );

        var result = await service.UnmatchTransactionAsync(command);
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

    [HttpPost("{id:guid}/complete")]
    [ProducesResponseType(typeof(BankReconciliationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Complete(Guid id)
    {
        Guid userId = GetCurrentUserId();
        var command = new CompleteReconciliationCommand(id, userId);

        var result = await service.CompleteReconciliationAsync(command);
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

    private Guid GetCurrentUserId()
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out Guid parsed) ? parsed : Guid.Empty;
    }
}

// ─── Request records ─────────────────────────────────────────────

public record StartReconciliationRequest(
    Guid BankAccountId,
    DateOnly StatementDate,
    decimal StatementEndingBalance
);

public record MatchTransactionRequest(
    Guid BankTransactionId,
    Guid? JournalEntryId = null
);

public record UnmatchTransactionRequest(
    Guid BankTransactionId
);
