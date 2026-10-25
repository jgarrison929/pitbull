using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.CreatePaymentApplication;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class CreatePaymentApplicationValidatorTests
{
    private readonly CreatePaymentApplicationValidator _validator = new();

    private static CreatePaymentApplicationCommand CreateValidCommand(
        Guid? subcontractId = null,
        DateTime? periodStart = null,
        DateTime? periodEnd = null,
        decimal workCompletedThisPeriod = 25000m,
        decimal storedMaterials = 5000m,
        string? invoiceNumber = "INV-001")
    {
        var start = periodStart ?? new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = periodEnd ?? new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc);

        return new CreatePaymentApplicationCommand(
            SubcontractId: subcontractId ?? Guid.NewGuid(),
            PeriodStart: start,
            PeriodEnd: end,
            WorkCompletedThisPeriod: workCompletedThisPeriod,
            StoredMaterials: storedMaterials,
            InvoiceNumber: invoiceNumber,
            Notes: null
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
    public void Validate_WithPeriodEndBeforeStart_ShouldHaveError()
    {
        var command = CreateValidCommand(
            periodStart: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            periodEnd: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PeriodEnd)
            .WithErrorMessage("Period end must be after period start");
    }

    [Fact]
    public void Validate_WithNegativeWorkCompleted_ShouldHaveError()
    {
        var command = CreateValidCommand(workCompletedThisPeriod: -1000m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.WorkCompletedThisPeriod)
            .WithErrorMessage("Work completed cannot be negative");
    }

    [Fact]
    public void Validate_WithZeroWorkCompleted_ShouldNotHaveError()
    {
        var command = CreateValidCommand(workCompletedThisPeriod: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.WorkCompletedThisPeriod);
    }

    [Fact]
    public void Validate_WithNegativeStoredMaterials_ShouldHaveError()
    {
        var command = CreateValidCommand(storedMaterials: -500m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.StoredMaterials)
            .WithErrorMessage("Stored materials cannot be negative");
    }

    [Fact]
    public void Validate_WithZeroStoredMaterials_ShouldNotHaveError()
    {
        var command = CreateValidCommand(storedMaterials: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.StoredMaterials);
    }

    [Fact]
    public void Validate_WithInvoiceNumberTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(invoiceNumber: new string('X', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.InvoiceNumber)
            .WithErrorMessage("Invoice number cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithNullInvoiceNumber_ShouldNotHaveError()
    {
        var command = CreateValidCommand(invoiceNumber: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.InvoiceNumber);
    }
}
