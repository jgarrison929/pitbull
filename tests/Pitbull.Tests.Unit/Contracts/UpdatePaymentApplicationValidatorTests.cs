using FluentValidation.TestHelper;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.UpdatePaymentApplication;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class UpdatePaymentApplicationValidatorTests
{
    private readonly UpdatePaymentApplicationValidator _validator = new();

    private static UpdatePaymentApplicationCommand CreateValidCommand(
        Guid? id = null,
        decimal workCompletedThisPeriod = 25000m,
        decimal storedMaterials = 5000m,
        PaymentApplicationStatus status = PaymentApplicationStatus.Draft,
        decimal? approvedAmount = null)
    {
        return new UpdatePaymentApplicationCommand(
            Id: id ?? Guid.NewGuid(),
            WorkCompletedThisPeriod: workCompletedThisPeriod,
            StoredMaterials: storedMaterials,
            Status: status,
            ApprovedBy: null,
            ApprovedAmount: approvedAmount,
            InvoiceNumber: null,
            CheckNumber: null,
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
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = CreateValidCommand(id: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Payment application ID is required");
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
    public void Validate_WithNegativeStoredMaterials_ShouldHaveError()
    {
        var command = CreateValidCommand(storedMaterials: -500m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.StoredMaterials)
            .WithErrorMessage("Stored materials cannot be negative");
    }

    [Fact]
    public void Validate_WithNegativeApprovedAmount_ShouldHaveError()
    {
        var command = CreateValidCommand(approvedAmount: -1000m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ApprovedAmount)
            .WithErrorMessage("Approved amount cannot be negative");
    }

    [Fact]
    public void Validate_WithZeroApprovedAmount_ShouldNotHaveError()
    {
        var command = CreateValidCommand(approvedAmount: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ApprovedAmount);
    }

    [Fact]
    public void Validate_WithNullApprovedAmount_ShouldNotHaveError()
    {
        var command = CreateValidCommand(approvedAmount: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ApprovedAmount);
    }

    [Theory]
    [InlineData(PaymentApplicationStatus.Draft)]
    [InlineData(PaymentApplicationStatus.Submitted)]
    [InlineData(PaymentApplicationStatus.UnderReview)]
    [InlineData(PaymentApplicationStatus.Approved)]
    [InlineData(PaymentApplicationStatus.PartiallyApproved)]
    [InlineData(PaymentApplicationStatus.Rejected)]
    [InlineData(PaymentApplicationStatus.Paid)]
    [InlineData(PaymentApplicationStatus.Void)]
    public void Validate_WithValidStatus_ShouldNotHaveError(PaymentApplicationStatus status)
    {
        var command = CreateValidCommand(status: status);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }
}
