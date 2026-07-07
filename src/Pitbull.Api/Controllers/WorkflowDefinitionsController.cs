using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.CQRS;
using Pitbull.Core.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/workflow-definitions")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Workflow")]
public class WorkflowDefinitionsController(IWorkflowApprovalService workflowApproval) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(List<WorkflowDefinitionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var result = await workflowApproval.ListDefinitionsAsync(ct);
        return HandleResult(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WorkflowDefinitionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var result = await workflowApproval.GetDefinitionAsync(id, ct);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = "Admin.Settings")]
    [ProducesResponseType(typeof(WorkflowDefinitionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateWorkflowDefinitionRequest request, CancellationToken ct)
    {
        var command = new CreateWorkflowDefinitionCommand(
            request.EntityType,
            request.TriggerStatus,
            request.ApprovedStatus,
            request.RejectedStatus,
            request.Name,
            request.Description,
            request.IsActive,
            request.AmountThreshold,
            request.Mode,
            request.Priority,
            request.ProjectId,
            request.Steps.Select(s => new CreateWorkflowApprovalStepCommand(
                s.StepOrder, s.Name, s.ApproverType, s.ApproverRole,
                s.ApproverUserId, s.ApproverRelationship, s.IsOptional)).ToList());

        var result = await workflowApproval.CreateDefinitionAsync(command, ct);
        return HandleResult(result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Admin.Settings")]
    [ProducesResponseType(typeof(WorkflowDefinitionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkflowDefinitionRequest request, CancellationToken ct)
    {
        var command = new UpdateWorkflowDefinitionCommand(
            request.Name,
            request.Description,
            request.IsActive,
            request.AmountThreshold,
            request.Mode,
            request.Priority,
            request.ProjectId,
            request.Steps.Select(s => new CreateWorkflowApprovalStepCommand(
                s.StepOrder, s.Name, s.ApproverType, s.ApproverRole,
                s.ApproverUserId, s.ApproverRelationship, s.IsOptional)).ToList());

        var result = await workflowApproval.UpdateDefinitionAsync(id, command, ct);
        return HandleResult(result);
    }

    private IActionResult HandleResult<T>(Result<T> result)
    {
        if (result.IsSuccess)
            return Ok(result.Value);

        return result.ErrorCode switch
        {
            "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
            "FORBIDDEN" => StatusCode(403, new { error = result.Error, code = result.ErrorCode }),
            _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
        };
    }
}

public sealed record CreateWorkflowDefinitionRequest(
    string EntityType,
    string TriggerStatus,
    string ApprovedStatus,
    string RejectedStatus,
    string Name,
    string? Description,
    bool IsActive,
    decimal? AmountThreshold,
    Pitbull.Core.Domain.ApprovalMode Mode,
    int Priority,
    Guid? ProjectId,
    List<WorkflowApprovalStepRequest> Steps);

public sealed record UpdateWorkflowDefinitionRequest(
    string Name,
    string? Description,
    bool IsActive,
    decimal? AmountThreshold,
    Pitbull.Core.Domain.ApprovalMode Mode,
    int Priority,
    Guid? ProjectId,
    List<WorkflowApprovalStepRequest> Steps);

public sealed record WorkflowApprovalStepRequest(
    int StepOrder,
    string Name,
    Pitbull.Core.Domain.ApproverType ApproverType,
    string? ApproverRole,
    Guid? ApproverUserId,
    string? ApproverRelationship,
    bool IsOptional);