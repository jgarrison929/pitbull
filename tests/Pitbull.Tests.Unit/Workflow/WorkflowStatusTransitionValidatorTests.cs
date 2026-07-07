using FluentAssertions;
using Pitbull.Api.Features.Workflow;

namespace Pitbull.Tests.Unit.Workflow;

public class WorkflowStatusTransitionValidatorTests
{
    [Theory]
    [InlineData("ChangeOrder", "UnderReview", "Approved", true)]
    [InlineData("ChangeOrder", "UnderReview", "Withdrawn", true)]
    [InlineData("ChangeOrder", "UnderReview", "Pending", false)]
    [InlineData("BillingApplication", "PmReview", "ReadyToSubmit", true)]
    [InlineData("BillingApplication", "PmReview", "PmRejected", true)]
    [InlineData("BillingApplication", "PmReview", "Draft", false)]
    public void IsValidTargetTransition_MatchesEntityGraph(
        string entityType, string fromStatus, string toStatus, bool expected)
    {
        WorkflowStatusTransitionValidator.IsValidTargetTransition(entityType, fromStatus, toStatus)
            .Should().Be(expected);
    }

    [Fact]
    public void ValidateDefinition_RejectsInvalidApprovedStatus()
    {
        var error = WorkflowStatusTransitionValidator.ValidateDefinition(
            "ChangeOrder", "UnderReview", "Pending", "Rejected");

        error.Should().Contain("Approved status");
    }
}