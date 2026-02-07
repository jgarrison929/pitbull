using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.UpdateEmployee;

namespace Pitbull.Tests.Unit.Validation;

public sealed class UpdateEmployeeValidatorTests
{
    private readonly UpdateEmployeeValidator _validator = new();

    private static UpdateEmployeeCommand CreateValidCommand(
        Guid? employeeId = null,
        string? firstName = "John",
        string? lastName = "Doe",
        string? email = null,
        string? phone = null,
        string? title = null,
        EmployeeClassification classification = EmployeeClassification.Hourly,
        decimal baseHourlyRate = 35m,
        DateOnly? hireDate = null,
        DateOnly? terminationDate = null,
        Guid? supervisorId = null,
        bool isActive = true,
        string? notes = null)
    {
        return new UpdateEmployeeCommand(
            EmployeeId: employeeId ?? Guid.NewGuid(),
            FirstName: firstName!,
            LastName: lastName!,
            Email: email,
            Phone: phone,
            Title: title,
            Classification: classification,
            BaseHourlyRate: baseHourlyRate,
            HireDate: hireDate,
            TerminationDate: terminationDate,
            SupervisorId: supervisorId,
            IsActive: isActive,
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
    public void Validate_WithEmptyFirstName_ShouldHaveError()
    {
        var command = CreateValidCommand(firstName: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name is required");
    }

    [Fact]
    public void Validate_WithFirstNameTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(firstName: new string('A', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithEmptyLastName_ShouldHaveError()
    {
        var command = CreateValidCommand(lastName: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name is required");
    }

    [Fact]
    public void Validate_WithLastNameTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(lastName: new string('A', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithInvalidEmail_ShouldHaveError()
    {
        var command = CreateValidCommand(email: "not-an-email");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Invalid email format");
    }

    [Fact]
    public void Validate_WithValidEmail_ShouldNotHaveError()
    {
        var command = CreateValidCommand(email: "john.doe@company.com");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithEmailTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(email: new string('a', 250) + "@test.com");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Email cannot exceed 256 characters");
    }

    [Fact]
    public void Validate_WithPhoneTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(phone: new string('1', 21));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Phone)
            .WithErrorMessage("Phone number cannot exceed 20 characters");
    }

    [Fact]
    public void Validate_WithTitleTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(title: new string('A', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Title)
            .WithErrorMessage("Title cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithNegativeBaseHourlyRate_ShouldHaveError()
    {
        var command = CreateValidCommand(baseHourlyRate: -10m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.BaseHourlyRate)
            .WithErrorMessage("Base hourly rate cannot be negative");
    }

    [Fact]
    public void Validate_WithBaseHourlyRateTooHigh_ShouldHaveError()
    {
        var command = CreateValidCommand(baseHourlyRate: 1001m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.BaseHourlyRate)
            .WithErrorMessage("Base hourly rate cannot exceed 1000");
    }

    [Fact]
    public void Validate_WithNotesTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(notes: new string('A', 2001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Notes)
            .WithErrorMessage("Notes cannot exceed 2000 characters");
    }

    [Fact]
    public void Validate_WithTerminationBeforeHire_ShouldHaveError()
    {
        var command = CreateValidCommand(
            hireDate: new DateOnly(2025, 6, 1),
            terminationDate: new DateOnly(2025, 1, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.TerminationDate)
            .WithErrorMessage("Termination date must be after hire date");
    }

    [Fact]
    public void Validate_WithTerminationAfterHire_ShouldNotHaveError()
    {
        var command = CreateValidCommand(
            hireDate: new DateOnly(2025, 1, 1),
            terminationDate: new DateOnly(2025, 6, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.TerminationDate);
    }

    [Fact]
    public void Validate_WithTerminationDateButNoHireDate_ShouldNotHaveError()
    {
        var command = CreateValidCommand(
            hireDate: null,
            terminationDate: new DateOnly(2025, 6, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.TerminationDate);
    }

    [Fact]
    public void Validate_WithInactiveStatus_ShouldNotHaveError()
    {
        var command = CreateValidCommand(isActive: false);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithSupervisorId_ShouldNotHaveError()
    {
        var command = CreateValidCommand(supervisorId: Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.SupervisorId);
    }

    [Fact]
    public void Validate_WithSalariedClassification_ShouldNotHaveError()
    {
        var command = CreateValidCommand(classification: EmployeeClassification.Salaried);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Classification);
    }
}
