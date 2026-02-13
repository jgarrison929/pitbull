using Microsoft.Extensions.Configuration;
using Pitbull.Api.Configuration;
using Xunit;

namespace Pitbull.Tests.Unit.Configuration;

public class EnvironmentValidatorTests
{
    [Fact]
    public void ValidateRequiredConfiguration_WithMissingConnectionString_ShouldThrow()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "this-is-a-very-long-jwt-key-for-testing-purposes-at-least-32-chars",
                ["Jwt:Issuer"] = "test-issuer",
                ["Jwt:Audience"] = "test-audience",
                ["Cors:AllowedOrigins:0"] = "https://example.com"
            })
            .Build();

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(
            () => EnvironmentValidator.ValidateRequiredConfiguration(configuration));

        Assert.Contains("Missing required connection string: ConnectionStrings:PitbullDb", exception.Message);
    }

    [Fact]
    public void ValidateRequiredConfiguration_WithShortJwtKey_ShouldThrow()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:PitbullDb"] = "Host=localhost;Database=test;Username=test;Password=test",
                ["Jwt:Key"] = "short", // Too short!
                ["Jwt:Issuer"] = "test-issuer",
                ["Jwt:Audience"] = "test-audience",
                ["Cors:AllowedOrigins:0"] = "https://example.com"
            })
            .Build();

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(
            () => EnvironmentValidator.ValidateRequiredConfiguration(configuration));

        Assert.Contains("JWT key too short: Jwt:Key must be at least 32 characters", exception.Message);
    }

    [Fact]
    public void ValidateRequiredConfiguration_WithValidConfiguration_ShouldNotThrow()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:PitbullDb"] = "Host=localhost;Database=test;Username=test;Password=test",
                ["Jwt:Key"] = "this-is-a-very-long-jwt-key-for-testing-purposes-at-least-32-chars",
                ["Jwt:Issuer"] = "test-issuer",
                ["Jwt:Audience"] = "test-audience",
                ["Cors:AllowedOrigins:0"] = "https://example.com"
            })
            .Build();

        // Act & Assert
        var exception = Record.Exception(
            () => EnvironmentValidator.ValidateRequiredConfiguration(configuration));

        Assert.Null(exception);
    }

    [Fact]
    public void ValidateRequiredConfiguration_WithDemoEnabledButMissingDemoConfig_ShouldThrow()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:PitbullDb"] = "Host=localhost;Database=test;Username=test;Password=test",
                ["Jwt:Key"] = "this-is-a-very-long-jwt-key-for-testing-purposes-at-least-32-chars",
                ["Jwt:Issuer"] = "test-issuer",
                ["Jwt:Audience"] = "test-audience",
                ["Cors:AllowedOrigins:0"] = "https://example.com",
                ["Demo:Enabled"] = "true"
                // Missing demo config!
            })
            .Build();

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(
            () => EnvironmentValidator.ValidateRequiredConfiguration(configuration));

        Assert.Contains("Missing required demo configuration: Demo:TenantSlug", exception.Message);
    }

    [Fact]
    public void ValidateRequiredConfiguration_WithInvalidCorsOrigin_ShouldThrow()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:PitbullDb"] = "Host=localhost;Database=test;Username=test;Password=test",
                ["Jwt:Key"] = "this-is-a-very-long-jwt-key-for-testing-purposes-at-least-32-chars",
                ["Jwt:Issuer"] = "test-issuer",
                ["Jwt:Audience"] = "test-audience",
                ["Cors:AllowedOrigins:0"] = "not-a-valid-uri"
            })
            .Build();

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(
            () => EnvironmentValidator.ValidateRequiredConfiguration(configuration));

        Assert.Contains("Invalid CORS origin format: 'not-a-valid-uri' is not a valid absolute URI", exception.Message);
    }
}
