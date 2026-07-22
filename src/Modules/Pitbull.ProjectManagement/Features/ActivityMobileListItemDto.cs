using System.Text.Json;

namespace Pitbull.ProjectManagement.Features;

/// <summary>
/// Slim schedule activity row for phone lists
/// (GET …/schedules/{id}/activities?view=mobile).
/// Band 3.7 contract: id, name, status, start, finish, isCritical?, totalFloat?.
/// No SPI/CPI, no invented health scores.
/// </summary>
public record ActivityMobileListItemDto(
    Guid Id,
    string Name,
    string Status,
    DateTime? Start,
    DateTime? Finish,
    bool? IsCritical,
    double? TotalFloatDays,
    double? FreeFloatDays = null,
    int? PercentComplete = null
);

/// <summary>Maps full PM entity activity bags to the mobile list contract.</summary>
public static class ActivityListViewMapper
{
    public static ActivityMobileListItemDto ToMobileListItem(PmEntityDto dto)
    {
        var name = dto.Name ?? dto.Title ?? string.Empty;
        var status = dto.Status ?? string.Empty;
        var start = ReadDate(dto.Data, "PlannedStart") ?? ReadDate(dto.Data, "ActualStart");
        var finish = ReadDate(dto.Data, "PlannedFinish") ?? ReadDate(dto.Data, "ActualFinish");
        var isCritical = ReadBool(dto.Data, "IsCritical");
        var totalFloat = ReadDouble(dto.Data, "TotalFloatDays");
        var freeFloat = ReadDouble(dto.Data, "FreeFloatDays");
        var pct = ReadInt(dto.Data, "PercentComplete");

        return new ActivityMobileListItemDto(
            dto.Id,
            name,
            status,
            start,
            finish,
            isCritical,
            totalFloat,
            freeFloat,
            pct
        );
    }

    private static bool? ReadBool(object? data, string key)
    {
        if (data is null) return null;
        if (data is IReadOnlyDictionary<string, object?> dict)
        {
            if (!dict.TryGetValue(key, out var v) || v is null) return null;
            return v switch
            {
                bool b => b,
                JsonElement je when je.ValueKind is JsonValueKind.True => true,
                JsonElement je when je.ValueKind is JsonValueKind.False => false,
                string s when bool.TryParse(s, out var p) => p,
                _ => null
            };
        }

        if (data is Dictionary<string, object?> d2)
            return ReadBool((IReadOnlyDictionary<string, object?>)d2, key);

        return null;
    }

    private static double? ReadDouble(object? data, string key)
    {
        if (data is null) return null;
        if (data is IReadOnlyDictionary<string, object?> dict)
        {
            if (!dict.TryGetValue(key, out var v) || v is null) return null;
            return v switch
            {
                double d => d,
                float f => f,
                int i => i,
                long l => l,
                decimal m => (double)m,
                JsonElement je when je.ValueKind == JsonValueKind.Number && je.TryGetDouble(out var n) => n,
                string s when double.TryParse(s, out var p) => p,
                _ => null
            };
        }

        if (data is Dictionary<string, object?> d2)
            return ReadDouble((IReadOnlyDictionary<string, object?>)d2, key);

        return null;
    }

    private static int? ReadInt(object? data, string key)
    {
        if (data is null) return null;
        if (data is IReadOnlyDictionary<string, object?> dict)
        {
            if (!dict.TryGetValue(key, out var v) || v is null) return null;
            return v switch
            {
                int i => i,
                long l => (int)l,
                double d => (int)d,
                JsonElement je when je.ValueKind == JsonValueKind.Number && je.TryGetInt32(out var n) => n,
                string s when int.TryParse(s, out var p) => p,
                _ => null
            };
        }

        if (data is Dictionary<string, object?> d2)
            return ReadInt((IReadOnlyDictionary<string, object?>)d2, key);

        return null;
    }

    private static DateTime? ReadDate(object? data, string key)
    {
        if (data is null) return null;
        if (data is IReadOnlyDictionary<string, object?> dict)
        {
            if (!dict.TryGetValue(key, out var v) || v is null) return null;
            return v switch
            {
                DateTime dt => dt,
                DateTimeOffset dto => dto.UtcDateTime,
                DateOnly d => d.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                JsonElement je when je.ValueKind == JsonValueKind.String &&
                                    DateTime.TryParse(je.GetString(), out var p) => p,
                string s when DateTime.TryParse(s, out var p2) => p2,
                _ => null
            };
        }

        if (data is Dictionary<string, object?> d2)
            return ReadDate((IReadOnlyDictionary<string, object?>)d2, key);

        return null;
    }
}
