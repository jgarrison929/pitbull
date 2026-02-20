using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.BankReconciliation;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/bank-accounts")]
[Authorize(Policy = "Accounting.ManageBankAccounts")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Bank Reconciliation")]
public class BankAccountsController(IBankReconciliationService service) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListBankAccountsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] bool? isActive,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await service.ListBankAccountsAsync(new ListBankAccountsQuery(isActive, search, page, pageSize));
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BankAccountDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await service.GetBankAccountAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(BankAccountDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateBankAccountRequest request)
    {
        var command = new CreateBankAccountCommand(
            AccountName: request.AccountName,
            BankName: request.BankName,
            AccountNumberLast4: request.AccountNumberLast4,
            RoutingNumber: request.RoutingNumber,
            GlAccountId: request.GlAccountId,
            AccountType: request.AccountType,
            OpeningBalance: request.OpeningBalance,
            OpeningBalanceDate: request.OpeningBalanceDate
        );

        var result = await service.CreateBankAccountAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(BankAccountDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBankAccountRequest request)
    {
        var command = new UpdateBankAccountCommand(
            Id: id,
            AccountName: request.AccountName,
            BankName: request.BankName,
            AccountNumberLast4: request.AccountNumberLast4,
            RoutingNumber: request.RoutingNumber,
            GlAccountId: request.GlAccountId,
            IsActive: request.IsActive
        );

        var result = await service.UpdateBankAccountAsync(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await service.DeleteBankAccountAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    // ─── Transactions sub-resource ───────────────────────────────

    [HttpGet("{bankAccountId:guid}/transactions")]
    [ProducesResponseType(typeof(ListBankTransactionsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListTransactions(
        Guid bankAccountId,
        [FromQuery] bool? isCleared,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var result = await service.ListBankTransactionsAsync(
            new ListBankTransactionsQuery(bankAccountId, isCleared, startDate, endDate, search, page, pageSize));
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    [HttpPost("{bankAccountId:guid}/transactions/import")]
    [ProducesResponseType(typeof(ImportBankTransactionsResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ImportTransactions(
        Guid bankAccountId,
        [FromBody] ImportBankTransactionsRequest request)
    {
        var command = new ImportBankTransactionsCommand(
            BankAccountId: bankAccountId,
            Lines: request.Lines.Select(l => new ImportBankTransactionLine(
                TransactionDate: l.TransactionDate,
                Description: l.Description,
                Amount: l.Amount,
                CheckNumber: l.CheckNumber,
                ReferenceNumber: l.ReferenceNumber,
                TransactionType: l.TransactionType
            )).ToList()
        );

        var result = await service.ImportTransactionsAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpDelete("transactions/{transactionId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTransaction(Guid transactionId)
    {
        var result = await service.DeleteBankTransactionAsync(transactionId);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

// ─── Request records ─────────────────────────────────────────────

public record CreateBankAccountRequest(
    string AccountName,
    string BankName,
    string AccountNumberLast4,
    string? RoutingNumber,
    Guid GlAccountId,
    BankAccountType AccountType = BankAccountType.Checking,
    decimal OpeningBalance = 0,
    DateOnly? OpeningBalanceDate = null
);

public record UpdateBankAccountRequest(
    string? AccountName = null,
    string? BankName = null,
    string? AccountNumberLast4 = null,
    string? RoutingNumber = null,
    Guid? GlAccountId = null,
    bool? IsActive = null
);

public record ImportBankTransactionsRequest(
    List<ImportBankTransactionLineRequest> Lines
);

public record ImportBankTransactionLineRequest(
    DateOnly TransactionDate,
    string Description,
    decimal Amount,
    string? CheckNumber = null,
    string? ReferenceNumber = null,
    BankTransactionType TransactionType = BankTransactionType.Other
);
