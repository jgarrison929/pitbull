using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Pitbull.Api.Configuration;

namespace Pitbull.Tests.Unit.Configuration;

public class AuthRateLimitPolicyTests
{
    [Fact]
    public void ClientIpKey_uses_remote_ip()
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");

        Assert.Equal("203.0.113.10", AuthRateLimitPolicy.ClientIpKey(ctx));
    }

    [Fact]
    public void ClientIpKey_falls_back_when_ip_missing()
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = null;

        Assert.Equal("unknown", AuthRateLimitPolicy.ClientIpKey(ctx));
    }

    [Fact]
    public void AuthenticatedOrIpKey_prefers_nameidentifier()
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");
        ctx.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, "user-42"),
        ], "Test"));

        Assert.Equal("user-42", AuthRateLimitPolicy.AuthenticatedOrIpKey(ctx));
    }

    [Fact]
    public void AuthenticatedOrIpKey_falls_back_to_sub_then_ip()
    {
        var withSub = new DefaultHttpContext();
        withSub.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");
        withSub.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim("sub", "sub-99"),
        ], "Test"));

        Assert.Equal("sub-99", AuthRateLimitPolicy.AuthenticatedOrIpKey(withSub));

        var anon = new DefaultHttpContext();
        anon.Connection.RemoteIpAddress = IPAddress.Parse("198.51.100.7");
        Assert.Equal("198.51.100.7", AuthRateLimitPolicy.AuthenticatedOrIpKey(anon));
    }

    [Fact]
    public void ClientIpKey_differs_by_ip_so_auth_budgets_are_not_global()
    {
        var a = new DefaultHttpContext();
        a.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.1");
        var b = new DefaultHttpContext();
        b.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.2");

        Assert.NotEqual(
            AuthRateLimitPolicy.ClientIpKey(a),
            AuthRateLimitPolicy.ClientIpKey(b));
    }

    [Fact]
    public void WindowOptions_sets_permit_window_and_queue()
    {
        var opts = AuthRateLimitPolicy.WindowOptions(10, TimeSpan.FromMinutes(1), queueLimit: 5);
        Assert.Equal(10, opts.PermitLimit);
        Assert.Equal(TimeSpan.FromMinutes(1), opts.Window);
        Assert.Equal(5, opts.QueueLimit);
    }
}
