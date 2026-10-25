using FluentValidation.TestHelper;
using Pitbull.TimeTracking.Features.ApproveTimeEntry;

namespace Pitbull.Tests.Unit.Validation;

public sealed class ApproveTimeEntryValidatorTests
{
    private readonly ApproveTimeEntryValidator _validator = new();

    private static ApproveTimeEntryCommand CreateValidCommand(
        Guid? timeEntryId = null,
        Guid? approvedById = null,
        string? comments = null)
    {
        return new ApproveTimeEntryCommand(
            TimeEntryId: timeEntryId ?? Guid.NewGuid(),
            ApprovedById: approvedById ?? Guid.NewGuid(),
            Comments: comments
        );
    }

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyTimeEntryId_ShouldHaveError()
    {
        var command = CreateValidCommand(timeEntryId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.TimeEntryId)
            .WithErrorMessage("Time entry ID is required");
    }

    [Fact]
    public void Validate_WithEmptyApprovedById_ShouldHaveError()
    {
        var command = CreateValidCommand(approvedById: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ApprovedById)
            .WithErrorMessage("Approver ID is required");
    }

    [Fact]
    public void Validate_WithCommentsTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(comments: new string('A', 1001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Comments)
            .WithErrorMessage("Comments cannot exceed 1000 characters");
    }

    [Fact]
    public void Validate_WithValidComments_ShouldNotHaveError()
    {
        var command = CreateValidCommand(comments: "Approved after review");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Comments);
    }

    [Fact]
    public void Validate_WithNullComments_ShouldNotHaveError()
    {
        var command = CreateValidCommand(comments: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Comments);
    }
}
