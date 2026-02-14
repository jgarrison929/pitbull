using FluentValidation.TestHelper;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.Equipment;

namespace Pitbull.Tests.Unit.Validation;

public sealed class UpdateEquipmentValidatorTests
{
    private readonly UpdateEquipmentValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = new UpdateEquipmentCommand(
            EquipmentId: Guid.NewGuid(),
            Code: "EX-002",
            Name: "Updated Excavator"
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyEquipmentId_ShouldHaveError()
    {
        var command = new UpdateEquipmentCommand(EquipmentId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EquipmentId)
            .WithErrorMessage("Equipment ID is required");
    }

    [Fact]
    public void Validate_WithCodeTooLong_ShouldHaveError()
    {
        var command = new UpdateEquipmentCommand(
            EquipmentId: Guid.NewGuid(),
            Code: new string('A', 51)
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Code)
            .WithErrorMessage("Code cannot exceed 50 characters");
    }

    [Fact]
    public void Validate_WithNameTooLong_ShouldHaveError()
    {
        var command = new UpdateEquipmentCommand(
            EquipmentId: Guid.NewGuid(),
            Name: new string('A', 201)
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Name cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_WithNegativeHourlyRate_ShouldHaveError()
    {
        var command = new UpdateEquipmentCommand(
            EquipmentId: Guid.NewGuid(),
            HourlyRate: -10m
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.HourlyRate)
            .WithErrorMessage("Hourly rate cannot be negative");
    }

    [Fact]
    public void Validate_WithNegativeBillingRate_ShouldHaveError()
    {
        var command = new UpdateEquipmentCommand(
            EquipmentId: Guid.NewGuid(),
            BillingRate: -10m
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.BillingRate)
            .WithErrorMessage("Billing rate cannot be negative");
    }

    [Fact]
    public void Validate_WithNoFieldsUpdated_ShouldNotHaveErrors()
    {
        // Valid case: just checking an equipment exists
        var command = new UpdateEquipmentCommand(EquipmentId: Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
