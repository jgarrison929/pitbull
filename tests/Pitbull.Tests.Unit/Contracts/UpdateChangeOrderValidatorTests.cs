using FluentValidation.TestHelper;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.UpdateChangeOrder;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class UpdateChangeOrderValidatorTests
{
    private readonly UpdateChangeOrderValidator _validator = new();

    private static UpdateChangeOrderCommand CreateValidCommand(
        Guid? id = null,
        string changeOrderNumber = "CO-001",
        string title = "Additional Foundation Work",
        string description = "Extended footings required due to soil conditions",
        string? reason = "Field condition",
        decimal amount = 15000m,
        int? daysExtension = 5,
        ChangeOrderStatus status = ChangeOrderStatus.Pending)
    {
        return new UpdateChangeOrderCommand(
            Id: id ?? Guid.NewGuid(),
            ChangeOrderNumber: changeOrderNumber,
            Title: title,
            Description: description,
            Reason: reason,
            Amount: amount,
            DaysExtension: daysExtension,
            Status: status,
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
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = CreateValidCommand(id: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Change order ID is required");
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
    public void Validate_WithNegativeDaysExtension_ShouldHaveError()
    {
        var command = CreateValidCommand(daysExtension: -5);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DaysExtension)
            .WithErrorMessage("Days extension cannot be negative");
    }

    [Theory]
    [InlineData(ChangeOrderStatus.Pending)]
    [InlineData(ChangeOrderStatus.UnderReview)]
    [InlineData(ChangeOrderStatus.Approved)]
    [InlineData(ChangeOrderStatus.Rejected)]
    [InlineData(ChangeOrderStatus.Withdrawn)]
    [InlineData(ChangeOrderStatus.Void)]
    public void Validate_WithValidStatus_ShouldNotHaveError(ChangeOrderStatus status)
    {
        var command = CreateValidCommand(status: status);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }
}
