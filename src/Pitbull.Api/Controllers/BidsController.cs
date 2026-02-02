using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.ConvertBidToProject;
using Pitbull.Bids.Features.GetBid;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.UpdateBid;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BidsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBidCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetBidQuery(id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] BidStatus? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await mediator.Send(new ListBidsQuery(status, search, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBidCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { error = "Route ID does not match body ID" });

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/convert-to-project")]
    public async Task<IActionResult> ConvertToProject(Guid id, [FromBody] ConvertToProjectRequest request)
    {
        var result = await mediator.Send(new ConvertBidToProjectCommand(id, request.ProjectNumber));
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "INVALID_STATUS" => BadRequest(new { error = result.Error, code = result.ErrorCode }),
                "ALREADY_CONVERTED" => Conflict(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error })
            };
        }

        return Ok(result.Value);
    }
}

public record ConvertToProjectRequest(string ProjectNumber);
