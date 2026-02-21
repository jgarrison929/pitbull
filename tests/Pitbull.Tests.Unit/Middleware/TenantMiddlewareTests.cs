using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Middleware;

public class TenantMiddlewareTests
{
    private readonly Mock<ILogger<TenantMiddleware>> _loggerMock = new();
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;

    private TenantMiddleware CreateMiddleware(RequestDelegate next)
        => new(next, _loggerMock.Object);

    // ── Returns 401 for authenticated API requests without tenant ──

    [Fact]
    public async Task InvokeAsync_Returns401_ForAuthenticatedApiRequest_WithoutTenantClaim()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = new DefaultHttpContext();
        context.Request.Path = "/api/projects";
        context.Response.Body = new MemoryStream();

        // Set authenticated identity WITHOUT tenant_id claim
        var identity = new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()) },
            "Bearer");
        context.User = new ClaimsPrincipal(identity);

        using var db = TestDbContextFactory.Create();
        var tenantContext = new TenantContext();

        await middleware.InvokeAsync(context, tenantContext, db);

        Assert.False(nextCalled, "Request should not reach downstream middleware");
        Assert.Equal(401, context.Response.StatusCode);

        // Verify error JSON body
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Contains("Tenant context could not be resolved", body);
    }

    // ── Passes through for unauthenticated requests (AllowAnonymous) ──

    [Fact]
    public async Task InvokeAsync_PassesThrough_ForUnauthenticatedApiRequest()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = new DefaultHttpContext();
        context.Request.Path = "/api/auth/login";
        // No user set — unauthenticated

        using var db = TestDbContextFactory.Create();
        var tenantContext = new TenantContext();

        await middleware.InvokeAsync(context, tenantContext, db);

        Assert.True(nextCalled, "Unauthenticated requests should pass through");
        Assert.False(tenantContext.IsResolved);
    }

    // ── Passes through for non-API paths (health, swagger) ──

    [Theory]
    [InlineData("/health")]
    [InlineData("/health/live")]
    [InlineData("/swagger")]
    [InlineData("/")]
    public async Task InvokeAsync_PassesThrough_ForNonApiPaths_EvenAuthenticated(string path)
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = new DefaultHttpContext();
        context.Request.Path = path;

        // Authenticated but no tenant — should still pass through for non-API paths
        var identity = new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()) },
            "Bearer");
        context.User = new ClaimsPrincipal(identity);

        using var db = TestDbContextFactory.Create();
        var tenantContext = new TenantContext();

        await middleware.InvokeAsync(context, tenantContext, db);

        Assert.True(nextCalled, "Non-API paths should pass through");
    }

    // NOTE: Tenant resolution from JWT claim and X-Tenant-Id header tests require a real
    // relational DB (for ExecuteSqlInterpolatedAsync RLS setup) — tested in integration tests.
}
