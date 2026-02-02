using Microsoft.AspNetCore.Http;
using Pitbull.Api.Middleware;

namespace Pitbull.Tests.Unit.Middleware;

public class CorrelationIdMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_UsesIncomingCorrelationIdHeader_SetsResponseHeaderAndItems()
    {
        var called = false;
        var middleware = new CorrelationIdMiddleware(ctx =>
        {
            called = true;
            return Task.CompletedTask;
        });

        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationIdMiddleware.CorrelationIdHeaderName] = "abc-123";

        await middleware.InvokeAsync(context);

        Assert.True(called);
        Assert.Equal("abc-123", context.Response.Headers[CorrelationIdMiddleware.CorrelationIdHeaderName].ToString());
        Assert.Equal("abc-123", context.Items[CorrelationIdMiddleware.CorrelationIdItemName]?.ToString());
    }

    [Fact]
    public async Task InvokeAsync_WhenNoIncomingHeader_GeneratesCorrelationId_SetsResponseHeaderAndItems()
    {
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask);
        var context = new DefaultHttpContext();

        await middleware.InvokeAsync(context);

        var headerValue = context.Response.Headers[CorrelationIdMiddleware.CorrelationIdHeaderName].ToString();
        Assert.False(string.IsNullOrWhiteSpace(headerValue));
        Assert.Equal(headerValue, context.Items[CorrelationIdMiddleware.CorrelationIdItemName]?.ToString());
    }
}
