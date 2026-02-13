using Microsoft.AspNetCore.Mvc;
using Pitbull.Api.Models;
using Pitbull.Core.CQRS;

namespace Pitbull.Api.Extensions;

/// <summary>
/// Extension methods for controllers to return consistent error responses
/// </summary>
public static class ControllerExtensions
{
    /// <summary>
    /// Create a standardized error response
    /// </summary>
    public static ObjectResult Error(this ControllerBase controller, int statusCode, string message, string? code = null)
    {
        var errorResponse = ErrorResponseBuilder.Create(message, code, controller.HttpContext.TraceIdentifier);
        return controller.StatusCode(statusCode, errorResponse);
    }

    /// <summary>
    /// Create a validation error response
    /// </summary>
    public static ObjectResult ValidationError(this ControllerBase controller, Dictionary<string, string[]> details, string message = "One or more validation errors occurred.")
    {
        var errorResponse = ErrorResponseBuilder.CreateValidation(message, details, controller.HttpContext.TraceIdentifier);
        return controller.BadRequest(errorResponse);
    }

    /// <summary>
    /// Create a validation error response from FluentValidation result
    /// </summary>
    public static ObjectResult ValidationError(this ControllerBase controller, FluentValidation.Results.ValidationResult validationResult)
    {
        var errorResponse = ErrorResponseBuilder.CreateFromFluentValidation(validationResult, controller.HttpContext.TraceIdentifier);
        return controller.BadRequest(errorResponse);
    }

    /// <summary>
    /// Common error responses
    /// </summary>
    public static ObjectResult NotFoundError(this ControllerBase controller, string message = "Resource not found")
    {
        var errorResponse = ErrorResponseBuilder.Common.NotFound(message, controller.HttpContext.TraceIdentifier);
        return controller.NotFound(errorResponse);
    }

    public static ObjectResult UnauthorizedError(this ControllerBase controller, string message = "Unauthorized access")
    {
        var errorResponse = ErrorResponseBuilder.Common.Unauthorized(message, controller.HttpContext.TraceIdentifier);
        return controller.Unauthorized(errorResponse);
    }

    public static ObjectResult ForbiddenError(this ControllerBase controller, string message = "Access forbidden")
    {
        var errorResponse = ErrorResponseBuilder.Common.Forbidden(message, controller.HttpContext.TraceIdentifier);
        return controller.StatusCode(403, errorResponse);
    }

    public static ObjectResult BadRequestError(this ControllerBase controller, string message = "Invalid request")
    {
        var errorResponse = ErrorResponseBuilder.Common.BadRequest(message, controller.HttpContext.TraceIdentifier);
        return controller.BadRequest(errorResponse);
    }

    /// <summary>
    /// Handle Result pattern from CQRS operations
    /// </summary>
    public static IActionResult HandleResult<T>(this ControllerBase controller, Result<T> result)
    {
        if (result.IsSuccess)
            return controller.Ok(result.Value);

        return result.ErrorCode switch
        {
            "NOT_FOUND" => controller.NotFoundError(result.Error ?? "Resource not found"),
            "UNAUTHORIZED" => controller.UnauthorizedError(result.Error ?? "Unauthorized access"),
            "FORBIDDEN" => controller.ForbiddenError(result.Error ?? "Access forbidden"),
            "VALIDATION_FAILED" => controller.BadRequestError(result.Error ?? "Validation failed"),
            _ => controller.BadRequestError(result.Error ?? "Request failed")
        };
    }

    /// <summary>
    /// Handle Result pattern without return value
    /// </summary>
    public static IActionResult HandleResult(this ControllerBase controller, Result result)
    {
        if (result.IsSuccess)
            return controller.Ok();

        return result.ErrorCode switch
        {
            "NOT_FOUND" => controller.NotFoundError(result.Error ?? "Resource not found"),
            "UNAUTHORIZED" => controller.UnauthorizedError(result.Error ?? "Unauthorized access"),
            "FORBIDDEN" => controller.ForbiddenError(result.Error ?? "Access forbidden"),
            "VALIDATION_FAILED" => controller.BadRequestError(result.Error ?? "Validation failed"),
            _ => controller.BadRequestError(result.Error ?? "Request failed")
        };
    }
}
