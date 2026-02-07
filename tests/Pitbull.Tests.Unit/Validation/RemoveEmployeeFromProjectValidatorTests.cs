using FluentValidation.TestHelper;
using Pitbull.TimeTracking.Features.RemoveEmployeeFromProject;

namespace Pitbull.Tests.Unit.Validation;

public sealed class RemoveEmployeeFromProjectValidatorTests
{
    private readonly RemoveEmployeeFromProjectValidator _validator = new();

    [Fact]
    public void Validate_WithValidAssignmentId_ShouldNotHaveErrors()
    {
        var command = new RemoveEmployeeFromProjectCommand(Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyAssignmentId_ShouldHaveError()
    {
        var command = new RemoveEmployeeFromProjectCommand(Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.AssignmentId)
            .WithErrorMessage("Assignment ID is required");
    }

    [Fact]
    public void Validate_WithEndDate_ShouldNotHaveErrors()
    {
        var command = new RemoveEmployeeFromProjectCommand(
            Guid.NewGuid(),
            EndDate: new DateOnly(2026, 6, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}

public sealed class RemoveEmployeeFromProjectByIdsValidatorTests
{
    private readonly RemoveEmployeeFromProjectByIdsValidator _validator = new();

    [Fact]
    public void Validate_WithValidIds_ShouldNotHaveErrors()
    {
        var command = new RemoveEmployeeFromProjectByIdsCommand(Guid.NewGuid(), Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyEmployeeId_ShouldHaveError()
    {
        var command = new RemoveEmployeeFromProjectByIdsCommand(Guid.Empty, Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EmployeeId)
            .WithErrorMessage("Employee ID is required");
    }

    [Fact]
    public void Validate_WithEmptyProjectId_ShouldHaveError()
    {
        var command = new RemoveEmployeeFromProjectByIdsCommand(Guid.NewGuid(), Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ProjectId)
            .WithErrorMessage("Project ID is required");
    }

    [Fact]
    public void Validate_WithBothIdsEmpty_ShouldHaveErrors()
    {
        var command = new RemoveEmployeeFromProjectByIdsCommand(Guid.Empty, Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EmployeeId);
        result.ShouldHaveValidationErrorFor(x => x.ProjectId);
    }

    [Fact]
    public void Validate_WithEndDate_ShouldNotHaveErrors()
    {
        var command = new RemoveEmployeeFromProjectByIdsCommand(
            Guid.NewGuid(),
            Guid.NewGuid(),
            EndDate: new DateOnly(2026, 6, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
