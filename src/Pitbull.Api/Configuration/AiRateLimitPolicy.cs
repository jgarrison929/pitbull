using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;

namespace Pitbull.Api.Configuration;

/// <summary>
/// AI fixed-window limits (2.20.7). Demo users get a tighter permit ceiling.
/// </summary>
public static class AiRateLimitPolicy
{
    public const int ChatPermitLimit = 20;
    public const int ChatDemoPermitLimit = 8;
    public const int SuggestPermitLimit = 30;
    public const int SuggestDemoPermitLimit = 10;
    public const int DocumentPermitLimit = 10;
    public const int DocumentDemoPermitLimit = 4;

    public static bool IsDemoUser(HttpContext context) =>
        string.Equals(
            context.User.FindFirst("is_demo_user")?.Value,
            "true",
            StringComparison.OrdinalIgnoreCase);

    public static string PartitionKey(HttpContext context) =>
        context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? context.User.FindFirst("sub")?.Value
        ?? context.Connection.RemoteIpAddress?.ToString()
        ?? "anonymous";

    public static int PermitLimit(string policy, bool isDemo) =>
        policy switch
        {
            "ai-chat" => isDemo ? ChatDemoPermitLimit : ChatPermitLimit,
            "ai-suggest" => isDemo ? SuggestDemoPermitLimit : SuggestPermitLimit,
            "ai-document" => isDemo ? DocumentDemoPermitLimit : DocumentPermitLimit,
            "ai-invoice" => isDemo ? DocumentDemoPermitLimit : DocumentPermitLimit,
            _ => isDemo ? 5 : 20,
        };

    public static FixedWindowRateLimiterOptions WindowOptions(int permitLimit) =>
        new()
        {
            PermitLimit = permitLimit,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        };
}
