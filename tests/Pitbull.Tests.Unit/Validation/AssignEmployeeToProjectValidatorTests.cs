using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.AssignEmployeeToProject;

namespace Pitbull.Tests.Unit.Validation;

public sealed class AssignEmployeeToProjectValidatorTests
{
    private readonly AssignEmployeeToProjectValidator _validator = new();

    private static AssignEmployeeToProjectCommand CreateValidCommand(
        Guid? employeeId = null,
        Guid? projectId = null,
        AssignmentRole role = AssignmentRole.Worker,
        DateOnly? startDate = null,
        DateOnly? endDate = null,
        string? notes = null)
    {
        return new AssignEmployeeToProjectCommand(
            EmployeeId: employeeId ?? Guid.NewGuid(),
            ProjectId: projectId ?? Guid.NewGuid(),
            Role: role,
            StartDate: startDate,
            EndDate: endDate,
            Notes: notes
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
    public void Validate_WithEmptyEmployeeId_ShouldHaveError()
    {
        var command = CreateValidCommand(employeeId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EmployeeId)
            .WithErrorMessage("Employee ID is required");
    }

    [Fact]
    public void Validate_WithEmptyProjectId_ShouldHaveError()
    {
        var command = CreateValidCommand(projectId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ProjectId)
            .WithErrorMessage("Project ID is required");
    }

    [Fact]
    public void Validate_WithWorkerRole_ShouldNotHaveError()
    {
        var command = CreateValidCommand(role: AssignmentRole.Worker);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Role);
    }

    [Fact]
    public void Validate_WithSupervisorRole_ShouldNotHaveError()
    {
        var command = CreateValidCommand(role: AssignmentRole.Supervisor);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Role);
    }

    [Fact]
    public void Validate_WithManagerRole_ShouldNotHaveError()
    {
        var command = CreateValidCommand(role: AssignmentRole.Manager);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Role);
    }

    [Fact]
    public void Validate_WithNotesTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(notes: new string('A', 501));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Notes)
            .WithErrorMessage("Notes cannot exceed 500 characters");
    }

    [Fact]
    public void Validate_WithValidNotes_ShouldNotHaveError()
    {
        var command = CreateValidCommand(notes: "Lead carpenter for framing crew");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Notes);
    }

    [Fact]
    public void Validate_WithEndDateBeforeStartDate_ShouldHaveError()
    {
        var command = CreateValidCommand(
            startDate: new DateOnly(2026, 6, 1),
            endDate: new DateOnly(2026, 1, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EndDate)
            .WithErrorMessage("End date must be after start date");
    }

    [Fact]
    public void Validate_WithEndDateAfterStartDate_ShouldNotHaveError()
    {
        var command = CreateValidCommand(
            startDate: new DateOnly(2026, 1, 1),
            endDate: new DateOnly(2026, 6, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void Validate_WithOnlyStartDate_ShouldNotHaveError()
    {
        var command = CreateValidCommand(
            startDate: new DateOnly(2026, 1, 1),
            endDate: null
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void Validate_WithOnlyEndDate_ShouldNotHaveError()
    {
        var command = CreateValidCommand(
            startDate: null,
            endDate: new DateOnly(2026, 6, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void Validate_WithNoDates_ShouldNotHaveError()
    {
        var command = CreateValidCommand(startDate: null, endDate: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
