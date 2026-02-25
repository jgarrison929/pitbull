using System.Security.Claims;
using FluentAssertions;
using Hangfire;
using Hangfire.Dashboard;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Pitbull.Api.Jobs;

namespace Pitbull.Tests.Unit.Jobs;

public class HangfireDashboardAuthFilterTests
{
    private readonly HangfireDashboardAuthFilter _filter = new();

    private static DashboardContext CreateDashboardContext(ClaimsPrincipal? user = null)
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var httpContext = new DefaultHttpContext { RequestServices = services };
        if (user is not null)
            httpContext.User = user;

        var storage = new Mock<JobStorage>();
        var options = new DashboardOptions();
        return new AspNetCoreDashboardContext(storage.Object, options, httpContext);
    }

    [Fact]
    public void Authorize_UnauthenticatedUser_ReturnsFalse()
    {
        var context = CreateDashboardContext();

        _filter.Authorize(context).Should().BeFalse();
    }

    [Fact]
    public void Authorize_AuthenticatedNonAdmin_ReturnsFalse()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "user-1")], "test"));
        var context = CreateDashboardContext(user);

        _filter.Authorize(context).Should().BeFalse();
    }

    [Fact]
    public void Authorize_TenantAdmin_ReturnsFalse()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, "admin-1"),
                new Claim(ClaimTypes.Role, "Admin")
            ], "test"));
        var context = CreateDashboardContext(user);

        _filter.Authorize(context).Should().BeFalse();
    }

    [Fact]
    public void Authorize_SystemAdmin_ReturnsTrue()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, "sysadmin-1"),
                new Claim(ClaimTypes.Role, "SystemAdmin")
            ], "test"));
        var context = CreateDashboardContext(user);

        _filter.Authorize(context).Should().BeTrue();
    }
}
