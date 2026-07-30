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
        Assert.True(Guid.TryParse(headerValue, out _));
        Assert.Equal(headerValue, context.Items[CorrelationIdMiddleware.CorrelationIdItemName]?.ToString());
    }

    [Theory]
    [InlineData("abc\r\nInjected")]
    [InlineData("bad value with spaces")]
    [InlineData("has;semicolon")]
    [InlineData("has\"quote")]
    public void ResolveCorrelationId_RejectsInvalidOrForgedHeaders_GeneratesServerId(string forged)
    {
        var resolved = CorrelationIdMiddleware.ResolveCorrelationId(forged);
        Assert.True(Guid.TryParse(resolved, out _));
        Assert.DoesNotContain("\r", resolved);
        Assert.DoesNotContain("\n", resolved);
        Assert.NotEqual(forged, resolved);
    }

    [Fact]
    public void ResolveCorrelationId_RejectsOversizedHeader()
    {
        var oversized = new string('a', CorrelationIdMiddleware.MaxCorrelationIdLength + 1);
        var resolved = CorrelationIdMiddleware.ResolveCorrelationId(oversized);
        Assert.True(Guid.TryParse(resolved, out _));
    }

    [Fact]
    public void ResolveCorrelationId_AcceptsGuidAndAlphanumeric()
    {
        var guid = Guid.NewGuid().ToString();
        Assert.Equal(guid, CorrelationIdMiddleware.ResolveCorrelationId(guid));
        Assert.Equal("req_abc-DEF01", CorrelationIdMiddleware.ResolveCorrelationId("req_abc-DEF01"));
    }
}
