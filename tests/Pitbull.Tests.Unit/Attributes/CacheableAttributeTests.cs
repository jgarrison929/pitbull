using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Pitbull.Api.Attributes;
using System.Security.Claims;

namespace Pitbull.Tests.Unit.Attributes;

public class CacheableAttributeTests
{
    private static ActionExecutedContext CreateContext(IActionResult result, bool isAuthenticated = true)
    {
        var httpContext = new DefaultHttpContext();
        if (isAuthenticated)
        {
            httpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(new[] { new Claim("sub", "user-1") }, "Bearer"));
        }

        var actionContext = new ActionContext(
            httpContext,
            new RouteData(),
            new ActionDescriptor());

        return new ActionExecutedContext(
            actionContext,
            new List<IFilterMetadata>(),
            controller: null!)
        {
            Result = result
        };
    }

    [Fact]
    public void DefaultValues_SetsPrivateCacheControl_With300SecondMaxAge()
    {
        var attr = new CacheableAttribute();
        var context = CreateContext(new OkObjectResult(new { data = "test" }));

        attr.OnActionExecuted(context);

        var cacheControl = context.HttpContext.Response.Headers["Cache-Control"].ToString();
        cacheControl.Should().Contain("private");
        cacheControl.Should().Contain("max-age=300");
        cacheControl.Should().Contain("must-revalidate");
    }

    [Fact]
    public void CustomDuration_SetsCorrectMaxAge()
    {
        var attr = new CacheableAttribute { DurationSeconds = 120 };
        var context = CreateContext(new OkObjectResult(new { data = "test" }));

        attr.OnActionExecuted(context);

        var cacheControl = context.HttpContext.Response.Headers["Cache-Control"].ToString();
        cacheControl.Should().Contain("max-age=120");
    }

    [Fact]
    public void GeneratesETag_ForSuccessfulResponse()
    {
        var attr = new CacheableAttribute();
        var context = CreateContext(new OkObjectResult(new { data = "test" }));

        attr.OnActionExecuted(context);

        var etag = context.HttpContext.Response.Headers["ETag"].ToString();
        etag.Should().NotBeNullOrEmpty();
        etag.Should().StartWith("\"");
        etag.Should().EndWith("\"");
    }

    [Fact]
    public void SameContent_ProducesSameETag()
    {
        var attr = new CacheableAttribute();
        var content = new { data = "test", count = 42 };

        var context1 = CreateContext(new OkObjectResult(content));
        attr.OnActionExecuted(context1);
        var etag1 = context1.HttpContext.Response.Headers["ETag"].ToString();

        var context2 = CreateContext(new OkObjectResult(content));
        attr.OnActionExecuted(context2);
        var etag2 = context2.HttpContext.Response.Headers["ETag"].ToString();

        etag1.Should().Be(etag2);
    }

    [Fact]
    public void AddsVaryAuthorization_WhenAuthenticated()
    {
        var attr = new CacheableAttribute();
        var context = CreateContext(new OkObjectResult(new { data = "test" }), isAuthenticated: true);

        attr.OnActionExecuted(context);

        var vary = context.HttpContext.Response.Headers["Vary"].ToString();
        vary.Should().Be("Authorization");
    }

    [Fact]
    public void NonOkResponse_DoesNotSetCacheHeaders()
    {
        var attr = new CacheableAttribute();
        var context = CreateContext(new ObjectResult(new { error = "bad" }) { StatusCode = 400 });

        attr.OnActionExecuted(context);

        context.HttpContext.Response.Headers.Should().NotContainKey("Cache-Control");
        context.HttpContext.Response.Headers.Should().NotContainKey("ETag");
    }

    [Fact]
    public void NullStatusCode_TreatedAsNon200_DoesNotSetCacheHeaders()
    {
        var attr = new CacheableAttribute();
        // ObjectResult with null StatusCode (not explicitly 200)
        var context = CreateContext(new ObjectResult(new { data = "test" }) { StatusCode = null });

        attr.OnActionExecuted(context);

        context.HttpContext.Response.Headers.Should().NotContainKey("Cache-Control");
    }

    [Fact]
    public void ServerError_DoesNotSetCacheHeaders()
    {
        var attr = new CacheableAttribute();
        var context = CreateContext(new ObjectResult(new { error = "fail" }) { StatusCode = 500 });

        attr.OnActionExecuted(context);

        context.HttpContext.Response.Headers.Should().NotContainKey("Cache-Control");
        context.HttpContext.Response.Headers.Should().NotContainKey("ETag");
    }
}
