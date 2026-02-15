using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Api.Middleware;

namespace Pitbull.Tests.Unit.Middleware;

public class RequestResponseLoggingMiddlewareTests
{
    private readonly Mock<ILogger<RequestResponseLoggingMiddleware>> _loggerMock = new();

    private RequestResponseLoggingMiddleware CreateMiddleware(RequestDelegate next)
        => new(next, _loggerMock.Object);

    private static DefaultHttpContext CreateApiContext(
        string method = "GET",
        string path = "/api/projects",
        int responseStatusCode = 200,
        string? requestBody = null,
        string? contentType = "application/json")
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();

        if (requestBody != null)
        {
            var bytes = Encoding.UTF8.GetBytes(requestBody);
            context.Request.Body = new MemoryStream(bytes);
            context.Request.ContentLength = bytes.Length;
        }

        if (contentType != null)
        {
            context.Request.ContentType = contentType;
        }

        return context;
    }

    // ── Skips non-API paths ──────────────────────────────────

    [Theory]
    [InlineData("/health")]
    [InlineData("/swagger")]
    [InlineData("/")]
    [InlineData("/static/file.js")]
    public async Task InvokeAsync_SkipsLogging_ForNonApiPaths(string path)
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(path: path);
        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
        _loggerMock.Verify(
            x => x.Log(
                It.IsAny<LogLevel>(),
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);
    }

    // ── Logs request for /api paths ──────────────────────────

    [Fact]
    public async Task InvokeAsync_LogsRequest_ForApiPaths()
    {
        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(path: "/api/projects");
        await middleware.InvokeAsync(context);

        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((o, _) => o.ToString()!.Contains("API Request")),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    // ── Logs error responses (status >= 400) ─────────────────

    [Theory]
    [InlineData(400)]
    [InlineData(401)]
    [InlineData(404)]
    [InlineData(500)]
    public async Task InvokeAsync_LogsErrorResponse_WhenStatusCode400OrAbove(int statusCode)
    {
        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = statusCode;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(path: "/api/projects");
        await middleware.InvokeAsync(context);

        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((o, _) => o.ToString()!.Contains("API Error Response")),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    // ── Does NOT log success response body ───────────────────

    [Theory]
    [InlineData(200)]
    [InlineData(201)]
    [InlineData(204)]
    [InlineData(301)]
    public async Task InvokeAsync_DoesNotLogResponseBody_ForSuccessStatusCodes(int statusCode)
    {
        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = statusCode;
            var bytes = Encoding.UTF8.GetBytes("{\"data\": \"secret-stuff\"}");
            return ctx.Response.Body.WriteAsync(bytes, 0, bytes.Length);
        });

        var context = CreateApiContext(path: "/api/projects");
        await middleware.InvokeAsync(context);

        // Should have the request log but NOT the error response log
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((o, _) => o.ToString()!.Contains("API Error Response")),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);
    }

    // ── Sanitizes sensitive JSON fields ──────────────────────

    [Theory]
    [InlineData("password")]
    [InlineData("token")]
    [InlineData("secret")]
    [InlineData("key")]
    [InlineData("Password")]
    [InlineData("ApiKey")]
    [InlineData("accessToken")]
    [InlineData("clientSecret")]
    public async Task InvokeAsync_SanitizesSensitiveFields_InJsonBody(string fieldName)
    {
        string? loggedMessage = null;
        _loggerMock.Setup(x => x.Log(
            LogLevel.Information,
            It.IsAny<EventId>(),
            It.IsAny<It.IsAnyType>(),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
            .Callback<LogLevel, EventId, object, Exception?, Delegate>((_, _, state, _, _) =>
            {
                loggedMessage = state.ToString();
            });

        var jsonBody = $"{{\"{fieldName}\": \"super-secret-value\", \"name\": \"test\"}}";
        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(
            method: "POST",
            path: "/api/auth/login",
            requestBody: jsonBody);

        await middleware.InvokeAsync(context);

        Assert.NotNull(loggedMessage);
        Assert.DoesNotContain("super-secret-value", loggedMessage);
    }

    // ── Sanitizes Authorization header ───────────────────────

    [Fact]
    public async Task InvokeAsync_SanitizesAuthorizationHeader()
    {
        string? loggedMessage = null;
        _loggerMock.Setup(x => x.Log(
            LogLevel.Information,
            It.IsAny<EventId>(),
            It.IsAny<It.IsAnyType>(),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
            .Callback<LogLevel, EventId, object, Exception?, Delegate>((_, _, state, _, _) =>
            {
                loggedMessage = state.ToString();
            });

        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(path: "/api/projects");
        context.Request.Headers["Authorization"] = "Bearer my-super-secret-jwt";

        await middleware.InvokeAsync(context);

        Assert.NotNull(loggedMessage);
        Assert.DoesNotContain("my-super-secret-jwt", loggedMessage);
    }

    // ── Handles non-JSON content types ───────────────────────

    [Fact]
    public async Task InvokeAsync_HandlesNonJsonContentType_Gracefully()
    {
        string? loggedMessage = null;
        _loggerMock.Setup(x => x.Log(
            LogLevel.Information,
            It.IsAny<EventId>(),
            It.IsAny<It.IsAnyType>(),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
            .Callback<LogLevel, EventId, object, Exception?, Delegate>((_, _, state, _, _) =>
            {
                loggedMessage = state.ToString();
            });

        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(
            method: "POST",
            path: "/api/files",
            requestBody: "binary-content-here",
            contentType: "multipart/form-data");

        await middleware.InvokeAsync(context);

        Assert.NotNull(loggedMessage);
        // Should indicate content type rather than dump raw binary
        Assert.Contains("multipart/form-data", loggedMessage);
    }

    // ── Handles null/empty request bodies ────────────────────

    [Fact]
    public async Task InvokeAsync_HandlesNullRequestBody_Gracefully()
    {
        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(path: "/api/projects", requestBody: null);

        var exception = await Record.ExceptionAsync(() => middleware.InvokeAsync(context));

        Assert.Null(exception);
    }

    [Fact]
    public async Task InvokeAsync_HandlesEmptyJsonBody_Gracefully()
    {
        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(
            method: "POST",
            path: "/api/projects",
            requestBody: "");

        var exception = await Record.ExceptionAsync(() => middleware.InvokeAsync(context));

        Assert.Null(exception);
    }

    // ── Preserves response stream ────────────────────────────

    [Fact]
    public async Task InvokeAsync_PreservesResponseStream_AfterLogging()
    {
        var responseContent = "{\"id\": 1, \"name\": \"Test Project\"}";
        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 200;
            var bytes = Encoding.UTF8.GetBytes(responseContent);
            return ctx.Response.Body.WriteAsync(bytes, 0, bytes.Length);
        });

        var originalStream = new MemoryStream();
        var context = CreateApiContext(path: "/api/projects");
        context.Response.Body = originalStream;

        await middleware.InvokeAsync(context);

        // The response body should contain the original content
        originalStream.Seek(0, SeekOrigin.Begin);
        var actualContent = await new StreamReader(originalStream).ReadToEndAsync();
        Assert.Equal(responseContent, actualContent);
    }

    [Fact]
    public async Task InvokeAsync_PreservesResponseStream_AfterErrorLogging()
    {
        var responseContent = "{\"error\": \"Not Found\"}";
        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 404;
            var bytes = Encoding.UTF8.GetBytes(responseContent);
            return ctx.Response.Body.WriteAsync(bytes, 0, bytes.Length);
        });

        var originalStream = new MemoryStream();
        var context = CreateApiContext(path: "/api/projects/999");
        context.Response.Body = originalStream;

        await middleware.InvokeAsync(context);

        originalStream.Seek(0, SeekOrigin.Begin);
        var actualContent = await new StreamReader(originalStream).ReadToEndAsync();
        Assert.Equal(responseContent, actualContent);
    }

    // ── Calls next middleware ─────────────────────────────────

    [Fact]
    public async Task InvokeAsync_CallsNextDelegate_ForApiPaths()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(path: "/api/test");
        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task InvokeAsync_CallsNextDelegate_ForNonApiPaths()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(path: "/health");
        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
    }

    // ── Correlation ID is passed through ─────────────────────

    [Fact]
    public async Task InvokeAsync_IncludesCorrelationId_InLogMessages()
    {
        string? loggedMessage = null;
        _loggerMock.Setup(x => x.Log(
            LogLevel.Information,
            It.IsAny<EventId>(),
            It.IsAny<It.IsAnyType>(),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
            .Callback<LogLevel, EventId, object, Exception?, Delegate>((_, _, state, _, _) =>
            {
                loggedMessage = state.ToString();
            });

        var middleware = CreateMiddleware(ctx =>
        {
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        });

        var context = CreateApiContext(path: "/api/projects");
        context.Items[CorrelationIdMiddleware.CorrelationIdItemName] = "test-correlation-123";

        await middleware.InvokeAsync(context);

        Assert.NotNull(loggedMessage);
        Assert.Contains("test-correlation-123", loggedMessage);
    }

    // ── Exception handling ───────────────────────────────────

    [Fact]
    public async Task InvokeAsync_LogsError_WhenExceptionThrown()
    {
        var middleware = CreateMiddleware(_ => throw new InvalidOperationException("boom"));

        var context = CreateApiContext(path: "/api/projects");

        await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(context));

        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<InvalidOperationException>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task InvokeAsync_RethrowsException_AfterLogging()
    {
        var middleware = CreateMiddleware(_ => throw new InvalidOperationException("test-error"));

        var context = CreateApiContext(path: "/api/test");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(context));
        Assert.Equal("test-error", ex.Message);
    }
}
