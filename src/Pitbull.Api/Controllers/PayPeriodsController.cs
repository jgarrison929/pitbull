using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Extensions;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/pay-periods")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Pay Periods")]
public class PayPeriodsController(IPayPeriodService payPeriodService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PayPeriodDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] PayPeriodStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await payPeriodService.ListPayPeriodsAsync(status, page, pageSize);
        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreatePayPeriodRequest request)
    {
        var result = await payPeriodService.CreatePayPeriodAsync(request.StartDate, request.EndDate);
        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("current")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCurrent([FromQuery] DateOnly? date = null)
    {
        var result = await payPeriodService.GetCurrentPeriodAsync(date);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "No pay period found for the requested date")
                : this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await payPeriodService.GetPayPeriodAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Pay period not found")
                : this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePayPeriodRequest request)
    {
        var result = await payPeriodService.UpdatePayPeriodAsync(id, request.StartDate, request.EndDate);
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Pay period not found")
                : this.BadRequestError(result.Error ?? "Request failed");
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/lock")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Lock(Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return this.BadRequestError("Unable to resolve user ID from auth token");

        var result = await payPeriodService.LockPayPeriodAsync(id, userId);
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Pay period not found")
                : this.BadRequestError(result.Error ?? "Request failed");
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/unlock")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Unlock(Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return this.BadRequestError("Unable to resolve user ID from auth token");

        var result = await payPeriodService.UnlockPayPeriodAsync(id, userId);
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Pay period not found")
                : this.BadRequestError(result.Error ?? "Request failed");
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/close")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Close(Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return this.BadRequestError("Unable to resolve user ID from auth token");

        var result = await payPeriodService.ClosePayPeriodAsync(id, userId);
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Pay period not found")
                : this.BadRequestError(result.Error ?? "Request failed");
        }

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}/summary")]
    [ProducesResponseType(typeof(PayPeriodSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Summary(Guid id)
    {
        var result = await payPeriodService.GetPayPeriodSummaryAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Pay period not found")
                : this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    [HttpGet("configuration")]
    [ProducesResponseType(typeof(PayPeriodConfigurationDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConfiguration()
    {
        var result = await payPeriodService.GetConfigurationAsync();
        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    [HttpPut("configuration")]
    [Authorize(Policy = "Admin.Settings")]
    [ProducesResponseType(typeof(PayPeriodConfigurationDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateConfiguration([FromBody] UpdatePayPeriodConfigurationRequest request)
    {
        var result = await payPeriodService.UpdateConfigurationAsync(
            request.Type,
            request.WeekStartDay,
            request.SemiMonthlyFirstDay,
            request.SemiMonthlySecondDay,
            request.AutoLockEnabled,
            request.AutoLockDaysAfterEnd,
            request.PeriodsToGenerateAhead,
            request.BiWeeklyReferenceDate,
            request.EnforcementEnabled
        );

        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    [HttpPost("generate")]
    [Authorize(Policy = "Admin.Settings")]
    [ProducesResponseType(typeof(GeneratePayPeriodsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Generate([FromBody] GeneratePayPeriodsRequest request)
    {
        var result = await payPeriodService.GeneratePayPeriodsAsync(request.FromDate, request.PeriodsToGenerate);
        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out userId);
    }
}

public record CreatePayPeriodRequest(
    DateOnly StartDate,
    DateOnly EndDate);

public record UpdatePayPeriodRequest(
    DateOnly StartDate,
    DateOnly EndDate);

public record UpdatePayPeriodConfigurationRequest(
    PayPeriodType Type,
    DayOfWeek WeekStartDay,
    int SemiMonthlyFirstDay = 1,
    int SemiMonthlySecondDay = 16,
    bool AutoLockEnabled = false,
    int AutoLockDaysAfterEnd = 3,
    int PeriodsToGenerateAhead = 4,
    DateOnly? BiWeeklyReferenceDate = null,
    bool EnforcementEnabled = true
);

public record GeneratePayPeriodsRequest(
    DateOnly? FromDate = null,
    int? PeriodsToGenerate = null
);
