using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Pitbull.Api.Middleware;

namespace Pitbull.Tests.Unit.Middleware;

public class DemoRestrictionMiddlewareTests
{
    private static HttpContext CreateDemoContext(string path, string method = "GET", string? email = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        var claims = new List<Claim> { new("is_demo_user", "true") };
        if (!string.IsNullOrEmpty(email))
            claims.Add(new Claim(ClaimTypes.Email, email));
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
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
            new Claim(ClaimTypes.Email, "owner@example.com"),
        ], "TestAuth"));
        return context;
    }

    private static HttpContext CreateEmailOnlyDemoContext(string path, string email, string method = "GET")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        // No is_demo_user claim — email fallback for pre-backfill tokens
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.Email, email),
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

    [Fact]
    public async Task DemoUser_CanAccess_CompaniesAccessible()
    {
        var context = CreateDemoContext("/api/companies/accessible");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.True(nextCalled);
        Assert.NotEqual(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_CanAccess_CompaniesSwitch_WithGuid()
    {
        var context = CreateDemoContext("/api/companies/switch/550e8400-e29b-41d4-a716-446655440000", "POST");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.True(nextCalled);
        Assert.NotEqual(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_CanRead_AdminCompanies()
    {
        var context = CreateDemoContext("/api/admin/companies", "GET");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.True(nextCalled, "GET /api/admin/* should be read-only allowed");
        Assert.NotEqual(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_CannotWrite_AdminCompanies()
    {
        var context = CreateDemoContext("/api/admin/companies", "POST");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.False(nextCalled);
        Assert.Equal(403, statusCode);
    }

    [Theory]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    [InlineData("DELETE")]
    public async Task DemoUser_CannotMutate_AdminUsers(string method)
    {
        var context = CreateDemoContext("/api/admin/users/some-id", method);
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.False(nextCalled);
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_CanRead_AdminUsers()
    {
        var context = CreateDemoContext("/api/admin/users", "GET");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.True(nextCalled);
        Assert.NotEqual(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsFullyBlocked_FromSecrets()
    {
        var context = CreateDemoContext("/api/secrets", "GET");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.False(nextCalled);
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsBlocked_FromDeleteRequests()
    {
        var context = CreateDemoContext("/api/projects/some-id", "DELETE");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.False(nextCalled);
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsBlocked_FromNestedUsers_Mutations()
    {
        var context = CreateDemoContext("/api/companies/some-id/users", "POST");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.False(nextCalled);
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_CanRead_NestedUsers()
    {
        var context = CreateDemoContext("/api/companies/some-id/users", "GET");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.True(nextCalled);
        Assert.NotEqual(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsBlocked_FromCompaniesSwitch_WithInvalidGuid()
    {
        var context = CreateDemoContext("/api/companies/switch/not-a-guid");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.False(nextCalled);
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task DemoUser_IsBlocked_FromCompaniesSwitch_PathTraversal()
    {
        var context = CreateDemoContext("/api/companies/switch/../../admin");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.False(nextCalled);
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task NonDemoUser_CanAccess_AdminEndpoints()
    {
        var context = CreateNonDemoContext("/api/admin/companies", "POST");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.True(nextCalled);
        Assert.NotEqual(403, statusCode);
    }

    [Fact]
    public async Task EmailOnly_DemoLocal_IsTreatedAsDemo_ForAdminWrite()
    {
        var context = CreateEmailOnlyDemoContext("/api/admin/users", "ceo@demo.local", "POST");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.False(nextCalled);
        Assert.Equal(403, statusCode);
    }

    [Fact]
    public async Task EmailOnly_DemoLocal_CanReadAdmin()
    {
        var context = CreateEmailOnlyDemoContext("/api/admin/users", "ceo@demo.local", "GET");
        var (statusCode, nextCalled) = await InvokeAsync(context);
        Assert.True(nextCalled);
        Assert.NotEqual(403, statusCode);
    }

    [Theory]
    [InlineData("ceo@demo.local")]
    [InlineData("demo@example.com")]
    [InlineData("pm@demo.local")]
    public void IsDemoPrincipal_RecognizesSeededEmails(string email)
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.Email, email),
        ], "TestAuth"));
        Assert.True(DemoRestrictionMiddleware.IsDemoPrincipal(user));
    }

    [Fact]
    public void IsDemoPrincipal_DoesNotFlagRegularUsers()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.Email, "owner@acme.com"),
        ], "TestAuth"));
        Assert.False(DemoRestrictionMiddleware.IsDemoPrincipal(user));
    }
}
