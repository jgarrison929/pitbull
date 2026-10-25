using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.UpdateSubcontract;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class UpdateSubcontractValidatorTests
{
    private readonly UpdateSubcontractValidator _validator = new();

    private static UpdateSubcontractCommand CreateValidCommand(
        Guid? id = null,
        string subcontractNumber = "SC-001",
        string subcontractorName = "ABC Concrete Inc",
        string scopeOfWork = "Concrete foundations and footings",
        decimal originalValue = 150000m,
        decimal retainagePercent = 10m,
        SubcontractStatus status = SubcontractStatus.Draft,
        string? subcontractorEmail = null,
        DateTime? startDate = null,
        DateTime? completionDate = null)
    {
        return new UpdateSubcontractCommand(
            Id: id ?? Guid.NewGuid(),
            SubcontractNumber: subcontractNumber,
            SubcontractorName: subcontractorName,
            SubcontractorContact: null,
            SubcontractorEmail: subcontractorEmail,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: scopeOfWork,
            TradeCode: null,
            OriginalValue: originalValue,
            RetainagePercent: retainagePercent,
            ExecutionDate: null,
            StartDate: startDate,
            CompletionDate: completionDate,
            Status: status,
            InsuranceExpirationDate: null,
            InsuranceCurrent: true,
            LicenseNumber: null,
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
            .WithErrorMessage("Subcontract ID is required");
    }

    [Fact]
    public void Validate_WithEmptySubcontractNumber_ShouldHaveError()
    {
        var command = CreateValidCommand(subcontractNumber: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractNumber)
            .WithErrorMessage("Subcontract number is required");
    }

    [Fact]
    public void Validate_WithSubcontractNumberTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(subcontractNumber: new string('X', 51));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractNumber)
            .WithErrorMessage("Subcontract number cannot exceed 50 characters");
    }

    [Fact]
    public void Validate_WithEmptySubcontractorName_ShouldHaveError()
    {
        var command = CreateValidCommand(subcontractorName: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractorName)
            .WithErrorMessage("Subcontractor name is required");
    }

    [Fact]
    public void Validate_WithSubcontractorNameTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(subcontractorName: new string('A', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractorName)
            .WithErrorMessage("Subcontractor name cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_WithEmptyScopeOfWork_ShouldHaveError()
    {
        var command = CreateValidCommand(scopeOfWork: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ScopeOfWork)
            .WithErrorMessage("Scope of work is required");
    }

    [Fact]
    public void Validate_WithScopeOfWorkTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(scopeOfWork: new string('A', 4001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ScopeOfWork)
            .WithErrorMessage("Scope of work cannot exceed 4000 characters");
    }

    [Fact]
    public void Validate_WithNegativeOriginalValue_ShouldHaveError()
    {
        var command = CreateValidCommand(originalValue: -1000m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.OriginalValue)
            .WithErrorMessage("Original value must be greater than zero");
    }

    [Fact]
    public void Validate_WithZeroOriginalValue_ShouldHaveError()
    {
        var command = CreateValidCommand(originalValue: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.OriginalValue)
            .WithErrorMessage("Original value must be greater than zero");
    }

    [Fact]
    public void Validate_WithNegativeRetainagePercent_ShouldHaveError()
    {
        var command = CreateValidCommand(retainagePercent: -5m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RetainagePercent)
            .WithErrorMessage("Retainage percent must be between 0 and 100");
    }

    [Fact]
    public void Validate_WithRetainagePercentOver100_ShouldHaveError()
    {
        var command = CreateValidCommand(retainagePercent: 101m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RetainagePercent)
            .WithErrorMessage("Retainage percent must be between 0 and 100");
    }

    [Fact]
    public void Validate_WithInvalidEmail_ShouldHaveError()
    {
        var command = CreateValidCommand(subcontractorEmail: "not-an-email");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractorEmail)
            .WithErrorMessage("Invalid email format");
    }

    [Fact]
    public void Validate_WithValidEmail_ShouldNotHaveError()
    {
        var command = CreateValidCommand(subcontractorEmail: "contact@concrete.com");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.SubcontractorEmail);
    }

    [Fact]
    public void Validate_WithCompletionBeforeStart_ShouldHaveError()
    {
        var command = CreateValidCommand(
            startDate: new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            completionDate: new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.CompletionDate)
            .WithErrorMessage("Completion date must be after start date");
    }

    [Fact]
    public void Validate_WithCompletionAfterStart_ShouldNotHaveError()
    {
        var command = CreateValidCommand(
            startDate: new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
            completionDate: new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.CompletionDate);
    }

    [Theory]
    [InlineData(SubcontractStatus.Draft)]
    [InlineData(SubcontractStatus.PendingApproval)]
    [InlineData(SubcontractStatus.Issued)]
    [InlineData(SubcontractStatus.Executed)]
    [InlineData(SubcontractStatus.InProgress)]
    [InlineData(SubcontractStatus.Complete)]
    [InlineData(SubcontractStatus.ClosedOut)]
    [InlineData(SubcontractStatus.Terminated)]
    [InlineData(SubcontractStatus.OnHold)]
    public void Validate_WithValidStatus_ShouldNotHaveError(SubcontractStatus status)
    {
        var command = CreateValidCommand(status: status);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }
}
