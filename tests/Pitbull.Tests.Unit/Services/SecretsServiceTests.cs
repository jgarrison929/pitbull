using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class SecretsServiceTests
{
    private static ISecretsService CreateService(Dictionary<string, string?>? configValues = null)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(configValues ?? new Dictionary<string, string?>())
            .Build();
        return new SecretsService(config);
    }

    #region GetSecret

    [Fact]
    public void GetSecret_WithConfiguredValue_ReturnsValue()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "my-super-secret-jwt-key-that-is-long-enough"
        });

        var result = service.GetSecret("Jwt:Key");

        result.Should().Be("my-super-secret-jwt-key-that-is-long-enough");
    }

    [Fact]
    public void GetSecret_WithMissingValue_ReturnsNull()
    {
        var service = CreateService();

        var result = service.GetSecret("Jwt:Key");

        result.Should().BeNull();
    }

    [Fact]
    public void GetSecret_WithEmptyValue_ReturnsNull()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = ""
        });

        var result = service.GetSecret("Jwt:Key");

        result.Should().BeNull();
    }

    #endregion

    #region IsConfigured

    [Fact]
    public void IsConfigured_WithValue_ReturnsTrue()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "configured-value"
        });

        service.IsConfigured("Jwt:Key").Should().BeTrue();
    }

    [Fact]
    public void IsConfigured_WithoutValue_ReturnsFalse()
    {
        var service = CreateService();

        service.IsConfigured("Jwt:Key").Should().BeFalse();
    }

    #endregion

    #region GetMaskedValue

    [Fact]
    public void GetMaskedValue_WithApiKey_ShowsPrefixAndSuffix()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Anthropic:ApiKey"] = "sk-ant-api123456789abcdef"
        });

        var masked = service.GetMaskedValue("Anthropic:ApiKey");

        masked.Should().NotBeNull();
        masked.Should().StartWith("sk-a");
        masked.Should().EndWith("cdef");
        masked.Should().Contain("...");
        masked.Should().NotBe("sk-ant-api123456789abcdef");
    }

    [Fact]
    public void GetMaskedValue_WithConnectionString_ShowsHostOnly()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["ConnectionStrings:PitbullDb"] = "Host=db.example.com;Database=pitbull;Username=admin;Password=secret"
        });

        var masked = service.GetMaskedValue("ConnectionStrings:PitbullDb");

        masked.Should().NotBeNull();
        masked.Should().Contain("db.example.com");
        masked.Should().NotContain("secret");
        masked.Should().NotContain("admin");
    }

    [Fact]
    public void GetMaskedValue_WithShortValue_FullyMasks()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "short"
        });

        var masked = service.GetMaskedValue("Jwt:Key");

        masked.Should().Be("***");
    }

    [Fact]
    public void GetMaskedValue_WithMissingValue_ReturnsNull()
    {
        var service = CreateService();

        service.GetMaskedValue("Jwt:Key").Should().BeNull();
    }

    #endregion

    #region GetAllSecretStatuses

    [Fact]
    public void GetAllSecretStatuses_ReturnsAllKnownSecrets()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "my-long-jwt-signing-key-at-least-32-chars",
            ["ConnectionStrings:PitbullDb"] = "Host=localhost;Database=pitbull"
        });

        var statuses = service.GetAllSecretStatuses();

        statuses.Should().NotBeEmpty();
        statuses.Count.Should().BeGreaterThanOrEqualTo(5);

        // JWT should be configured (set in config above)
        var jwt = statuses.First(s => s.Key == "Jwt:Key");
        jwt.IsConfigured.Should().BeTrue();
        jwt.MaskedValue.Should().NotBeNull();

        // DB should be configured (set in config above)
        var dbStatus = statuses.First(s => s.Key == "ConnectionStrings:PitbullDb");
        dbStatus.IsConfigured.Should().BeTrue();

        // All statuses should have valid categories
        statuses.Should().OnlyContain(s => !string.IsNullOrEmpty(s.Category));
        statuses.Should().OnlyContain(s => !string.IsNullOrEmpty(s.DisplayName));
    }

    [Fact]
    public void GetAllSecretStatuses_GroupsCorrectly()
    {
        var service = CreateService();

        var statuses = service.GetAllSecretStatuses();

        statuses.Select(s => s.Category).Distinct()
            .Should().Contain("Authentication")
            .And.Contain("AI")
            .And.Contain("Database");
    }

    #endregion
}
