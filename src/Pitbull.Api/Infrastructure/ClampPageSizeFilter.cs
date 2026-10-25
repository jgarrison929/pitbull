using Microsoft.AspNetCore.Mvc.Filters;

namespace Pitbull.Api.Infrastructure;

/// <summary>
/// Globally clamps pagination action parameters to prevent unbounded queries
/// that could cause OOM or excessive DB load.
/// </summary>
public class ClampPageSizeFilter : IActionFilter
{
    private const int MaxPageSize = 100;
    private const int MaxPage = 10_000;

    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (context.ActionArguments.TryGetValue("pageSize", out var sizeVal) && sizeVal is int pageSize)
            context.ActionArguments["pageSize"] = Math.Clamp(pageSize, 1, MaxPageSize);

        // page=0 or negative is invalid; very large page * size is wasteful even when empty.
        if (context.ActionArguments.TryGetValue("page", out var pageVal) && pageVal is int page)
            context.ActionArguments["page"] = Math.Clamp(page, 1, MaxPage);
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
