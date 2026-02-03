using FluentValidation.TestHelper;
using Pitbull.Api.Controllers;
using Pitbull.Api.Validation;
using Xunit;

namespace Pitbull.Tests.Unit.Validation;

public class RegisterRequestValidatorTests
{
    private readonly RegisterRequestValidator _validator = new();

    [Theory]
    [InlineData("<script>alert('XSS')</script>", "First name can only contain letters, spaces, hyphens, and apostrophes")]
    [InlineData("John<script>", "First name can only contain letters, spaces, hyphens, and apostrophes")]
    [InlineData("<img src=x onerror=alert(1)>", "First name can only contain letters, spaces, hyphens, and apostrophes")]
    [InlineData("javascript:alert(1)", "First name can only contain letters, spaces, hyphens, and apostrophes")]
    [InlineData("&lt;script&gt;", "First name can only contain letters, spaces, hyphens, and apostrophes")]
    public void FirstName_WithXssAttempts_ShouldFail(string maliciousInput, string expectedError)
    {
        // Arrange
        var request = new RegisterRequest(
            Email: "test@example.com",
            Password: "ValidPass123",
            FirstName: maliciousInput,
            LastName: "Doe"
        );

        // Act & Assert
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
              .WithErrorMessage(expectedError);
    }

    [Theory]
    [InlineData("<script>alert('XSS')</script>", "Last name can only contain letters, spaces, hyphens, and apostrophes")]
    [InlineData("Smith<img src=x>", "Last name can only contain letters, spaces, hyphens, and apostrophes")]
    [InlineData("onload=alert(1)", "Last name can only contain letters, spaces, hyphens, and apostrophes")]
    public void LastName_WithXssAttempts_ShouldFail(string maliciousInput, string expectedError)
    {
        // Arrange
        var request = new RegisterRequest(
            Email: "test@example.com",
            Password: "ValidPass123",
            FirstName: "John",
            LastName: maliciousInput
        );

        // Act & Assert
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.LastName)
              .WithErrorMessage(expectedError);
    }

    [Theory]
    [InlineData("John")]
    [InlineData("Mary-Jane")]
    [InlineData("O'Connor")]
    [InlineData("Van Der Berg")]
    [InlineData("José María")]
    public void FirstName_WithValidInputs_ShouldPass(string validInput)
    {
        // Arrange
        var request = new RegisterRequest(
            Email: "test@example.com",
            Password: "ValidPass123",
            FirstName: validInput,
            LastName: "Doe"
        );

        // Act & Assert
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.FirstName);
    }

    [Theory]
    [InlineData("Smith")]
    [InlineData("O'Malley")]
    [InlineData("Van-Der-Berg")]
    [InlineData("De La Cruz")]
    public void LastName_WithValidInputs_ShouldPass(string validInput)
    {
        // Arrange
        var request = new RegisterRequest(
            Email: "test@example.com",
            Password: "ValidPass123",
            FirstName: "John",
            LastName: validInput
        );

        // Act & Assert
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.LastName);
    }

    [Fact]
    public void ValidRequest_ShouldPassValidation()
    {
        // Arrange
        var request = new RegisterRequest(
            Email: "john.doe@example.com",
            Password: "ValidPass123",
            FirstName: "John",
            LastName: "Doe",
            CompanyName: "Acme Construction"
        );

        // Act & Assert
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }
}