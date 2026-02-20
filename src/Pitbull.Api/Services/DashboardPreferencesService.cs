using System.Collections.Concurrent;

namespace Pitbull.Api.Services;

public interface IDashboardPreferencesService
{
    Task<DashboardPreferenceDto> GetLayoutAsync(string userId, CancellationToken ct = default);
    Task SetLayoutAsync(string userId, string layout, CancellationToken ct = default);
}

public record DashboardPreferenceDto(string Layout);

public record SetDashboardPreferenceRequest(string Layout);

public class DashboardPreferencesService : IDashboardPreferencesService
{
    private static readonly string[] ValidLayouts = ["default", "pm", "controller", "field", "executive"];
    private static readonly ConcurrentDictionary<string, string> Store = new();

    public Task<DashboardPreferenceDto> GetLayoutAsync(string userId, CancellationToken ct = default)
    {
        var layout = Store.GetValueOrDefault(userId, "default");
        return Task.FromResult(new DashboardPreferenceDto(layout));
    }

    public Task SetLayoutAsync(string userId, string layout, CancellationToken ct = default)
    {
        if (!ValidLayouts.Contains(layout))
            throw new ArgumentException($"Invalid layout: {layout}. Valid layouts: {string.Join(", ", ValidLayouts)}");

        Store.AddOrUpdate(userId, layout, (_, _) => layout);
        return Task.CompletedTask;
    }
}
