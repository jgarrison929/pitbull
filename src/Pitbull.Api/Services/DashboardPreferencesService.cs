using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Services;

public interface IDashboardPreferencesService
{
    Task<DashboardPreferenceDto> GetPreferencesAsync(Guid userId, CancellationToken ct = default);
    Task<DashboardPreferenceDto> SavePreferencesAsync(Guid userId, string layout, CancellationToken ct = default);
    Task<DashboardPreferenceDto> SaveWidgetConfigurationAsync(Guid userId, List<WidgetDto> widgets, CancellationToken ct = default);
    Task<DashboardPreferenceDto> ResetToDefaultAsync(Guid userId, CancellationToken ct = default);
    DashboardTemplateDto GetTemplate(string role);
}

public record DashboardPreferenceDto(string Layout, List<WidgetDto>? Widgets);

public record WidgetDto(
    string Id,
    string Type,
    int Row,
    int Col,
    int Width,
    int Height,
    bool Visible,
    Dictionary<string, object>? Config = null);

public record DashboardTemplateDto(string Role, string Layout, List<WidgetDto> Widgets);

public record SetDashboardPreferenceRequest(string Layout);

public record SetWidgetConfigurationRequest(List<WidgetDto> Widgets);

public class DashboardPreferencesService(PitbullDbContext db, UserManager<AppUser> userManager) : IDashboardPreferencesService
{
    private static readonly string[] ValidLayouts = ["default", "pm", "controller", "field", "executive", "estimator", "contracts"];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private static readonly Dictionary<string, DashboardTemplateDto> Templates = new()
    {
        ["default"] = new DashboardTemplateDto("default", "default",
        [
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "recent-activity", 1, 0, 2, 2, true),
            new("w3", "upcoming-deadlines", 1, 2, 2, 2, true),
            new("w4", "project-status", 3, 0, 4, 2, true)
        ]),
        ["pm"] = new DashboardTemplateDto("pm", "pm",
        [
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "upcoming-deadlines", 1, 0, 2, 2, true),
            new("w3", "project-status", 1, 2, 2, 2, true),
            new("w4", "recent-activity", 3, 0, 2, 2, true),
            new("w5", "time-entry-summary", 3, 2, 2, 2, true)
        ]),
        ["controller"] = new DashboardTemplateDto("controller", "controller",
        [
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "project-status", 1, 0, 4, 2, true),
            new("w3", "recent-activity", 3, 0, 2, 2, true),
            new("w4", "upcoming-deadlines", 3, 2, 2, 2, true)
        ]),
        ["field"] = new DashboardTemplateDto("field", "field",
        [
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "time-entry-summary", 1, 0, 4, 2, true),
            new("w3", "upcoming-deadlines", 3, 0, 2, 2, true),
            new("w4", "recent-activity", 3, 2, 2, 2, true)
        ]),
        ["executive"] = new DashboardTemplateDto("executive", "executive",
        [
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "project-status", 1, 0, 4, 2, true),
            new("w3", "upcoming-deadlines", 3, 0, 2, 2, true),
            new("w4", "recent-activity", 3, 2, 2, 2, true),
            new("w5", "time-entry-summary", 5, 0, 4, 2, true)
        ]),
        ["estimator"] = new DashboardTemplateDto("estimator", "estimator",
        [
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "upcoming-deadlines", 1, 0, 2, 2, true),
            new("w3", "recent-activity", 1, 2, 2, 2, true),
            new("w4", "project-status", 3, 0, 4, 2, true)
        ]),
        ["contracts"] = new DashboardTemplateDto("contracts", "contracts",
        [
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "upcoming-deadlines", 1, 0, 2, 2, true),
            new("w3", "recent-activity", 1, 2, 2, 2, true),
            new("w4", "project-status", 3, 0, 4, 2, true)
        ])
    };

    public async Task<DashboardPreferenceDto> GetPreferencesAsync(Guid userId, CancellationToken ct = default)
    {
        var pref = await db.DashboardPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (pref is null)
        {
            var layout = await DetectLayoutForUserAsync(userId);
            return new DashboardPreferenceDto(layout, Templates[layout].Widgets);
        }

        var widgets = DeserializeWidgets(pref.WidgetConfiguration);
        return new DashboardPreferenceDto(pref.Layout, widgets ?? Templates.GetValueOrDefault(pref.Layout)?.Widgets);
    }

    public async Task<DashboardPreferenceDto> SavePreferencesAsync(Guid userId, string layout, CancellationToken ct = default)
    {
        if (!ValidLayouts.Contains(layout))
            throw new ArgumentException($"Invalid layout: {layout}. Valid layouts: {string.Join(", ", ValidLayouts)}");

        var pref = await db.DashboardPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (pref is null)
        {
            pref = new DashboardPreference
            {
                UserId = userId,
                Layout = layout,
                WidgetConfiguration = SerializeWidgets(Templates.GetValueOrDefault(layout)?.Widgets)
            };
            db.DashboardPreferences.Add(pref);
        }
        else
        {
            pref.Layout = layout;
        }

        await db.SaveChangesAsync(ct);

        var widgets = DeserializeWidgets(pref.WidgetConfiguration);
        return new DashboardPreferenceDto(pref.Layout, widgets ?? Templates.GetValueOrDefault(pref.Layout)?.Widgets);
    }

    public async Task<DashboardPreferenceDto> SaveWidgetConfigurationAsync(Guid userId, List<WidgetDto> widgets, CancellationToken ct = default)
    {
        var pref = await db.DashboardPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        var widgetJson = SerializeWidgets(widgets);

        if (pref is null)
        {
            pref = new DashboardPreference
            {
                UserId = userId,
                Layout = "default",
                WidgetConfiguration = widgetJson
            };
            db.DashboardPreferences.Add(pref);
        }
        else
        {
            pref.WidgetConfiguration = widgetJson;
        }

        await db.SaveChangesAsync(ct);
        return new DashboardPreferenceDto(pref.Layout, widgets);
    }

    public async Task<DashboardPreferenceDto> ResetToDefaultAsync(Guid userId, CancellationToken ct = default)
    {
        var pref = await db.DashboardPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (pref is not null)
        {
            db.DashboardPreferences.Remove(pref);
            await db.SaveChangesAsync(ct);
        }

        // Re-detect persona layout (do not force generic "default")
        var layout = await DetectLayoutForUserAsync(userId);
        return new DashboardPreferenceDto(layout, Templates.GetValueOrDefault(layout)?.Widgets ?? Templates["default"].Widgets);
    }

    public DashboardTemplateDto GetTemplate(string role)
    {
        return Templates.GetValueOrDefault(role) ?? Templates["default"];
    }

    private async Task<string> DetectLayoutForUserAsync(Guid userId)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return "default";

        var roles = await userManager.GetRolesAsync(user);
        var profile = RoleProfileResolver.Detect(user.Title, roles);
        return RoleProfileResolver.ToDashboardLayout(profile);
    }

    private static string? SerializeWidgets(List<WidgetDto>? widgets)
    {
        if (widgets is null) return null;
        return JsonSerializer.Serialize(widgets, JsonOptions);
    }

    private static List<WidgetDto>? DeserializeWidgets(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<List<WidgetDto>>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }
}
