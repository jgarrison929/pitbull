using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;

namespace Pitbull.Tests.Unit.Validation;

public sealed class UpdateTimeEntryValidatorTests
{
    private readonly UpdateTimeEntryValidator _validator = new();

    private static UpdateTimeEntryCommand CreateValidCommand(
        Guid? timeEntryId = null,
        decimal? regularHours = null,
        decimal? overtimeHours = null,
        decimal? doubletimeHours = null,
        string? description = null,
        TimeEntryStatus? newStatus = null,
        Guid? approverId = null,
        string? approverNotes = null)
    {
        return new UpdateTimeEntryCommand(
            TimeEntryId: timeEntryId ?? Guid.NewGuid(),
            RegularHours: regularHours,
            OvertimeHours: overtimeHours,
            DoubletimeHours: doubletimeHours,
            Description: description,
            NewStatus: newStatus,
            ApproverId: approverId,
            ApproverNotes: approverNotes
        );
    }

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand(regularHours: 8m);
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
    public void Validate_WithNegativeRegularHours_ShouldHaveError()
    {
        var command = CreateValidCommand(regularHours: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RegularHours)
            .WithErrorMessage("Regular hours cannot be negative");
    }

    [Fact]
    public void Validate_WithRegularHoursExceeding24_ShouldHaveError()
    {
        var command = CreateValidCommand(regularHours: 25m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RegularHours)
            .WithErrorMessage("Regular hours cannot exceed 24");
    }

    [Fact]
    public void Validate_WithNegativeOvertimeHours_ShouldHaveError()
    {
        var command = CreateValidCommand(overtimeHours: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.OvertimeHours)
            .WithErrorMessage("Overtime hours cannot be negative");
    }

    [Fact]
    public void Validate_WithOvertimeHoursExceeding24_ShouldHaveError()
    {
        var command = CreateValidCommand(overtimeHours: 25m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.OvertimeHours)
            .WithErrorMessage("Overtime hours cannot exceed 24");
    }

    [Fact]
    public void Validate_WithNegativeDoubletimeHours_ShouldHaveError()
    {
        var command = CreateValidCommand(doubletimeHours: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DoubletimeHours)
            .WithErrorMessage("Doubletime hours cannot be negative");
    }

    [Fact]
    public void Validate_WithDoubletimeHoursExceeding24_ShouldHaveError()
    {
        var command = CreateValidCommand(doubletimeHours: 25m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DoubletimeHours)
            .WithErrorMessage("Doubletime hours cannot exceed 24");
    }

    [Fact]
    public void Validate_WithDescriptionTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(description: new string('A', 501));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description cannot exceed 500 characters");
    }

    [Fact]
    public void Validate_WithApproverNotesTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(approverNotes: new string('A', 1001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ApproverNotes)
            .WithErrorMessage("Approver notes cannot exceed 1000 characters");
    }

    [Fact]
    public void Validate_WithApprovedStatusButNoApproverId_ShouldHaveError()
    {
        var command = CreateValidCommand(newStatus: TimeEntryStatus.Approved, approverId: null);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ApproverId)
            .WithErrorMessage("Approver ID is required when approving or rejecting");
    }

    [Fact]
    public void Validate_WithRejectedStatusButNoApproverId_ShouldHaveError()
    {
        var command = CreateValidCommand(newStatus: TimeEntryStatus.Rejected, approverId: null);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ApproverId)
            .WithErrorMessage("Approver ID is required when approving or rejecting");
    }

    [Fact]
    public void Validate_WithApprovedStatusAndApproverId_ShouldNotHaveError()
    {
        var command = CreateValidCommand(newStatus: TimeEntryStatus.Approved, approverId: Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ApproverId);
    }

    [Fact]
    public void Validate_WithRejectedStatusAndApproverId_ShouldNotHaveError()
    {
        var command = CreateValidCommand(newStatus: TimeEntryStatus.Rejected, approverId: Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ApproverId);
    }

    [Fact]
    public void Validate_WithSubmittedStatusWithoutApproverId_ShouldNotHaveError()
    {
        var command = CreateValidCommand(newStatus: TimeEntryStatus.Submitted, approverId: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ApproverId);
    }

    [Fact]
    public void Validate_WithNullHoursFields_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.RegularHours);
        result.ShouldNotHaveValidationErrorFor(x => x.OvertimeHours);
        result.ShouldNotHaveValidationErrorFor(x => x.DoubletimeHours);
    }

    [Fact]
    public void Validate_WithValidDescription_ShouldNotHaveError()
    {
        var command = CreateValidCommand(description: "Updated work description");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void Validate_WithValidApproverNotes_ShouldNotHaveError()
    {
        var command = CreateValidCommand(
            newStatus: TimeEntryStatus.Approved,
            approverId: Guid.NewGuid(),
            approverNotes: "Looks good, approved.");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ApproverNotes);
    }
}
