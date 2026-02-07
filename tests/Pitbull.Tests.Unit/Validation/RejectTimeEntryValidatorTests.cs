using FluentValidation.TestHelper;
using Pitbull.TimeTracking.Features.RejectTimeEntry;

namespace Pitbull.Tests.Unit.Validation;

public sealed class RejectTimeEntryValidatorTests
{
    private readonly RejectTimeEntryValidator _validator = new();

    private static RejectTimeEntryCommand CreateValidCommand(
        Guid? timeEntryId = null,
        Guid? rejectedById = null,
        string? reason = "Hours incorrect, please resubmit")
    {
        return new RejectTimeEntryCommand(
            TimeEntryId: timeEntryId ?? Guid.NewGuid(),
            RejectedById: rejectedById ?? Guid.NewGuid(),
            Reason: reason!
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
    public void Validate_WithEmptyRejectedById_ShouldHaveError()
    {
        var command = CreateValidCommand(rejectedById: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RejectedById)
            .WithErrorMessage("Reviewer ID is required");
    }

    [Fact]
    public void Validate_WithEmptyReason_ShouldHaveError()
    {
        var command = CreateValidCommand(reason: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Reason)
            .WithErrorMessage("Rejection reason is required");
    }

    [Fact]
    public void Validate_WithWhitespaceReason_ShouldHaveError()
    {
        var command = CreateValidCommand(reason: "   ");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Reason)
            .WithErrorMessage("Rejection reason is required");
    }

    [Fact]
    public void Validate_WithReasonTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(reason: new string('A', 1001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Reason)
            .WithErrorMessage("Rejection reason cannot exceed 1000 characters");
    }

    [Fact]
    public void Validate_WithValidReason_ShouldNotHaveError()
    {
        var command = CreateValidCommand(reason: "Incorrect project assignment, please fix and resubmit");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Reason);
    }
}
