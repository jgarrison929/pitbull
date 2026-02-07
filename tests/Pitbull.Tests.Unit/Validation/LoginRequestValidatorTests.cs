using FluentValidation.TestHelper;
using Pitbull.Api.Controllers;
using Pitbull.Api.Validation;

namespace Pitbull.Tests.Unit.Validation;

public sealed class LoginRequestValidatorTests
{
    private readonly LoginRequestValidator _validator = new();

    private static LoginRequest CreateValidRequest(
        string? email = "user@example.com",
        string? password = "SecurePass123!")
    {
        return new LoginRequest(
            Email: email ?? "user@example.com",
            Password: password ?? "SecurePass123!"
        );
    }

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
        var request = CreateValidRequest(email: new string('a', 250) + "@example.com");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Email cannot exceed 256 characters");
    }

    [Fact]
    public void Validate_WithEmptyPassword_ShouldHaveError()
    {
        var request = CreateValidRequest(password: "");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password is required");
    }

    [Fact]
    public void Validate_WithPasswordTooLong_ShouldHaveError()
    {
        var request = CreateValidRequest(password: new string('a', 101));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_WithPasswordAtMaxLength_ShouldNotHaveError()
    {
        var request = CreateValidRequest(password: new string('a', 100));
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Password);
    }

    [Theory]
    [InlineData("user@domain.com")]
    [InlineData("test.user@subdomain.domain.org")]
    [InlineData("name+tag@example.co.uk")]
    public void Validate_WithVariousValidEmails_ShouldNotHaveError(string email)
    {
        var request = CreateValidRequest(email: email);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithWhitespaceEmail_ShouldHaveError()
    {
        var request = CreateValidRequest(email: "   ");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithWhitespacePassword_ShouldHaveError()
    {
        var request = CreateValidRequest(password: "   ");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }
}
