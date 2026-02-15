using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using Pitbull.Api.Middleware;

namespace Pitbull.Tests.Unit.Middleware;

public class RequestSizeLimitMiddlewareTests
{
    private static RequestSizeLimitOptions DefaultOptions => new();

    private static IOptions<RequestSizeLimitOptions> WrapOptions(RequestSizeLimitOptions? options = null)
        => Options.Create(options ?? DefaultOptions);

    private sealed class FakeMaxRequestBodySizeFeature : IHttpMaxRequestBodySizeFeature
    {
        public bool IsReadOnly { get; set; }
        public long? MaxRequestBodySize { get; set; }
    }

    private static DefaultHttpContext CreateContext(
        string method = "GET",
        string path = "/",
        string? endpointName = null,
        IHttpMaxRequestBodySizeFeature? feature = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;

        if (feature != null)
        {
            context.Features.Set(feature);
        }

        if (endpointName != null)
        {
            var endpoint = new Endpoint(_ => Task.CompletedTask, new EndpointMetadataCollection(), endpointName);
            context.SetEndpoint(endpoint);
        }

        return context;
    }

    // ── Global Max Size ──────────────────────────────────────

    [Fact]
    public async Task InvokeAsync_SetsGlobalMaxSize_OnFeature()
    {
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        Assert.Equal(DefaultOptions.GlobalMaxSize, feature.MaxRequestBodySize);
    }

    [Fact]
    public async Task InvokeAsync_WithCustomGlobalMaxSize_UsesConfiguredValue()
    {
        var options = new RequestSizeLimitOptions { GlobalMaxSize = 5_000_000 };
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions(options));

        await middleware.InvokeAsync(context);

        // With no endpoint, should be the global max
        Assert.Equal(5_000_000, feature.MaxRequestBodySize);
    }

    // ── API Max Size (POST/PUT/PATCH) ────────────────────────

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    public async Task InvokeAsync_SetsApiMaxSize_ForWriteMethods(string method)
    {
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(method: method, endpointName: "/api/projects", feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        Assert.Equal(DefaultOptions.ApiMaxSize, feature.MaxRequestBodySize);
    }

    [Fact]
    public async Task InvokeAsync_DoesNotSetApiMaxSize_ForGetRequest()
    {
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(method: "GET", endpointName: "/api/projects", feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        // Should remain at global max, not API max
        Assert.Equal(DefaultOptions.GlobalMaxSize, feature.MaxRequestBodySize);
    }

    [Fact]
    public async Task InvokeAsync_DoesNotSetApiMaxSize_ForDeleteRequest()
    {
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(method: "DELETE", endpointName: "/api/projects/1", feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        Assert.Equal(DefaultOptions.GlobalMaxSize, feature.MaxRequestBodySize);
    }

    // ── Document Upload Max Size ─────────────────────────────

    [Theory]
    [InlineData("upload")]
    [InlineData("document")]
    [InlineData("Upload")]
    [InlineData("Document")]
    [InlineData("/api/projects/upload")]
    [InlineData("/api/document/create")]
    public async Task InvokeAsync_SetsDocumentUploadMaxSize_ForUploadEndpoints(string endpointName)
    {
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(method: "POST", endpointName: endpointName, feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        Assert.Equal(DefaultOptions.DocumentUploadMaxSize, feature.MaxRequestBodySize);
    }

    [Fact]
    public async Task InvokeAsync_WithCustomDocumentUploadMaxSize_UsesConfiguredValue()
    {
        var options = new RequestSizeLimitOptions { DocumentUploadMaxSize = 100_000_000 };
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(method: "POST", endpointName: "/api/upload/file", feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions(options));

        await middleware.InvokeAsync(context);

        Assert.Equal(100_000_000, feature.MaxRequestBodySize);
    }

    // ── Read-Only Feature ────────────────────────────────────

    [Fact]
    public async Task InvokeAsync_DoesNotModify_ReadOnlyFeature()
    {
        var feature = new FakeMaxRequestBodySizeFeature { IsReadOnly = true, MaxRequestBodySize = 999 };
        var context = CreateContext(feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        Assert.Equal(999, feature.MaxRequestBodySize);
    }

    [Fact]
    public async Task InvokeAsync_DoesNotModify_ReadOnlyFeature_ForWriteMethods()
    {
        var feature = new FakeMaxRequestBodySizeFeature { IsReadOnly = true, MaxRequestBodySize = 999 };
        var context = CreateContext(method: "POST", endpointName: "/api/projects", feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        Assert.Equal(999, feature.MaxRequestBodySize);
    }

    // ── No Feature ───────────────────────────────────────────

    [Fact]
    public async Task InvokeAsync_WhenNoFeature_DoesNotThrow()
    {
        var context = CreateContext(); // no feature set
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        var exception = await Record.ExceptionAsync(() => middleware.InvokeAsync(context));

        Assert.Null(exception);
    }

    // ── Next Delegate ────────────────────────────────────────

    [Fact]
    public async Task InvokeAsync_CallsNextDelegate()
    {
        var nextCalled = false;
        var middleware = new RequestSizeLimitMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        }, WrapOptions());

        var context = CreateContext();
        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
    }

    // ── No Endpoint ──────────────────────────────────────────

    [Fact]
    public async Task InvokeAsync_WhenNoEndpoint_OnlySetsGlobalMax()
    {
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(method: "POST", feature: feature); // no endpoint
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        Assert.Equal(DefaultOptions.GlobalMaxSize, feature.MaxRequestBodySize);
    }

    // ── Custom Options ───────────────────────────────────────

    [Fact]
    public async Task InvokeAsync_WithCustomApiMaxSize_UsesConfiguredValue()
    {
        var options = new RequestSizeLimitOptions { ApiMaxSize = 2_000_000 };
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(method: "POST", endpointName: "/api/bids", feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions(options));

        await middleware.InvokeAsync(context);

        Assert.Equal(2_000_000, feature.MaxRequestBodySize);
    }

    // ── Upload takes priority over write method ──────────────

    [Fact]
    public async Task InvokeAsync_UploadEndpoint_WithPostMethod_UsesDocumentUploadSize_NotApiSize()
    {
        var feature = new FakeMaxRequestBodySizeFeature { MaxRequestBodySize = null };
        var context = CreateContext(method: "POST", endpointName: "/api/upload/documents", feature: feature);
        var middleware = new RequestSizeLimitMiddleware(_ => Task.CompletedTask, WrapOptions());

        await middleware.InvokeAsync(context);

        // Upload size should win over API size since the code checks upload first
        Assert.Equal(DefaultOptions.DocumentUploadMaxSize, feature.MaxRequestBodySize);
    }
}
