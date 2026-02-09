using FluentValidation.TestHelper;
using Pitbull.HR.Features.CreateEmergencyContact;

namespace Pitbull.Tests.Unit.HR;

public sealed class CreateEmergencyContactValidatorTests
{
    private readonly CreateEmergencyContactValidator _validator = new();

    private static CreateEmergencyContactCommand CreateValidCommand(
        Guid? employeeId = null,
        string name = "Jane Doe",
        string relationship = "Spouse",
        string primaryPhone = "555-123-4567",
        string? secondaryPhone = null,
        string? email = null,
        int? priority = null,
        string? notes = null)
    {
        return new CreateEmergencyContactCommand(
            EmployeeId: employeeId ?? Guid.NewGuid(),
            Name: name,
            Relationship: relationship,
            PrimaryPhone: primaryPhone,
            SecondaryPhone: secondaryPhone,
            Email: email,
            Priority: priority,
            Notes: notes
        );
    }

    [Fact]
    public void Validate_ValidCommand_Passes()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyEmployeeId_FailsWithMessage()
    {
        var command = CreateValidCommand(employeeId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EmployeeId)
            .WithErrorMessage("Employee ID is required");
    }

    [Fact]
    public void Validate_EmptyName_FailsWithMessage()
    {
        var command = CreateValidCommand(name: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Contact name is required");
    }

    [Fact]
    public void Validate_NameTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(name: new string('X', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Contact name cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_EmptyRelationship_FailsWithMessage()
    {
        var command = CreateValidCommand(relationship: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Relationship)
            .WithErrorMessage("Relationship is required");
    }

    [Fact]
    public void Validate_RelationshipTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(relationship: new string('X', 51));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Relationship)
            .WithErrorMessage("Relationship cannot exceed 50 characters");
    }

    [Fact]
    public void Validate_EmptyPrimaryPhone_FailsWithMessage()
    {
        var command = CreateValidCommand(primaryPhone: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PrimaryPhone)
            .WithErrorMessage("Primary phone is required");
    }

    [Fact]
    public void Validate_PrimaryPhoneTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(primaryPhone: new string('1', 21));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PrimaryPhone)
            .WithErrorMessage("Phone number cannot exceed 20 characters");
    }

    [Fact]
    public void Validate_InvalidPrimaryPhoneFormat_FailsWithMessage()
    {
        var command = CreateValidCommand(primaryPhone: "abc-def-ghij");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PrimaryPhone)
            .WithErrorMessage("Invalid phone number format");
    }

    [Theory]
    [InlineData("555-123-4567")]
    [InlineData("(555) 123-4567")]
    [InlineData("+1 555 123 4567")]
    [InlineData("5551234567")]
    public void Validate_ValidPhoneFormats_Passes(string phone)
    {
        var command = CreateValidCommand(primaryPhone: phone);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.PrimaryPhone);
    }

    [Fact]
    public void Validate_InvalidSecondaryPhone_FailsWithMessage()
    {
        var command = CreateValidCommand(secondaryPhone: "not-a-phone");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SecondaryPhone)
            .WithErrorMessage("Invalid phone number format");
    }

    [Fact]
    public void Validate_InvalidEmail_FailsWithMessage()
    {
        var command = CreateValidCommand(email: "not-an-email");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Invalid email format");
    }

    [Fact]
    public void Validate_ValidEmail_Passes()
    {
        var command = CreateValidCommand(email: "contact@example.com");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_PriorityTooLow_FailsWithMessage()
    {
        var command = CreateValidCommand(priority: 0);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Priority)
            .WithErrorMessage("Priority must be between 1 and 10");
    }

    [Fact]
    public void Validate_PriorityTooHigh_FailsWithMessage()
    {
        var command = CreateValidCommand(priority: 11);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Priority)
            .WithErrorMessage("Priority must be between 1 and 10");
    }

    [Fact]
    public void Validate_NotesTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(notes: new string('X', 501));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Notes)
            .WithErrorMessage("Notes cannot exceed 500 characters");
    }

    [Fact]
    public void Validate_FullValidCommand_Passes()
    {
        var command = CreateValidCommand(
            name: "Emergency Contact",
            relationship: "Parent",
            primaryPhone: "555-111-2222",
            secondaryPhone: "555-333-4444",
            email: "parent@example.com",
            priority: 1,
            notes: "Primary emergency contact"
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
