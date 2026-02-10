using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.CreateSubcontract;

namespace Pitbull.Tests.Unit.Validation;

public class CreateSubcontractValidatorTests
{
    private readonly CreateSubcontractValidator _validator = new();

    private static CreateSubcontractCommand CreateValidCommand() => new(
        ProjectId: Guid.NewGuid(),
        SubcontractNumber: "SC-001",
        SubcontractorName: "ABC Contractors",
        SubcontractorContact: "John Doe",
        SubcontractorEmail: "john@abc.com",
        SubcontractorPhone: "555-1234",
        SubcontractorAddress: "123 Main St",
        ScopeOfWork: "Concrete foundation work",
        TradeCode: "CSI-03",
        OriginalValue: 50000m,
        RetainagePercent: 10,
        StartDate: DateTime.UtcNow.AddDays(7),
        CompletionDate: DateTime.UtcNow.AddDays(60),
        LicenseNumber: "LIC-12345",
        Notes: "Standard terms apply"
    );

    [Fact]
    public void Valid_command_passes_validation()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void ProjectId_empty_fails_validation()
    {
        var command = CreateValidCommand() with { ProjectId = Guid.Empty };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ProjectId)
            .WithErrorMessage("Project ID is required");
    }

    [Fact]
    public void SubcontractNumber_empty_fails_validation()
    {
        var command = CreateValidCommand() with { SubcontractNumber = "" };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractNumber)
            .WithErrorMessage("Subcontract number is required");
    }

    [Fact]
    public void SubcontractNumber_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { SubcontractNumber = new string('X', 51) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractNumber)
            .WithErrorMessage("Subcontract number cannot exceed 50 characters");
    }

    [Fact]
    public void SubcontractorName_empty_fails_validation()
    {
        var command = CreateValidCommand() with { SubcontractorName = "" };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractorName)
            .WithErrorMessage("Subcontractor name is required");
    }

    [Fact]
    public void SubcontractorName_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { SubcontractorName = new string('X', 201) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractorName)
            .WithErrorMessage("Subcontractor name cannot exceed 200 characters");
    }

    [Fact]
    public void ScopeOfWork_empty_fails_validation()
    {
        var command = CreateValidCommand() with { ScopeOfWork = "" };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ScopeOfWork)
            .WithErrorMessage("Scope of work is required");
    }

    [Fact]
    public void ScopeOfWork_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { ScopeOfWork = new string('X', 4001) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ScopeOfWork)
            .WithErrorMessage("Scope of work cannot exceed 4000 characters");
    }

    [Fact]
    public void OriginalValue_zero_fails_validation()
    {
        var command = CreateValidCommand() with { OriginalValue = 0 };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.OriginalValue)
            .WithErrorMessage("Original value must be greater than zero");
    }

    [Fact]
    public void OriginalValue_negative_fails_validation()
    {
        var command = CreateValidCommand() with { OriginalValue = -100 };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.OriginalValue)
            .WithErrorMessage("Original value must be greater than zero");
    }

    [Fact]
    public void RetainagePercent_negative_fails_validation()
    {
        var command = CreateValidCommand() with { RetainagePercent = -1 };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RetainagePercent)
            .WithErrorMessage("Retainage percent must be between 0 and 100");
    }

    [Fact]
    public void RetainagePercent_over_100_fails_validation()
    {
        var command = CreateValidCommand() with { RetainagePercent = 101 };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RetainagePercent)
            .WithErrorMessage("Retainage percent must be between 0 and 100");
    }

    [Fact]
    public void RetainagePercent_zero_passes_validation()
    {
        var command = CreateValidCommand() with { RetainagePercent = 0 };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.RetainagePercent);
    }

    [Fact]
    public void RetainagePercent_100_passes_validation()
    {
        var command = CreateValidCommand() with { RetainagePercent = 100 };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.RetainagePercent);
    }

    [Fact]
    public void SubcontractorEmail_invalid_format_fails_validation()
    {
        var command = CreateValidCommand() with { SubcontractorEmail = "not-an-email" };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SubcontractorEmail)
            .WithErrorMessage("Invalid email format");
    }

    [Fact]
    public void SubcontractorEmail_valid_format_passes_validation()
    {
        var command = CreateValidCommand() with { SubcontractorEmail = "valid@email.com" };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.SubcontractorEmail);
    }

    [Fact]
    public void SubcontractorEmail_null_passes_validation()
    {
        var command = CreateValidCommand() with { SubcontractorEmail = null };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.SubcontractorEmail);
    }

    [Fact]
    public void CompletionDate_before_StartDate_fails_validation()
    {
        var startDate = DateTime.UtcNow.AddDays(30);
        var completionDate = DateTime.UtcNow.AddDays(7); // Before start
        var command = CreateValidCommand() with 
        { 
            StartDate = startDate,
            CompletionDate = completionDate 
        };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.CompletionDate)
            .WithErrorMessage("Completion date must be after start date");
    }

    [Fact]
    public void CompletionDate_after_StartDate_passes_validation()
    {
        var startDate = DateTime.UtcNow.AddDays(7);
        var completionDate = DateTime.UtcNow.AddDays(60);
        var command = CreateValidCommand() with 
        { 
            StartDate = startDate,
            CompletionDate = completionDate 
        };
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.CompletionDate);
    }

    [Fact]
    public void Optional_fields_null_passes_validation()
    {
        var command = new CreateSubcontractCommand(
            ProjectId: Guid.NewGuid(),
            SubcontractNumber: "SC-001",
            SubcontractorName: "ABC Contractors",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Concrete work",
            TradeCode: null,
            OriginalValue: 10000m,
            RetainagePercent: 10,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void TradeCode_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { TradeCode = new string('X', 101) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.TradeCode)
            .WithErrorMessage("Trade code cannot exceed 100 characters");
    }

    [Fact]
    public void Notes_too_long_fails_validation()
    {
        var command = CreateValidCommand() with { Notes = new string('X', 4001) };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Notes)
            .WithErrorMessage("Notes cannot exceed 4000 characters");
    }
}
