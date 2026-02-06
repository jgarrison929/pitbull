using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Tests.Unit.Validation;

public sealed class CreateProjectValidatorTests
{
    private readonly CreateProjectValidator _validator = new();

    private static CreateProjectCommand CreateValidCommand(
        string? name = "Test Project",
        string? number = "PRJ-001",
        ProjectType type = ProjectType.Commercial,
        decimal contractAmount = 500000m,
        string? clientEmail = null,
        DateTime? startDate = null,
        DateTime? estimatedCompletionDate = null)
    {
        return new CreateProjectCommand(
            Name: name ?? "Test Project",
            Number: number ?? "PRJ-001",
            Description: null,
            Type: type,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            ClientName: null,
            ClientContact: null,
            ClientEmail: clientEmail,
            ClientPhone: null,
            StartDate: startDate,
            EstimatedCompletionDate: estimatedCompletionDate,
            ContractAmount: contractAmount,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null
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
    public void Validate_WithEmptyName_ShouldHaveError()
    {
        var command = CreateValidCommand(name: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Project name is required");
    }

    [Fact]
    public void Validate_WithEmptyNumber_ShouldHaveError()
    {
        var command = CreateValidCommand(number: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Number)
            .WithErrorMessage("Project number is required");
    }

    [Fact]
    public void Validate_WithNegativeContractAmount_ShouldHaveError()
    {
        var command = CreateValidCommand(contractAmount: -1000m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ContractAmount)
            .WithErrorMessage("Contract amount cannot be negative");
    }

    [Fact]
    public void Validate_WithNameTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(name: new string('A', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Project name cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_WithInvalidEmail_ShouldHaveError()
    {
        var command = CreateValidCommand(clientEmail: "not-an-email");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ClientEmail)
            .WithErrorMessage("Invalid email format");
    }

    [Fact]
    public void Validate_WithValidEmail_ShouldNotHaveError()
    {
        var command = CreateValidCommand(clientEmail: "client@example.com");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ClientEmail);
    }

    [Fact]
    public void Validate_WithCompletionBeforeStart_ShouldHaveError()
    {
        var command = CreateValidCommand(
            startDate: new DateTime(2026, 6, 1),
            estimatedCompletionDate: new DateTime(2026, 1, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EstimatedCompletionDate)
            .WithErrorMessage("Estimated completion date must be after start date");
    }

    [Fact]
    public void Validate_WithZeroContractAmount_ShouldNotHaveError()
    {
        var command = CreateValidCommand(contractAmount: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ContractAmount);
    }
}
