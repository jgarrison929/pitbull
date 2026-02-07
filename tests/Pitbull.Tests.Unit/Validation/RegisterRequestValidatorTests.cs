using FluentValidation.TestHelper;
using Pitbull.Api.Controllers;
using Pitbull.Api.Validation;

namespace Pitbull.Tests.Unit.Validation;

public sealed class RegisterRequestValidatorTests
{
    private readonly RegisterRequestValidator _validator = new();

    private static RegisterRequest CreateValidRequest(
        string? email = "user@example.com",
        string? password = "SecurePass1",
        string? firstName = "John",
        string? lastName = "Smith",
        string? companyName = "Acme Construction",
        Guid tenantId = default)
    {
        return new RegisterRequest(
            Email: email ?? "user@example.com",
            Password: password ?? "SecurePass1",
            FirstName: firstName ?? "John",
            LastName: lastName ?? "Smith",
            CompanyName: companyName,
            TenantId: tenantId
        );
    }

    // Email tests
    [Fact]
    public void Validate_WithValidRequest_ShouldNotHaveErrors()
    {
        var request = CreateValidRequest();
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyEmail_ShouldHaveError()
    {
        var request = CreateValidRequest(email: "");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Email is required");
    }

    [Fact]
    public void Validate_WithInvalidEmailFormat_ShouldHaveError()
    {
        var request = CreateValidRequest(email: "not-an-email");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Invalid email format");
    }

    [Fact]
    public void Validate_WithEmailTooLong_ShouldHaveError()
    {
        var request = CreateValidRequest(email: new string('a', 251) + "@x.com"); // 257 chars total
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    // Password tests
    [Fact]
    public void Validate_WithEmptyPassword_ShouldHaveError()
    {
        var request = CreateValidRequest(password: "");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password is required");
    }

    [Fact]
    public void Validate_WithPasswordTooShort_ShouldHaveError()
    {
        var request = CreateValidRequest(password: "Ab1");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must be at least 6 characters");
    }

    [Fact]
    public void Validate_WithPasswordTooLong_ShouldHaveError()
    {
        var request = CreateValidRequest(password: "Aa1" + new string('x', 98));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithPasswordNoUppercase_ShouldHaveError()
    {
        var request = CreateValidRequest(password: "lowercase1");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must contain at least one lowercase letter, one uppercase letter, and one number");
    }

    [Fact]
    public void Validate_WithPasswordNoLowercase_ShouldHaveError()
    {
        var request = CreateValidRequest(password: "UPPERCASE1");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Validate_WithPasswordNoNumber_ShouldHaveError()
    {
        var request = CreateValidRequest(password: "NoNumbers");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    // FirstName tests
    [Fact]
    public void Validate_WithEmptyFirstName_ShouldHaveError()
    {
        var request = CreateValidRequest(firstName: "");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name is required");
    }

    [Fact]
    public void Validate_WithFirstNameTooLong_ShouldHaveError()
    {
        var request = CreateValidRequest(firstName: new string('A', 101));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithFirstNameInvalidChars_ShouldHaveError()
    {
        var request = CreateValidRequest(firstName: "John123");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name can only contain letters, spaces, hyphens, and apostrophes");
    }

    [Theory]
    [InlineData("Mary-Jane")]
    [InlineData("O'Brien")]
    [InlineData("Jean Pierre")]
    public void Validate_WithValidFirstNameVariants_ShouldNotHaveError(string firstName)
    {
        var request = CreateValidRequest(firstName: firstName);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.FirstName);
    }

    // LastName tests
    [Fact]
    public void Validate_WithEmptyLastName_ShouldHaveError()
    {
        var request = CreateValidRequest(lastName: "");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name is required");
    }

    [Fact]
    public void Validate_WithLastNameTooLong_ShouldHaveError()
    {
        var request = CreateValidRequest(lastName: new string('A', 101));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithLastNameInvalidChars_ShouldHaveError()
    {
        var request = CreateValidRequest(lastName: "Smith@Inc");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.LastName);
    }

    // CompanyName tests
    [Fact]
    public void Validate_WithEmptyCompanyName_ShouldNotHaveError()
    {
        var request = CreateValidRequest(companyName: "");
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.CompanyName);
    }

    [Fact]
    public void Validate_WithNullCompanyName_ShouldNotHaveError()
    {
        var request = CreateValidRequest(companyName: null);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.CompanyName);
    }

    [Fact]
    public void Validate_WithCompanyNameTooLong_ShouldHaveError()
    {
        var request = CreateValidRequest(companyName: new string('A', 201));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.CompanyName)
            .WithErrorMessage("Company name cannot exceed 200 characters");
    }

    // TenantId tests
    [Fact]
    public void Validate_WithDefaultTenantId_ShouldNotHaveError()
    {
        var request = CreateValidRequest(tenantId: default);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.TenantId);
    }

    [Fact]
    public void Validate_WithValidTenantId_ShouldNotHaveError()
    {
        var request = CreateValidRequest(tenantId: Guid.NewGuid());
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.TenantId);
    }

    [Fact]
    public void Validate_WithEmptyGuidTenantId_ShouldNotHaveError()
    {
        // The validator only checks TenantId when it's NOT the default value
        // Guid.Empty IS the default, so it should pass (conditional validation)
        var request = CreateValidRequest(tenantId: Guid.Empty);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.TenantId);
    }
}
