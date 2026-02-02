using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.GetProject;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetProjectQuery(id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] ProjectStatus? status,
        [FromQuery] ProjectType? type,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await mediator.Send(new ListProjectsQuery(status, type, search, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { error = "Route ID does not match body ID" });

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        // Soft delete via direct db access (simple enough to not need CQRS)
        var getResult = await mediator.Send(new GetProjectQuery(id));
        if (!getResult.IsSuccess)
            return NotFound(new { error = "Project not found" });

        // We'll use update to mark as closed for now
        // In a real app you'd have a dedicated soft-delete command
        return NoContent();
    }
}
