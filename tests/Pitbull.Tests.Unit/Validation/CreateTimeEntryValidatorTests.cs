using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.TimeTracking.Features.CreateTimeEntry;

namespace Pitbull.Tests.Unit.Validation;

public sealed class CreateTimeEntryValidatorTests
{
    private readonly CreateTimeEntryValidator _validator = new();

    private static CreateTimeEntryCommand CreateValidCommand(
        DateOnly? date = null,
        Guid? employeeId = null,
        Guid? projectId = null,
        Guid? costCodeId = null,
        decimal regularHours = 8m,
        decimal overtimeHours = 0m,
        decimal doubletimeHours = 0m,
        string? description = null)
    {
        return new CreateTimeEntryCommand(
            Date: date ?? DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employeeId ?? Guid.NewGuid(),
            ProjectId: projectId ?? Guid.NewGuid(),
            CostCodeId: costCodeId ?? Guid.NewGuid(),
            RegularHours: regularHours,
            OvertimeHours: overtimeHours,
            DoubletimeHours: doubletimeHours,
            Description: description
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
            .WithErrorMessage("Employee is required");
    }

    [Fact]
    public void Validate_WithEmptyProjectId_ShouldHaveError()
    {
        var command = CreateValidCommand(projectId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ProjectId)
            .WithErrorMessage("Project is required");
    }

    [Fact]
    public void Validate_WithEmptyCostCodeId_ShouldHaveError()
    {
        var command = CreateValidCommand(costCodeId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.CostCodeId)
            .WithErrorMessage("Cost code is required");
    }

    [Fact]
    public void Validate_WithNegativeRegularHours_ShouldHaveError()
    {
        var command = CreateValidCommand(regularHours: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RegularHours)
            .WithErrorMessage("Regular hours cannot be negative");
    }

    [Fact]
    public void Validate_WithNegativeOvertimeHours_ShouldHaveError()
    {
        var command = CreateValidCommand(overtimeHours: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.OvertimeHours)
            .WithErrorMessage("Overtime hours cannot be negative");
    }

    [Fact]
    public void Validate_WithNegativeDoubletimeHours_ShouldHaveError()
    {
        var command = CreateValidCommand(doubletimeHours: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DoubletimeHours)
            .WithErrorMessage("Doubletime hours cannot be negative");
    }

    [Fact]
    public void Validate_WithRegularHoursExceeding24_ShouldHaveError()
    {
        var command = CreateValidCommand(regularHours: 25m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.RegularHours)
            .WithErrorMessage("Regular hours cannot exceed 24");
    }

    [Fact]
    public void Validate_WithTotalHoursExceeding24_ShouldHaveError()
    {
        var command = CreateValidCommand(regularHours: 8m, overtimeHours: 10m, doubletimeHours: 8m);
        var result = _validator.TestValidate(command);
        result.Errors.Should().Contain(e => e.ErrorMessage == "Total hours cannot exceed 24 per day");
    }

    [Fact]
    public void Validate_WithZeroTotalHours_ShouldHaveError()
    {
        var command = CreateValidCommand(regularHours: 0m, overtimeHours: 0m, doubletimeHours: 0m);
        var result = _validator.TestValidate(command);
        result.Errors.Should().Contain(e => e.ErrorMessage == "At least one hour type must have a positive value");
    }

    [Fact]
    public void Validate_WithOnlyOvertimeHours_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand(regularHours: 0m, overtimeHours: 4m, doubletimeHours: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithOnlyDoubletimeHours_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand(regularHours: 0m, overtimeHours: 0m, doubletimeHours: 4m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithDescriptionTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(description: new string('A', 501));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description cannot exceed 500 characters");
    }

    [Fact]
    public void Validate_WithValidDescription_ShouldNotHaveError()
    {
        var command = CreateValidCommand(description: "Installed HVAC ductwork on 3rd floor");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void Validate_WithFutureDateMoreThan1Day_ShouldHaveError()
    {
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3));
        var command = CreateValidCommand(date: futureDate);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Date)
            .WithErrorMessage("Date cannot be more than 1 day in the future");
    }

    [Fact]
    public void Validate_WithTomorrowDate_ShouldNotHaveError()
    {
        var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
        var command = CreateValidCommand(date: tomorrow);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Date);
    }

    [Fact]
    public void Validate_WithPastDate_ShouldNotHaveError()
    {
        var pastDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
        var command = CreateValidCommand(date: pastDate);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Date);
    }

    [Fact]
    public void Validate_WithExactly24TotalHours_ShouldNotHaveError()
    {
        var command = CreateValidCommand(regularHours: 8m, overtimeHours: 8m, doubletimeHours: 8m);
        var result = _validator.TestValidate(command);
        result.Errors.Should().NotContain(e => e.ErrorMessage == "Total hours cannot exceed 24 per day");
    }
}
