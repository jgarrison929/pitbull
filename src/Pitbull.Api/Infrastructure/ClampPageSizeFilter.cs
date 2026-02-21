using Microsoft.AspNetCore.Mvc.Filters;

namespace Pitbull.Api.Infrastructure;

/// <summary>
/// Globally clamps any 'pageSize' action parameter to [1, 100] to prevent
/// unbounded queries that could cause OOM or excessive DB load.
/// </summary>
public class ClampPageSizeFilter : IActionFilter
{
    private const int MaxPageSize = 100;

    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (context.ActionArguments.TryGetValue("pageSize", out var value) && value is int pageSize)
        {
            context.ActionArguments["pageSize"] = Math.Clamp(pageSize, 1, MaxPageSize);
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
