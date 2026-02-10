using Microsoft.AspNetCore.Http;
using Pitbull.Api.Middleware;

namespace Pitbull.Tests.Unit.Middleware;

public class SecurityHeadersMiddlewareTests
{
    private static async Task<HttpContext> ExecuteMiddlewareAsync(SecurityHeadersMiddleware middleware)
    {
        var context = new DefaultHttpContext();
        await middleware.InvokeAsync(context);
        return context;
    }

    [Fact]
    public async Task Adds_XContentTypeOptions_nosniff_header()
    {
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);

        var context = await ExecuteMiddlewareAsync(middleware);

        Assert.Equal("nosniff", context.Response.Headers["X-Content-Type-Options"]);
    }

    [Fact]
    public async Task Adds_XFrameOptions_DENY_header()
    {
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);

        var context = await ExecuteMiddlewareAsync(middleware);

        Assert.Equal("DENY", context.Response.Headers["X-Frame-Options"]);
    }

    [Fact]
    public async Task Adds_XXSSProtection_header()
    {
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);

        var context = await ExecuteMiddlewareAsync(middleware);

        Assert.Equal("1; mode=block", context.Response.Headers["X-XSS-Protection"]);
    }

    [Fact]
    public async Task Adds_ReferrerPolicy_header()
    {
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);

        var context = await ExecuteMiddlewareAsync(middleware);

        Assert.Equal("strict-origin-when-cross-origin", context.Response.Headers["Referrer-Policy"]);
    }

    [Fact]
    public async Task Adds_ContentSecurityPolicy_header()
    {
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);

        var context = await ExecuteMiddlewareAsync(middleware);

        Assert.Equal("default-src 'none'; frame-ancestors 'none';", context.Response.Headers["Content-Security-Policy"]);
    }

    [Fact]
    public async Task Adds_PermissionsPolicy_header()
    {
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);

        var context = await ExecuteMiddlewareAsync(middleware);

        var permissionsPolicy = context.Response.Headers["Permissions-Policy"].ToString();
        Assert.Contains("geolocation=()", permissionsPolicy);
        Assert.Contains("microphone=()", permissionsPolicy);
        Assert.Contains("camera=()", permissionsPolicy);
        Assert.Contains("payment=()", permissionsPolicy);
    }

    [Fact]
    public async Task Calls_next_delegate()
    {
        var nextCalled = false;
        var middleware = new SecurityHeadersMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        await ExecuteMiddlewareAsync(middleware);

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Headers_added_before_next_delegate()
    {
        string? headerValueDuringNext = null;
        var middleware = new SecurityHeadersMiddleware(ctx =>
        {
            // Check if header is set when next is called
            headerValueDuringNext = ctx.Response.Headers["X-Content-Type-Options"];
            return Task.CompletedTask;
        });

        var context = new DefaultHttpContext();
        await middleware.InvokeAsync(context);

        Assert.Equal("nosniff", headerValueDuringNext);
    }

    [Fact]
    public async Task All_security_headers_are_present()
    {
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);

        var context = await ExecuteMiddlewareAsync(middleware);

        var headers = context.Response.Headers;
        Assert.True(headers.ContainsKey("X-Content-Type-Options"));
        Assert.True(headers.ContainsKey("X-Frame-Options"));
        Assert.True(headers.ContainsKey("X-XSS-Protection"));
        Assert.True(headers.ContainsKey("Referrer-Policy"));
        Assert.True(headers.ContainsKey("Content-Security-Policy"));
        Assert.True(headers.ContainsKey("Permissions-Policy"));
    }
}
