using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.CreateChangeOrder;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class CreateChangeOrderValidatorTests
{
    private readonly CreateChangeOrderValidator _validator = new();

    private static CreateChangeOrderCommand CreateValidCommand(
        Guid? subcontractId = null,
        string changeOrderNumber = "CO-001",
        string title = "Additional Foundation Work",
        string description = "Extended footings required due to soil conditions",
        string? reason = "Field condition",
        decimal amount = 15000m,
        int? daysExtension = 5)
    {
        return new CreateChangeOrderCommand(
            SubcontractId: subcontractId ?? Guid.NewGuid(),
            ChangeOrderNumber: changeOrderNumber,
            Title: title,
            Description: description,
            Reason: reason,
            Amount: amount,
            DaysExtension: daysExtension,
            ReferenceNumber: null
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
    public void Validate_WithEmptySubcontractId_ShouldHaveError()
    {
        var command = CreateValidCommand(subcontractId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractId)
            .WithErrorMessage("Subcontract ID is required");
    }

    [Fact]
    public void Validate_WithEmptyChangeOrderNumber_ShouldHaveError()
    {
        var command = CreateValidCommand(changeOrderNumber: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ChangeOrderNumber)
            .WithErrorMessage("Change order number is required");
    }

    [Fact]
    public void Validate_WithChangeOrderNumberTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(changeOrderNumber: new string('X', 51));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ChangeOrderNumber)
            .WithErrorMessage("Change order number cannot exceed 50 characters");
    }

    [Fact]
    public void Validate_WithEmptyTitle_ShouldHaveError()
    {
        var command = CreateValidCommand(title: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Title)
            .WithErrorMessage("Title is required");
    }

    [Fact]
    public void Validate_WithTitleTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(title: new string('A', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Title)
            .WithErrorMessage("Title cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_WithEmptyDescription_ShouldHaveError()
    {
        var command = CreateValidCommand(description: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description is required");
    }

    [Fact]
    public void Validate_WithDescriptionTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(description: new string('A', 4001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description cannot exceed 4000 characters");
    }

    [Fact]
    public void Validate_WithNegativeAmount_ShouldNotHaveError()
    {
        // Negative amounts are valid (deductions)
        var command = CreateValidCommand(amount: -5000m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Validate_WithZeroAmount_ShouldNotHaveError()
    {
        var command = CreateValidCommand(amount: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Validate_WithNegativeDaysExtension_ShouldHaveError()
    {
        var command = CreateValidCommand(daysExtension: -5);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DaysExtension)
            .WithErrorMessage("Days extension cannot be negative");
    }

    [Fact]
    public void Validate_WithZeroDaysExtension_ShouldNotHaveError()
    {
        var command = CreateValidCommand(daysExtension: 0);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.DaysExtension);
    }

    [Fact]
    public void Validate_WithNullDaysExtension_ShouldNotHaveError()
    {
        var command = CreateValidCommand(daysExtension: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.DaysExtension);
    }

    [Fact]
    public void Validate_WithNullReason_ShouldNotHaveError()
    {
        var command = CreateValidCommand(reason: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Reason);
    }
}
