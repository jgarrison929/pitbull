using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.CreateChangeOrder;

namespace Pitbull.Tests.Unit.Validation;

public class CreateChangeOrderValidatorTests
{
    private readonly CreateChangeOrderValidator _validator = new();

    private static CreateChangeOrderCommand CreateValidCommand() => new(
        SubcontractId: Guid.NewGuid(),
        ChangeOrderNumber: "CO-001",
        Title: "Additional excavation work",
        Description: "Additional rock removal required due to unforeseen conditions",
        Reason: "Unforeseen conditions",
        Amount: 15000m,
        DaysExtension: 5,
        ReferenceNumber: "RFI-123"
    );

    [Fact]
    public void Valid_command_passes_validation()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void SubcontractId_empty_fails_validation()
    {
        var command = CreateValidCommand() with { SubcontractId = Guid.Empty };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractId)
            .WithErrorMessage("Subcontract ID is required");
    }

    [Fact]
    public void ChangeOrderNumber_empty_fails_validation()
    {
        var command = CreateValidCommand() with { ChangeOrderNumber = "" };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ChangeOrderNumber)
            .WithErrorMessage("Change order number is required");
    }

    [Fact]
    public void ChangeOrderNumber_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { ChangeOrderNumber = new string('X', 51) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ChangeOrderNumber)
            .WithErrorMessage("Change order number cannot exceed 50 characters");
    }

    [Fact]
    public void Title_empty_fails_validation()
    {
        var command = CreateValidCommand() with { Title = "" };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Title)
            .WithErrorMessage("Title is required");
    }

    [Fact]
    public void Title_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { Title = new string('X', 201) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Title)
            .WithErrorMessage("Title cannot exceed 200 characters");
    }

    [Fact]
    public void Description_empty_fails_validation()
    {
        var command = CreateValidCommand() with { Description = "" };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description is required");
    }

    [Fact]
    public void Description_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { Description = new string('X', 4001) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description cannot exceed 4000 characters");
    }

    [Fact]
    public void Reason_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { Reason = new string('X', 501) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Reason)
            .WithErrorMessage("Reason cannot exceed 500 characters");
    }

    [Fact]
    public void Reason_null_passes_validation()
    {
        var command = CreateValidCommand() with { Reason = null };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Reason);
    }

    [Fact]
    public void Amount_positive_passes_validation()
    {
        var command = CreateValidCommand() with { Amount = 5000m };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Amount_negative_passes_validation()
    {
        // Negative amounts represent deductions/credits
        var command = CreateValidCommand() with { Amount = -2500m };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Amount_zero_passes_validation()
    {
        // Zero amount CO for schedule-only changes
        var command = CreateValidCommand() with { Amount = 0m };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void DaysExtension_negative_fails_validation()
    {
        var command = CreateValidCommand() with { DaysExtension = -1 };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DaysExtension)
            .WithErrorMessage("Days extension cannot be negative");
    }

    [Fact]
    public void DaysExtension_zero_passes_validation()
    {
        var command = CreateValidCommand() with { DaysExtension = 0 };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.DaysExtension);
    }

    [Fact]
    public void DaysExtension_null_passes_validation()
    {
        var command = CreateValidCommand() with { DaysExtension = null };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.DaysExtension);
    }

    [Fact]
    public void ReferenceNumber_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { ReferenceNumber = new string('X', 101) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ReferenceNumber)
            .WithErrorMessage("Reference number cannot exceed 100 characters");
    }

    [Fact]
    public void ReferenceNumber_null_passes_validation()
    {
        var command = CreateValidCommand() with { ReferenceNumber = null };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ReferenceNumber);
    }

    [Fact]
    public void Minimal_valid_command_passes_validation()
    {
        var command = new CreateChangeOrderCommand(
            SubcontractId: Guid.NewGuid(),
            ChangeOrderNumber: "CO-001",
            Title: "Simple change",
            Description: "Scope adjustment",
            Reason: null,
            Amount: 1000m,
            DaysExtension: null,
            ReferenceNumber: null
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
