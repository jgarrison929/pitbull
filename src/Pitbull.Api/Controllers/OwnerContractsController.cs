using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/owner-contracts")]
[Authorize(Policy = "Contracts.View")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Owner Contracts")]
public class OwnerContractsController(IOwnerContractService contractService) : ControllerBase
{
    // ── Contracts ──

    [HttpGet]
    [ProducesResponseType(typeof(ListOwnerContractsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListContracts(
        [FromQuery] Guid? projectId,
        [FromQuery] OwnerContractStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await contractService.ListContractsAsync(new ListOwnerContractsQuery(projectId, status, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(OwnerContractDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetContract(Guid id)
    {
        var result = await contractService.GetContractAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(OwnerContractDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateContract([FromBody] CreateOwnerContractRequest request)
    {
        CreateOwnerContractCommand command = new(
            ProjectId: request.ProjectId,
            ContractNumber: request.ContractNumber,
            ProjectName: request.ProjectName,
            OriginalContractSum: request.OriginalContractSum,
            OwnerName: request.OwnerName,
            OwnerAddress: request.OwnerAddress,
            ArchitectName: request.ArchitectName,
            ArchitectProjectNumber: request.ArchitectProjectNumber,
            DefaultRetainagePercent: request.DefaultRetainagePercent,
            RetainagePercentMaterials: request.RetainagePercentMaterials,
            ContractDate: request.ContractDate,
            PaymentTermsDays: request.PaymentTermsDays);

        var result = await contractService.CreateContractAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetContract), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(OwnerContractDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateContract(Guid id, [FromBody] UpdateOwnerContractRequest request)
    {
        UpdateOwnerContractCommand command = new(
            ContractId: id,
            ContractNumber: request.ContractNumber,
            ProjectName: request.ProjectName,
            OwnerName: request.OwnerName,
            OwnerAddress: request.OwnerAddress,
            ArchitectName: request.ArchitectName,
            OriginalContractSum: request.OriginalContractSum,
            DefaultRetainagePercent: request.DefaultRetainagePercent,
            RetainagePercentMaterials: request.RetainagePercentMaterials,
            ContractDate: request.ContractDate,
            PaymentTermsDays: request.PaymentTermsDays);

        var result = await contractService.UpdateContractAsync(command);
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
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteContract(Guid id)
    {
        var result = await contractService.DeleteContractAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    // ── Schedule of Values ──

    [HttpGet("{ownerContractId:guid}/sov")]
    [ProducesResponseType(typeof(OwnerSOVDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSOV(Guid ownerContractId)
    {
        var result = await contractService.GetSOVAsync(ownerContractId);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("{ownerContractId:guid}/sov")]
    [ProducesResponseType(typeof(OwnerSOVDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSOV(Guid ownerContractId, [FromBody] CreateSOVRequest request)
    {
        CreateOwnerSOVCommand command = new(
            OwnerContractId: ownerContractId,
            ProjectId: request.ProjectId,
            Name: request.Name ?? "Main SOV");

        var result = await contractService.CreateSOVAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetSOV), new { ownerContractId }, result.Value);
    }

    [HttpPost("sov/{sovId:guid}/activate")]
    [ProducesResponseType(typeof(OwnerSOVDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ActivateSOV(Guid sovId)
    {
        var result = await contractService.ActivateSOVAsync(sovId);
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

    // ── SOV Line Items ──

    [HttpPost("sov/{sovId:guid}/lines")]
    [ProducesResponseType(typeof(OwnerSOVLineItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddLineItem(Guid sovId, [FromBody] AddSOVLineItemRequest request)
    {
        AddSOVLineItemCommand command = new(
            OwnerSOVId: sovId,
            ItemNumber: request.ItemNumber,
            Description: request.Description,
            ScheduledValue: request.ScheduledValue,
            SortOrder: request.SortOrder,
            RetainagePercent: request.RetainagePercent,
            CostCodeId: request.CostCodeId,
            Notes: request.Notes);

        var result = await contractService.AddLineItemAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    [HttpPut("sov/lines/{lineItemId:guid}")]
    [ProducesResponseType(typeof(OwnerSOVLineItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateLineItem(Guid lineItemId, [FromBody] UpdateSOVLineItemRequest request)
    {
        UpdateSOVLineItemCommand command = new(
            LineItemId: lineItemId,
            ItemNumber: request.ItemNumber,
            Description: request.Description,
            ScheduledValue: request.ScheduledValue,
            SortOrder: request.SortOrder,
            RetainagePercent: request.RetainagePercent,
            Notes: request.Notes);

        var result = await contractService.UpdateLineItemAsync(command);
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

    [HttpDelete("sov/lines/{lineItemId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteLineItem(Guid lineItemId)
    {
        var result = await contractService.DeleteLineItemAsync(lineItemId);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

// ── Request Records ──

public record CreateOwnerContractRequest(
    Guid ProjectId,
    string ContractNumber,
    string ProjectName,
    decimal OriginalContractSum,
    string? OwnerName = null,
    string? OwnerAddress = null,
    string? ArchitectName = null,
    string? ArchitectProjectNumber = null,
    decimal DefaultRetainagePercent = 10m,
    decimal RetainagePercentMaterials = 10m,
    DateOnly? ContractDate = null,
    int PaymentTermsDays = 30
);

public record UpdateOwnerContractRequest(
    string? ContractNumber = null,
    string? ProjectName = null,
    string? OwnerName = null,
    string? OwnerAddress = null,
    string? ArchitectName = null,
    decimal? OriginalContractSum = null,
    decimal? DefaultRetainagePercent = null,
    decimal? RetainagePercentMaterials = null,
    DateOnly? ContractDate = null,
    int? PaymentTermsDays = null
);

public record CreateSOVRequest(
    Guid ProjectId,
    string? Name = null
);

public record AddSOVLineItemRequest(
    string ItemNumber,
    string Description,
    decimal ScheduledValue,
    int SortOrder = 0,
    decimal? RetainagePercent = null,
    Guid? CostCodeId = null,
    string? Notes = null
);

public record UpdateSOVLineItemRequest(
    string? ItemNumber = null,
    string? Description = null,
    decimal? ScheduledValue = null,
    int? SortOrder = null,
    decimal? RetainagePercent = null,
    string? Notes = null
);
