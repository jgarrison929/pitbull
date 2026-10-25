using FluentValidation.TestHelper;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.Equipment;

namespace Pitbull.Tests.Unit.Validation;

public sealed class CreateEquipmentValidatorTests
{
    private readonly CreateEquipmentValidator _validator = new();

    private static CreateEquipmentCommand CreateValidCommand(
        string? code = null,
        string? name = null,
        string? description = null,
        EquipmentType? type = null,
        decimal? hourlyRate = null,
        decimal? billingRate = null)
    {
        return new CreateEquipmentCommand(
            Code: code ?? "EX-001",
            Name: name ?? "CAT 320 Excavator",
            Description: description,
            Type: type ?? EquipmentType.HeavyEquipment,
            HourlyRate: hourlyRate ?? 150m,
            BillingRate: billingRate
        );
    }

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validate_WithEmptyCode_ShouldHaveError(string? code)
    {
        var command = CreateValidCommand(code: code ?? "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Code);
    }

    [Fact]
    public void Validate_WithCodeTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(code: new string('A', 51));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Code)
            .WithErrorMessage("Code cannot exceed 50 characters");
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validate_WithEmptyName_ShouldHaveError(string? name)
    {
        var command = CreateValidCommand(name: name ?? "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_WithNameTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(name: new string('A', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Name cannot exceed 200 characters");
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
    public void Validate_WithNegativeHourlyRate_ShouldHaveError()
    {
        var command = CreateValidCommand(hourlyRate: -10m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.HourlyRate)
            .WithErrorMessage("Hourly rate cannot be negative");
    }

    [Fact]
    public void Validate_WithNegativeBillingRate_ShouldHaveError()
    {
        var command = CreateValidCommand(billingRate: -10m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.BillingRate)
            .WithErrorMessage("Billing rate cannot be negative");
    }

    [Fact]
    public void Validate_WithZeroHourlyRate_ShouldNotHaveError()
    {
        var command = CreateValidCommand(hourlyRate: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.HourlyRate);
    }

    [Fact]
    public void Validate_WithZeroBillingRate_ShouldNotHaveError()
    {
        var command = CreateValidCommand(billingRate: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.BillingRate);
    }

    [Theory]
    [InlineData(EquipmentType.HeavyEquipment)]
    [InlineData(EquipmentType.LightEquipment)]
    [InlineData(EquipmentType.Vehicles)]
    [InlineData(EquipmentType.Tools)]
    [InlineData(EquipmentType.Other)]
    public void Validate_WithValidEquipmentType_ShouldNotHaveError(EquipmentType type)
    {
        var command = CreateValidCommand(type: type);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Type);
    }
}
