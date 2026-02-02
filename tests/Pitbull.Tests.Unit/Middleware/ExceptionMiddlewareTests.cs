using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Pitbull.Api.Middleware;

namespace Pitbull.Tests.Unit.Middleware;

public class ExceptionMiddlewareTests
{
    private sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = "test";
        public string ContentRootPath { get; set; } = "/";
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    [Fact]
    public async Task InvokeAsync_WhenExceptionThrown_IncludesCorrelationIdInJsonResponse()
    {
        var loggerFactory = LoggerFactory.Create(b => b.AddDebug());
        var logger = loggerFactory.CreateLogger<ExceptionMiddleware>();
        var env = new TestHostEnvironment(Environments.Production);

        var middleware = new ExceptionMiddleware(_ => throw new InvalidOperationException("boom"), logger, env);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        context.Items[CorrelationIdMiddleware.CorrelationIdItemName] = "cid-999";

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();

        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("correlationId", out var cid));
        Assert.Equal("cid-999", cid.GetString());
        Assert.True(doc.RootElement.TryGetProperty("traceId", out _));
        Assert.True(doc.RootElement.TryGetProperty("error", out _));
    }
}
