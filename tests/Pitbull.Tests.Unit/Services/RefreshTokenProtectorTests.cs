using Microsoft.Extensions.Configuration;
using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class RefreshTokenProtectorTests
{
    [Fact]
    public void GeneratePlaintext_is_unique_and_long()
    {
        var a = RefreshTokenProtector.GeneratePlaintext();
        var b = RefreshTokenProtector.GeneratePlaintext();
        Assert.NotEqual(a, b);
        Assert.True(a.Length >= 64);
    }

    [Fact]
    public void Hash_is_deterministic_and_not_plaintext()
    {
        var plain = RefreshTokenProtector.GeneratePlaintext();
        var h1 = RefreshTokenProtector.Hash(plain);
        var h2 = RefreshTokenProtector.Hash(plain);
        Assert.Equal(h1, h2);
        Assert.NotEqual(plain, h1);
    }

    [Fact]
    public void Matches_accepts_correct_plaintext_only()
    {
        var plain = RefreshTokenProtector.GeneratePlaintext();
        var hash = RefreshTokenProtector.Hash(plain);

        Assert.True(RefreshTokenProtector.Matches(hash, plain));
        Assert.False(RefreshTokenProtector.Matches(hash, plain + "x"));
        Assert.False(RefreshTokenProtector.Matches(hash, null));
        Assert.False(RefreshTokenProtector.Matches(null, plain));
        Assert.False(RefreshTokenProtector.Matches("", plain));
    }

    [Fact]
    public void IsPlausiblePlaintext_rejects_empty_short_and_huge()
    {
        Assert.False(RefreshTokenProtector.IsPlausiblePlaintext(null));
        Assert.False(RefreshTokenProtector.IsPlausiblePlaintext(""));
        Assert.False(RefreshTokenProtector.IsPlausiblePlaintext("short"));
        Assert.False(RefreshTokenProtector.IsPlausiblePlaintext(new string('a', 201)));
        Assert.True(RefreshTokenProtector.IsPlausiblePlaintext(RefreshTokenProtector.GeneratePlaintext()));
    }

    [Fact]
    public void Matches_rejects_implausible_length_without_throwing()
    {
        var plain = RefreshTokenProtector.GeneratePlaintext();
        var hash = RefreshTokenProtector.Hash(plain);
        Assert.False(RefreshTokenProtector.Matches(hash, "x"));
        Assert.False(RefreshTokenProtector.Matches(hash, new string('a', 10_000)));
    }

    [Fact]
    public void GetRefreshExpirationDays_reads_config_and_caps()
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:RefreshExpirationDays"] = "14",
            })
            .Build();
        Assert.Equal(14, RefreshTokenProtector.GetRefreshExpirationDays(cfg));

        var capped = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:RefreshExpirationDays"] = "365",
            })
            .Build();
        Assert.Equal(90, RefreshTokenProtector.GetRefreshExpirationDays(capped));

        var missing = new ConfigurationBuilder().Build();
        Assert.Equal(RefreshTokenProtector.DefaultRefreshExpirationDays,
            RefreshTokenProtector.GetRefreshExpirationDays(missing));
    }

    [Fact]
    public void GetAccessExpirationMinutes_reads_config_and_caps()
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:ExpirationMinutes"] = "45",
            })
            .Build();
        Assert.Equal(45, RefreshTokenProtector.GetAccessExpirationMinutes(cfg));

        var capped = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:ExpirationMinutes"] = "99999",
            })
            .Build();
        Assert.Equal(24 * 60, RefreshTokenProtector.GetAccessExpirationMinutes(capped));
    }
}
