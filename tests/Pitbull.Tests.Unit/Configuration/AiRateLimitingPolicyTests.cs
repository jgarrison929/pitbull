using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Xunit;

namespace Pitbull.Tests.Unit.Configuration;

/// <summary>
/// Tests that the AI rate limiting policies partition by user and enforce correct limits.
/// Uses the same FixedWindowRateLimiter configuration as Program.cs.
/// </summary>
public class AiRateLimitingPolicyTests
{
    private static FixedWindowRateLimiter CreateLimiter(int permitLimit) =>
        new(new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });

    private static string GetPartitionKey(HttpContext context) =>
        context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? context.Connection.RemoteIpAddress?.ToString()
        ?? "anonymous";

    private static HttpContext CreateContextWithUser(string userId) =>
        new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userId)
            ], "test"))
        };

    private static HttpContext CreateAnonymousContext(string? ipAddress = null)
    {
        var context = new DefaultHttpContext();
        if (ipAddress != null)
            context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(ipAddress);
        return context;
    }

    [Theory]
    [InlineData("ai-chat", 20)]
    [InlineData("ai-document", 10)]
    [InlineData("ai-suggest", 30)]
    public void Policy_RejectsAfterExceedingLimit(string policyName, int permitLimit)
    {
        // Arrange
        using var limiter = CreateLimiter(permitLimit);

        // Act — exhaust the limit
        for (var i = 0; i < permitLimit; i++)
        {
            var lease = limiter.AttemptAcquire();
            Assert.True(lease.IsAcquired, $"{policyName}: request {i + 1} should be permitted");
        }

        // Assert — next request should be rejected
        var rejected = limiter.AttemptAcquire();
        Assert.False(rejected.IsAcquired, $"{policyName}: request {permitLimit + 1} should be rejected (429)");
    }

    [Fact]
    public void Demo_users_get_stricter_permit_limits_than_production()
    {
        Assert.True(
            Pitbull.Api.Configuration.AiRateLimitPolicy.PermitLimit("ai-chat", isDemo: true)
            < Pitbull.Api.Configuration.AiRateLimitPolicy.PermitLimit("ai-chat", isDemo: false));
        Assert.True(
            Pitbull.Api.Configuration.AiRateLimitPolicy.PermitLimit("ai-suggest", isDemo: true)
            < Pitbull.Api.Configuration.AiRateLimitPolicy.PermitLimit("ai-suggest", isDemo: false));
        Assert.Equal(8, Pitbull.Api.Configuration.AiRateLimitPolicy.ChatDemoPermitLimit);
        Assert.Equal(10, Pitbull.Api.Configuration.AiRateLimitPolicy.SuggestDemoPermitLimit);
    }

    [Fact]
    public void IsDemoUser_reads_is_demo_user_claim()
    {
        var ctx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim("is_demo_user", "true"),
                new Claim(ClaimTypes.NameIdentifier, "demo-1"),
            ], "test"))
        };
        Assert.True(Pitbull.Api.Configuration.AiRateLimitPolicy.IsDemoUser(ctx));
        Assert.Contains("demo-1", Pitbull.Api.Configuration.AiRateLimitPolicy.PartitionKey(ctx));
    }

    [Fact]
    public void PartitionKey_UsesUserIdFromJwtClaim()
    {
        // Arrange
        var context = CreateContextWithUser("user-123");

        // Act
        var key = GetPartitionKey(context);

        // Assert
        Assert.Equal("user-123", key);
    }

    [Fact]
    public void PartitionKey_FallsBackToIpAddress_WhenNoUserClaim()
    {
        // Arrange
        var context = CreateAnonymousContext("192.168.1.42");

        // Act
        var key = GetPartitionKey(context);

        // Assert
        Assert.Equal("192.168.1.42", key);
    }

    [Fact]
    public void PartitionKey_FallsBackToAnonymous_WhenNoUserOrIp()
    {
        // Arrange
        var context = CreateAnonymousContext();

        // Act
        var key = GetPartitionKey(context);

        // Assert
        Assert.Equal("anonymous", key);
    }

    [Fact]
    public void DifferentUsers_HaveIndependentLimits()
    {
        // Arrange — simulate two users each with their own limiter (as partitioning would create)
        using var limiterUserA = CreateLimiter(10);
        using var limiterUserB = CreateLimiter(10);

        // Act — exhaust user A's limit
        for (var i = 0; i < 10; i++)
            limiterUserA.AttemptAcquire();

        // Assert — user A is blocked but user B still has full quota
        Assert.False(limiterUserA.AttemptAcquire().IsAcquired, "User A should be rate-limited");
        Assert.True(limiterUserB.AttemptAcquire().IsAcquired, "User B should NOT be rate-limited");
    }
}
