using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.Wip;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/wip-reports")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("WIP Reports")]
public class WipReportsController(
    IWipReportService wipReportService,
    IWipGlPostingService wipGlPostingService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListWipReportsResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] WipReportStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListWipReportsQuery query = new(status, page, pageSize);
        var result = await wipReportService.ListWipReportsAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WipReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await wipReportService.GetWipReportAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(WipReportDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateWipReportRequest request)
    {
        CreateWipReportCommand command = new(
            ReportDate: request.ReportDate,
            FiscalYear: request.FiscalYear,
            PeriodNumber: request.PeriodNumber,
            Status: request.Status,
            Lines: request.Lines?.Select(line => new CreateWipReportLineCommand(
                ProjectId: line.ProjectId,
                ContractAmount: line.ContractAmount,
                ApprovedChangeOrders: line.ApprovedChangeOrders,
                RevisedContractAmount: line.RevisedContractAmount,
                TotalCostToDate: line.TotalCostToDate,
                EstimatedCostToComplete: line.EstimatedCostToComplete,
                EstimatedTotalCost: line.EstimatedTotalCost,
                PercentComplete: line.PercentComplete,
                EarnedRevenue: line.EarnedRevenue,
                BilledToDate: line.BilledToDate,
                OverUnderBilling: line.OverUnderBilling)).ToList()
        );

        var result = await wipReportService.CreateWipReportAsync(command, GetCurrentUserId());
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(WipReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWipReportRequest request)
    {
        UpdateWipReportCommand command = new(
            WipReportId: id,
            Status: request.Status,
            Lines: request.Lines?.Select(line => new UpdateWipReportLineCommand(
                WipReportLineId: line.WipReportLineId,
                EstimatedCostToComplete: line.EstimatedCostToComplete)).ToList()
        );

        var result = await wipReportService.UpdateWipReportAsync(command);
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
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await wipReportService.DeleteWipReportAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    [HttpPost("generate")]
    [ProducesResponseType(typeof(WipReportDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Generate([FromBody] GenerateWipReportRequest request)
    {
        GenerateWipReportCommand command = new(
            ReportDate: request.ReportDate,
            FiscalYear: request.FiscalYear,
            PeriodNumber: request.PeriodNumber,
            ProjectEstimates: request.ProjectEstimates?.Select(x => new WipProjectEstimateInput(x.ProjectId, x.EstimatedCostToComplete)).ToList(),
            Status: request.Status
        );

        var result = await wipReportService.GenerateWipReportAsync(command, GetCurrentUserId());
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPost("{id:guid}/post-to-gl")]
    [ProducesResponseType(typeof(WipGlPostResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> PostToGl(Guid id)
    {
        var result = await wipGlPostingService.PostToGlAsync(id, GetCurrentUserId());

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

    private string GetCurrentUserId()
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return string.IsNullOrWhiteSpace(userId) ? "system" : userId;
    }
}

public record CreateWipReportRequest(
    DateOnly ReportDate,
    int FiscalYear,
    int PeriodNumber,
    WipReportStatus Status = WipReportStatus.Draft,
    IReadOnlyList<CreateWipReportLineRequest>? Lines = null
);

public record CreateWipReportLineRequest(
    Guid ProjectId,
    decimal ContractAmount,
    decimal ApprovedChangeOrders,
    decimal RevisedContractAmount,
    decimal TotalCostToDate,
    decimal EstimatedCostToComplete,
    decimal EstimatedTotalCost,
    decimal PercentComplete,
    decimal EarnedRevenue,
    decimal BilledToDate,
    decimal OverUnderBilling
);

public record UpdateWipReportRequest(
    WipReportStatus? Status = null,
    IReadOnlyList<UpdateWipReportLineRequest>? Lines = null
);

public record UpdateWipReportLineRequest(
    Guid WipReportLineId,
    decimal? EstimatedCostToComplete = null
);

public record GenerateWipReportRequest(
    DateOnly ReportDate,
    int FiscalYear,
    int PeriodNumber,
    IReadOnlyList<GenerateWipProjectEstimateRequest>? ProjectEstimates = null,
    WipReportStatus Status = WipReportStatus.Draft
);

public record GenerateWipProjectEstimateRequest(
    Guid ProjectId,
    decimal EstimatedCostToComplete
);
