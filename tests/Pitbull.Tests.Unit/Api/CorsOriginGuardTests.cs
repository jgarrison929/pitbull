using Pitbull.Api.Configuration;

namespace Pitbull.Tests.Unit.Api;

public class CorsOriginGuardTests
{
    [Fact]
    public void Normalize_Trims_Dedupes_And_StripsTrailingSlash()
    {
        var result = CorsOriginGuard.Normalize(
        [
            " https://app.example.com/ ",
            "https://app.example.com",
            "",
            "  ",
            "https://Admin.Example.com",
        ]);

        Assert.Equal(new[] { "https://app.example.com", "https://Admin.Example.com" }, result);
    }

    [Fact]
    public void ValidateForEnvironment_Throws_WhenProductionHasNoOrigins()
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            CorsOriginGuard.ValidateForEnvironment(Array.Empty<string>(), isDevelopment: false));
        Assert.Contains("AllowedOrigins", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void ValidateForEnvironment_AllowsEmptyInDevelopment()
    {
        CorsOriginGuard.ValidateForEnvironment(Array.Empty<string>(), isDevelopment: true);
    }

    [Theory]
    [InlineData("*")]
    [InlineData("https://*.example.com")]
    public void ValidateForEnvironment_RejectsWildcards(string origin)
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            CorsOriginGuard.ValidateForEnvironment(new[] { origin }, isDevelopment: false));
        Assert.Contains("wildcard", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ValidateForEnvironment_AllowsExplicitOrigins()
    {
        CorsOriginGuard.ValidateForEnvironment(
            new[] { "https://app.example.com" },
            isDevelopment: false);
    }
}
