using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateEmployee;

namespace Pitbull.Tests.Unit.HR;

/// <summary>
/// Unit tests for CreateEmployeeValidator (HR module).
/// </summary>
public sealed class CreateEmployeeValidatorTests
{
    private readonly CreateEmployeeValidator _validator = new();

    private static CreateEmployeeCommand CreateValidCommand(
        string? employeeNumber = "EMP-2026-001",
        string? firstName = "John",
        string? lastName = "Doe",
        DateOnly? dateOfBirth = null,
        string? ssnEncrypted = "encrypted_ssn_data",
        string? ssnLast4 = "1234",
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
        string? country = "US",
        DateOnly? hireDate = null,
        WorkerType workerType = WorkerType.Field,
        FLSAStatus flsaStatus = FLSAStatus.NonExempt,
        EmploymentType employmentType = EmploymentType.FullTime,
        string? jobTitle = null,
        string? tradeCode = null,
        string? workersCompClassCode = null,
        Guid? departmentId = null,
        Guid? supervisorId = null,
        string? homeState = null,
        string? suiState = null,
        PayFrequency payFrequency = PayFrequency.Weekly,
        PayType defaultPayType = PayType.Hourly,
        decimal? defaultHourlyRate = null,
        PaymentMethod paymentMethod = PaymentMethod.DirectDeposit,
        bool isUnionMember = false,
        string? notes = null)
    {
        return new CreateEmployeeCommand(
            EmployeeNumber: employeeNumber!,
            FirstName: firstName!,
            LastName: lastName!,
            DateOfBirth: dateOfBirth ?? DateOnly.FromDateTime(DateTime.Today.AddYears(-30)),
            SSNEncrypted: ssnEncrypted!,
            SSNLast4: ssnLast4!,
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
            HireDate: hireDate,
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
            employeeNumber: "EMP-2026-001",
            firstName: "Michael",
            lastName: "Rodriguez",
            middleName: "James",
            preferredName: "Mike",
            suffix: "Jr.",
            dateOfBirth: DateOnly.FromDateTime(DateTime.Today.AddYears(-35)),
            ssnEncrypted: "encrypted_data",
            ssnLast4: "4532",
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
            hireDate: DateOnly.FromDateTime(DateTime.Today),
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
    // Employee Number Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithEmptyEmployeeNumber_ShouldHaveError()
    {
        var command = CreateValidCommand(employeeNumber: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EmployeeNumber)
            .WithErrorMessage("Employee number is required");
    }

    [Fact]
    public void Validate_WithEmployeeNumberTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(employeeNumber: new string('A', 51));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EmployeeNumber)
            .WithErrorMessage("Employee number cannot exceed 50 characters");
    }

    [Fact]
    public void Validate_WithInvalidEmployeeNumberCharacters_ShouldHaveError()
    {
        var command = CreateValidCommand(employeeNumber: "EMP#123@ABC");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EmployeeNumber)
            .WithErrorMessage("Employee number can only contain letters, numbers, and hyphens");
    }

    [Theory]
    [InlineData("EMP-001")]
    [InlineData("EMP2026001")]
    [InlineData("10045")]
    [InlineData("ABC-123-XYZ")]
    public void Validate_WithValidEmployeeNumberFormats_ShouldNotHaveError(string employeeNumber)
    {
        var command = CreateValidCommand(employeeNumber: employeeNumber);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.EmployeeNumber);
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

    [Fact]
    public void Validate_WithPreferredNameTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(preferredName: new string('A', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PreferredName)
            .WithErrorMessage("Preferred name cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithSuffixTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(suffix: new string('A', 21));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Suffix)
            .WithErrorMessage("Suffix cannot exceed 20 characters");
    }

    // ──────────────────────────────────────────────────────────────
    // Date of Birth Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithEmployeeTooYoung_ShouldHaveError()
    {
        var command = CreateValidCommand(dateOfBirth: DateOnly.FromDateTime(DateTime.Today.AddYears(-10)));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DateOfBirth)
            .WithErrorMessage("Employee must be at least 14 years old");
    }

    [Fact]
    public void Validate_WithEmployeeTooOld_ShouldHaveError()
    {
        var command = CreateValidCommand(dateOfBirth: DateOnly.FromDateTime(DateTime.Today.AddYears(-150)));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DateOfBirth)
            .WithErrorMessage("Invalid date of birth");
    }

    [Fact]
    public void Validate_WithValidDateOfBirth_ShouldNotHaveError()
    {
        var command = CreateValidCommand(dateOfBirth: DateOnly.FromDateTime(DateTime.Today.AddYears(-25)));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.DateOfBirth);
    }

    // ──────────────────────────────────────────────────────────────
    // SSN Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithEmptySSNEncrypted_ShouldHaveError()
    {
        var command = CreateValidCommand(ssnEncrypted: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SSNEncrypted)
            .WithErrorMessage("SSN is required");
    }

    [Fact]
    public void Validate_WithEmptySSNLast4_ShouldHaveError()
    {
        var command = CreateValidCommand(ssnLast4: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SSNLast4)
            .WithErrorMessage("SSN last 4 digits is required");
    }

    [Theory]
    [InlineData("123")]   // Too short
    [InlineData("12345")] // Too long
    [InlineData("abcd")]  // Letters
    [InlineData("12-4")]  // Non-digit
    public void Validate_WithInvalidSSNLast4Format_ShouldHaveError(string ssnLast4)
    {
        var command = CreateValidCommand(ssnLast4: ssnLast4);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.SSNLast4);
    }

    [Fact]
    public void Validate_WithValidSSNLast4_ShouldNotHaveError()
    {
        var command = CreateValidCommand(ssnLast4: "4532");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.SSNLast4);
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
    [InlineData("WAA")]        // Too long
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
    [InlineData("98101-123")] // Wrong format
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
        var command = CreateValidCommand(defaultHourlyRate: 45.50m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.DefaultHourlyRate);
    }

    // ──────────────────────────────────────────────────────────────
    // Hire Date Validation
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_WithHireDateTooFarInFuture_ShouldHaveError()
    {
        var command = CreateValidCommand(hireDate: DateOnly.FromDateTime(DateTime.Today.AddMonths(6)));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.HireDate)
            .WithErrorMessage("Hire date cannot be more than 3 months in the future");
    }

    [Fact]
    public void Validate_WithValidFutureHireDate_ShouldNotHaveError()
    {
        var command = CreateValidCommand(hireDate: DateOnly.FromDateTime(DateTime.Today.AddMonths(2)));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.HireDate);
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
        var command = CreateValidCommand(notes: "Experienced carpenter with OSHA 30 certification");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Notes);
    }
}
