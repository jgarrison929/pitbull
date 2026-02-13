using System.Text.Json.Serialization;

namespace Pitbull.Api.Models;

/// <summary>
/// Standard error response format for all API endpoints
/// </summary>
public class ErrorResponse
{
    /// <summary>
    /// Error details
    /// </summary>
    [JsonPropertyName("error")]
    public ErrorDetails Error { get; set; } = null!;

    /// <summary>
    /// Request trace identifier for debugging
    /// </summary>
    [JsonPropertyName("traceId")]
    public string? TraceId { get; set; }

    /// <summary>
    /// Additional metadata about the error
    /// </summary>
    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Error details object
/// </summary>
public class ErrorDetails
{
    /// <summary>
    /// Human-readable error message
    /// </summary>
    [JsonPropertyName("message")]
    public string Message { get; set; } = null!;

    /// <summary>
    /// Error code for programmatic handling
    /// </summary>
    [JsonPropertyName("code")]
    public string? Code { get; set; }

    /// <summary>
    /// Detailed validation errors (if applicable)
    /// </summary>
    [JsonPropertyName("details")]
    public Dictionary<string, string[]>? Details { get; set; }
}

/// <summary>
/// Builder class for creating consistent error responses
/// </summary>
public static class ErrorResponseBuilder
{
    /// <summary>
    /// Create a simple error response with message and code
    /// </summary>
    public static ErrorResponse Create(string message, string? code = null, string? traceId = null)
    {
        return new ErrorResponse
        {
            Error = new ErrorDetails
            {
                Message = message,
                Code = code
            },
            TraceId = traceId
        };
    }

    /// <summary>
    /// Create validation error response with field-specific errors
    /// </summary>
    public static ErrorResponse CreateValidation(string message, Dictionary<string, string[]> details, string? traceId = null)
    {
        return new ErrorResponse
        {
            Error = new ErrorDetails
            {
                Message = message,
                Code = "VALIDATION_FAILED",
                Details = details
            },
            TraceId = traceId
        };
    }

    /// <summary>
    /// Create error response from FluentValidation result
    /// </summary>
    public static ErrorResponse CreateFromFluentValidation(FluentValidation.Results.ValidationResult validationResult, string? traceId = null)
    {
        var details = validationResult.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).ToArray()
            );

        return CreateValidation("One or more validation errors occurred.", details, traceId);
    }

    /// <summary>
    /// Common error responses
    /// </summary>
    public static class Common
    {
        public static ErrorResponse NotFound(string message = "Resource not found", string? traceId = null) =>
            Create(message, "NOT_FOUND", traceId);

        public static ErrorResponse Unauthorized(string message = "Unauthorized access", string? traceId = null) =>
            Create(message, "UNAUTHORIZED", traceId);

        public static ErrorResponse Forbidden(string message = "Access forbidden", string? traceId = null) =>
            Create(message, "FORBIDDEN", traceId);

        public static ErrorResponse BadRequest(string message = "Invalid request", string? traceId = null) =>
            Create(message, "BAD_REQUEST", traceId);

        public static ErrorResponse TooManyRequests(string message = "Too many requests", string? traceId = null) =>
            Create(message, "RATE_LIMIT_EXCEEDED", traceId);
    }
}
