using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Pitbull.Api.Middleware;

namespace Pitbull.Tests.Unit.Middleware;

public class DemoRestrictionMiddlewareTests
{
    private static HttpContext CreateDemoContext(string path, string method = "GET")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim("is_demo_user", "true"),
        ], "TestAuth"));
        return context;
    }

    private static HttpContext CreateNonDemoContext(string path, string method = "GET")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim("is_demo_user", "false"),
        ], "TestAuth"));
        return context;
    }

    private static async Task<(int StatusCode, bool NextCalled)> InvokeAsync(HttpContext context)
    {
        var nextCalled = false;
        var middleware = new DemoRestrictionMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });
        await middleware.InvokeAsync(context);
        return (context.Response.StatusCode, nextCalled);
    }

    // ─── Company switcher paths must be allowed ──────────────────────────────

    [Fact]
    public async Task DemoUser_CanAccess_CompaniesAccessible()
    {
        var context = CreateDemoContext("/api/companies/accessible");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.True(nextCalled, "/api/companies/accessible should be allowed for demo users");
        Assert.NotEqual(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_CanAccess_CompaniesSwitch_WithGuid()
    {
        var context = CreateDemoContext("/api/companies/switch/550e8400-e29b-41d4-a716-446655440000");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.True(nextCalled, "/api/companies/switch/{guid} should be allowed for demo users");
        Assert.NotEqual(403, statusCode);
    }

    // ─── Admin endpoints must still be blocked ───────────────────────────────

    [Fact]
    public async Task DemoUser_IsBlocked_FromAdminCompanies()
    {
        var context = CreateDemoContext("/api/admin/companies");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.False(nextCalled, "/api/admin/companies should be blocked for demo users");
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsBlocked_FromDeleteRequests()
    {
        var context = CreateDemoContext("/api/projects/some-id", "DELETE");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.False(nextCalled, "DELETE requests should be blocked for demo users");
        Assert.Equal(403, statusCode);
    }

    // ─── Blocked segment paths must still be blocked ─────────────────────────

    [Fact]
    public async Task DemoUser_IsBlocked_FromNestedUsersEndpoints()
    {
        var context = CreateDemoContext("/api/companies/some-id/users");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.False(nextCalled, "/api/companies/{id}/users should be blocked for demo users");
        Assert.Equal(403, statusCode);
    }

    // ─── Company switch GUID validation ────────────────────────────────────────

    [Fact]
    public async Task DemoUser_CanAccess_CompaniesSwitch_WithValidGuid()
    {
        var context = CreateDemoContext("/api/companies/switch/b2b8d0a1-70a3-4278-ae9e-7396b6d2d6ab");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.True(nextCalled, "/api/companies/switch/{valid-guid} should be allowed");
        Assert.NotEqual(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsBlocked_FromCompaniesSwitch_WithInvalidGuid()
    {
        var context = CreateDemoContext("/api/companies/switch/not-a-guid");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.False(nextCalled, "/api/companies/switch/not-a-guid should be blocked");
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsBlocked_FromCompaniesSwitch_PathTraversal()
    {
        var context = CreateDemoContext("/api/companies/switch/../../admin");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.False(nextCalled, "Path traversal via /api/companies/switch/ should be blocked");
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsBlocked_FromCompaniesSwitch_NoGuid()
    {
        var context = CreateDemoContext("/api/companies/switch/");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.False(nextCalled, "/api/companies/switch/ with no GUID should be blocked");
        Assert.Equal(403, statusCode);
    }

    // ─── Non-demo users are unaffected ───────────────────────────────────────

    [Fact]
    public async Task NonDemoUser_CanAccess_AdminEndpoints()
    {
        var context = CreateNonDemoContext("/api/admin/companies");

        var (statusCode, nextCalled) = await InvokeAsync(context);

        Assert.True(nextCalled, "Non-demo users should not be restricted");
        Assert.NotEqual(403, statusCode);
    }
}
