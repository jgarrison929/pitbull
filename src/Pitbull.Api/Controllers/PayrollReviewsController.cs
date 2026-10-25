using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.PayrollReviews;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/reviews")]
[Authorize(Roles = "Admin,ProjectManager")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll Reviews")]
public class PayrollReviewsController(IPayrollReviewService payrollReviewService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListPayrollRunReviewsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] PayrollReviewStatus? status,
        [FromQuery] Guid? payrollRunId,
        [FromQuery] bool pendingOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListPayrollRunReviewsQuery query = new(status, payrollRunId, pendingOnly, page, pageSize);
        var result = await payrollReviewService.ListAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PayrollRunReviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await payrollReviewService.GetAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("submit")]
    [ProducesResponseType(typeof(PayrollRunReviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Submit([FromBody] SubmitPayrollReviewRequest request)
    {
        SubmitPayrollRunForReviewCommand command = new(request.PayrollRunId, request.ReviewerUserId, request.Comments);
        var result = await payrollReviewService.SubmitAsync(command);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(PayrollRunReviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] PayrollReviewDecisionRequest request)
    {
        ApprovePayrollRunReviewCommand command = new(id, request.ReviewerUserId, request.Comments);
        var result = await payrollReviewService.ApproveAsync(command);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(PayrollRunReviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] PayrollReviewDecisionRequest request)
    {
        RejectPayrollRunReviewCommand command = new(id, request.ReviewerUserId, request.Comments ?? "Review rejected");
        var result = await payrollReviewService.RejectAsync(command);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/escalate")]
    [ProducesResponseType(typeof(PayrollRunReviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Escalate(Guid id, [FromBody] PayrollReviewDecisionRequest request)
    {
        EscalatePayrollRunReviewCommand command = new(id, request.ReviewerUserId, request.Comments ?? "Escalated for compliance review");
        var result = await payrollReviewService.EscalateAsync(command);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}

public record SubmitPayrollReviewRequest(Guid PayrollRunId, string ReviewerUserId, string? Comments);

public record PayrollReviewDecisionRequest(string ReviewerUserId, string? Comments);
