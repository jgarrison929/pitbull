using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.UpdateProject;

namespace Pitbull.Tests.Unit.Validation;

public sealed class UpdateProjectValidatorTests
{
    private readonly UpdateProjectValidator _validator = new();

    private static UpdateProjectCommand CreateValidCommand(
        Guid? id = null,
        string? name = "Test Project",
        string? number = "PRJ-001",
        ProjectStatus status = ProjectStatus.Active,
        ProjectType type = ProjectType.Commercial,
        decimal contractAmount = 500000m,
        string? clientEmail = null,
        DateTime? startDate = null,
        DateTime? estimatedCompletionDate = null,
        DateTime? actualCompletionDate = null)
    {
        return new UpdateProjectCommand(
            Id: id ?? Guid.NewGuid(),
            Name: name ?? "Test Project",
            Number: number ?? "PRJ-001",
            Description: null,
            Status: status,
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
            ActualCompletionDate: actualCompletionDate,
            ContractAmount: contractAmount,
            ProjectManagerId: null,
            SuperintendentId: null
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
            .WithErrorMessage("Project ID is required");
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
    public void Validate_WithInvalidEmail_ShouldHaveError()
    {
        var command = CreateValidCommand(clientEmail: "not-an-email");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ClientEmail)
            .WithErrorMessage("Invalid email format");
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
    public void Validate_WithActualCompletionBeforeStart_ShouldHaveError()
    {
        var command = CreateValidCommand(
            startDate: new DateTime(2026, 6, 1),
            actualCompletionDate: new DateTime(2026, 1, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ActualCompletionDate)
            .WithErrorMessage("Actual completion date must be after start date");
    }

    [Fact]
    public void Validate_WithAllStatuses_ShouldNotHaveError()
    {
        foreach (ProjectStatus status in Enum.GetValues(typeof(ProjectStatus)))
        {
            var command = CreateValidCommand(status: status);
            var result = _validator.TestValidate(command);
            result.ShouldNotHaveValidationErrorFor(x => x.Status);
        }
    }

    [Fact]
    public void Validate_WithAllTypes_ShouldNotHaveError()
    {
        foreach (ProjectType type in Enum.GetValues(typeof(ProjectType)))
        {
            var command = CreateValidCommand(type: type);
            var result = _validator.TestValidate(command);
            result.ShouldNotHaveValidationErrorFor(x => x.Type);
        }
    }
}
