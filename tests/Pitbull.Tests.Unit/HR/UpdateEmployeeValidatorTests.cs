using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.UpdateEmployee;

namespace Pitbull.Tests.Unit.HR;

/// <summary>
/// Unit tests for UpdateEmployeeValidator (HR module).
/// </summary>
public sealed class UpdateEmployeeValidatorTests
{
    private readonly UpdateEmployeeValidator _validator = new();

    private static UpdateEmployeeCommand CreateValidCommand(
        Guid? id = null,
        string? firstName = "John",
        string? lastName = "Doe",
        string? middleName = null,
        string? preferredName = null,
        string? suffix = null,
        string? email = null,
        string? personalEmail = null,
        string? phone = null,
        string? secondaryPhone = null,
        string? addressLine1 = null,
        string? addressLine2 = null,
        string? city = null,
        string? state = null,
        string? zipCode = null,
        string? country = null,
        WorkerType? workerType = null,
        FLSAStatus? flsaStatus = null,
        EmploymentType? employmentType = null,
        string? jobTitle = null,
        string? tradeCode = null,
        string? workersCompClassCode = null,
        Guid? departmentId = null,
        Guid? supervisorId = null,
        string? homeState = null,
        string? suiState = null,
        PayFrequency? payFrequency = null,
        PayType? defaultPayType = null,
        decimal? defaultHourlyRate = null,
        PaymentMethod? paymentMethod = null,
        bool? isUnionMember = null,
        string? notes = null)
    {
        return new UpdateEmployeeCommand(
            Id: id ?? Guid.NewGuid(),
            FirstName: firstName!,
            LastName: lastName!,
            MiddleName: middleName,
            PreferredName: preferredName,
            Suffix: suffix,
            Email: email,
            PersonalEmail: personalEmail,
            Phone: phone,
            SecondaryPhone: secondaryPhone,
            AddressLine1: addressLine1,
            AddressLine2: addressLine2,
            City: city,
            State: state,
            ZipCode: zipCode,
            Country: country,
            WorkerType: workerType,
            FLSAStatus: flsaStatus,
            EmploymentType: employmentType,
            JobTitle: jobTitle,
            TradeCode: tradeCode,
            WorkersCompClassCode: workersCompClassCode,
            DepartmentId: departmentId,
            SupervisorId: supervisorId,
            HomeState: homeState,
            SUIState: suiState,
            PayFrequency: payFrequency,
            DefaultPayType: defaultPayType,
            DefaultHourlyRate: defaultHourlyRate,
            PaymentMethod: paymentMethod,
            IsUnionMember: isUnionMember,
            Notes: notes
        );
    }

    // ──────────────────────────────────────────────────────────────
    // Valid Command
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithFullyPopulatedCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand(
            id: Guid.NewGuid(),
            firstName: "Michael",
            lastName: "Rodriguez",
            middleName: "James",
            preferredName: "Mike",
            suffix: "Jr.",
            email: "mike.rodriguez@company.com",
            personalEmail: "mike@gmail.com",
            phone: "+1-206-555-0142",
            secondaryPhone: "+1-206-555-0143",
            addressLine1: "1234 Oak Street",
            addressLine2: "Apt 5B",
            city: "Seattle",
            state: "WA",
            zipCode: "98101",
            country: "US",
            workerType: WorkerType.Field,
            flsaStatus: FLSAStatus.NonExempt,
            employmentType: EmploymentType.FullTime,
            jobTitle: "Journeyman Carpenter",
            tradeCode: "CARP",
            workersCompClassCode: "5403",
            homeState: "WA",
            suiState: "WA",
            payFrequency: PayFrequency.Weekly,
            defaultPayType: PayType.Hourly,
            defaultHourlyRate: 45.50m,
            paymentMethod: PaymentMethod.DirectDeposit,
            isUnionMember: true,
            notes: "Excellent carpenter, OSHA 30 certified"
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    // ──────────────────────────────────────────────────────────────
    // ID Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = CreateValidCommand(id: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Employee ID is required");
    }

    // ──────────────────────────────────────────────────────────────
    // Name Validation
    // ──────────────────────────────────────────────────────────────

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
    public void Validate_WithMiddleNameTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(middleName: new string('A', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.MiddleName)
            .WithErrorMessage("Middle name cannot exceed 100 characters");
    }

    // ──────────────────────────────────────────────────────────────
    // Email Validation
    // ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("@nodomain.com")]
    public void Validate_WithInvalidEmail_ShouldHaveError(string email)
    {
        var command = CreateValidCommand(email: email);
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

    // ──────────────────────────────────────────────────────────────
    // Phone Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithPhoneTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(phone: new string('1', 21));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Phone)
            .WithErrorMessage("Phone number cannot exceed 20 characters");
    }

    [Theory]
    [InlineData("555-123-4567")]
    [InlineData("+1-206-555-0142")]
    [InlineData("(206) 555-0142")]
    public void Validate_WithValidPhoneFormats_ShouldNotHaveError(string phone)
    {
        var command = CreateValidCommand(phone: phone);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Phone);
    }

    // ──────────────────────────────────────────────────────────────
    // Address Validation
    // ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("WA")]
    [InlineData("CA")]
    [InlineData("TX")]
    public void Validate_WithValidState_ShouldNotHaveError(string state)
    {
        var command = CreateValidCommand(state: state);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.State);
    }

    [Theory]
    [InlineData("Washington")] // Full name instead of code
    [InlineData("wa")]         // Lowercase
    [InlineData("W")]          // Too short
    public void Validate_WithInvalidState_ShouldHaveError(string state)
    {
        var command = CreateValidCommand(state: state);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.State);
    }

    [Theory]
    [InlineData("98101")]
    [InlineData("98101-1234")]
    public void Validate_WithValidZipCode_ShouldNotHaveError(string zipCode)
    {
        var command = CreateValidCommand(zipCode: zipCode);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ZipCode);
    }

    [Theory]
    [InlineData("9810")]      // Too short
    [InlineData("981011234")] // Missing dash
    [InlineData("ABCDE")]     // Letters
    public void Validate_WithInvalidZipCode_ShouldHaveError(string zipCode)
    {
        var command = CreateValidCommand(zipCode: zipCode);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ZipCode);
    }

    // ──────────────────────────────────────────────────────────────
    // Pay Rate Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithNegativeHourlyRate_ShouldHaveError()
    {
        var command = CreateValidCommand(defaultHourlyRate: -10m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DefaultHourlyRate)
            .WithErrorMessage("Default hourly rate must be greater than zero");
    }

    [Fact]
    public void Validate_WithHourlyRateTooHigh_ShouldHaveError()
    {
        var command = CreateValidCommand(defaultHourlyRate: 1001m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DefaultHourlyRate)
            .WithErrorMessage("Default hourly rate seems unreasonably high");
    }

    [Fact]
    public void Validate_WithValidHourlyRate_ShouldNotHaveError()
    {
        var command = CreateValidCommand(defaultHourlyRate: 52.50m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.DefaultHourlyRate);
    }

    // ──────────────────────────────────────────────────────────────
    // Classification Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithJobTitleTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(jobTitle: new string('A', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.JobTitle)
            .WithErrorMessage("Job title cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_WithTradeCodeTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(tradeCode: new string('A', 51));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.TradeCode)
            .WithErrorMessage("Trade code cannot exceed 50 characters");
    }

    [Fact]
    public void Validate_WithWorkersCompClassCodeTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(workersCompClassCode: new string('A', 11));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.WorkersCompClassCode)
            .WithErrorMessage("Workers comp class code cannot exceed 10 characters");
    }

    // ──────────────────────────────────────────────────────────────
    // Notes Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithNotesTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(notes: new string('A', 4001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Notes)
            .WithErrorMessage("Notes cannot exceed 4000 characters");
    }

    [Fact]
    public void Validate_WithValidNotes_ShouldNotHaveError()
    {
        var command = CreateValidCommand(notes: "Updated contact information after address change.");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Notes);
    }

    // ──────────────────────────────────────────────────────────────
    // Enum Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithValidWorkerType_ShouldNotHaveError()
    {
        var command = CreateValidCommand(workerType: WorkerType.Hybrid);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.WorkerType);
    }

    [Fact]
    public void Validate_WithValidPayFrequency_ShouldNotHaveError()
    {
        var command = CreateValidCommand(payFrequency: PayFrequency.BiWeekly);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.PayFrequency);
    }

    [Fact]
    public void Validate_WithValidPaymentMethod_ShouldNotHaveError()
    {
        var command = CreateValidCommand(paymentMethod: PaymentMethod.Check);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.PaymentMethod);
    }
}
