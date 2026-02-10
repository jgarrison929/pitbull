using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.CreatePaymentApplication;

namespace Pitbull.Tests.Unit.Validation;

public class CreatePaymentApplicationValidatorTests
{
    private readonly CreatePaymentApplicationValidator _validator = new();

    private static CreatePaymentApplicationCommand CreateValidCommand() => new(
        SubcontractId: Guid.NewGuid(),
        PeriodStart: new DateTime(2026, 1, 1),
        PeriodEnd: new DateTime(2026, 1, 31),
        WorkCompletedThisPeriod: 25000m,
        StoredMaterials: 5000m,
        InvoiceNumber: "INV-2026-001",
        Notes: "January progress billing"
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
    public void PeriodStart_default_fails_validation()
    {
        var command = CreateValidCommand() with { PeriodStart = default };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PeriodStart)
            .WithErrorMessage("Period start date is required");
    }

    [Fact]
    public void PeriodEnd_default_fails_validation()
    {
        var command = CreateValidCommand() with { PeriodEnd = default };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PeriodEnd);
    }

    [Fact]
    public void PeriodEnd_before_PeriodStart_fails_validation()
    {
        var command = CreateValidCommand() with
        {
            PeriodStart = new DateTime(2026, 2, 1),
            PeriodEnd = new DateTime(2026, 1, 15)  // Before start
        };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PeriodEnd)
            .WithErrorMessage("Period end must be after period start");
    }

    [Fact]
    public void PeriodEnd_same_as_PeriodStart_fails_validation()
    {
        var sameDate = new DateTime(2026, 1, 15);
        var command = CreateValidCommand() with
        {
            PeriodStart = sameDate,
            PeriodEnd = sameDate
        };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PeriodEnd)
            .WithErrorMessage("Period end must be after period start");
    }

    [Fact]
    public void PeriodEnd_after_PeriodStart_passes_validation()
    {
        var command = CreateValidCommand() with
        {
            PeriodStart = new DateTime(2026, 1, 1),
            PeriodEnd = new DateTime(2026, 1, 31)
        };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.PeriodEnd);
    }

    [Fact]
    public void WorkCompletedThisPeriod_negative_fails_validation()
    {
        var command = CreateValidCommand() with { WorkCompletedThisPeriod = -100m };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.WorkCompletedThisPeriod)
            .WithErrorMessage("Work completed cannot be negative");
    }

    [Fact]
    public void WorkCompletedThisPeriod_zero_passes_validation()
    {
        var command = CreateValidCommand() with { WorkCompletedThisPeriod = 0m };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.WorkCompletedThisPeriod);
    }

    [Fact]
    public void StoredMaterials_negative_fails_validation()
    {
        var command = CreateValidCommand() with { StoredMaterials = -500m };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.StoredMaterials)
            .WithErrorMessage("Stored materials cannot be negative");
    }

    [Fact]
    public void StoredMaterials_zero_passes_validation()
    {
        var command = CreateValidCommand() with { StoredMaterials = 0m };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.StoredMaterials);
    }

    [Fact]
    public void InvoiceNumber_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { InvoiceNumber = new string('X', 101) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.InvoiceNumber)
            .WithErrorMessage("Invoice number cannot exceed 100 characters");
    }

    [Fact]
    public void InvoiceNumber_null_passes_validation()
    {
        var command = CreateValidCommand() with { InvoiceNumber = null };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.InvoiceNumber);
    }

    [Fact]
    public void Notes_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { Notes = new string('X', 4001) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Notes)
            .WithErrorMessage("Notes cannot exceed 4000 characters");
    }

    [Fact]
    public void Notes_null_passes_validation()
    {
        var command = CreateValidCommand() with { Notes = null };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Notes);
    }

    [Fact]
    public void Minimal_valid_command_passes_validation()
    {
        var command = new CreatePaymentApplicationCommand(
            SubcontractId: Guid.NewGuid(),
            PeriodStart: new DateTime(2026, 1, 1),
            PeriodEnd: new DateTime(2026, 1, 31),
            WorkCompletedThisPeriod: 10000m,
            StoredMaterials: 0m,
            InvoiceNumber: null,
            Notes: null
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
