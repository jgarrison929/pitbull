using System.Text.Json;
using Pitbull.ProjectManagement.Domain;

namespace Pitbull.ProjectManagement.Features;

/// <summary>
/// Slim submittal row for phone lists (GET …/submittals?view=mobile).
/// Band 3.5 contract: id, number, title, status, projectId, optional dueDate/updatedAt.
/// No register-complete %, health scores, or heavy description/workflow bags.
/// </summary>
public record SubmittalMobileListItemDto(
    Guid Id,
    int Number,
    string Title,
    string Status,
    Guid ProjectId,
    DateTime? DueDate,
    DateTime? UpdatedAt,
    /// <summary>SubmittalType enum string (optional glance field for phone list 3.4.6+).</summary>
    string? Type = null
);

/// <summary>Maps full PM entity / domain submittal to the mobile list contract.</summary>
public static class SubmittalListViewMapper
{
    public static SubmittalMobileListItemDto ToMobileListItem(PmSubmittal entity) =>
        new(
            entity.Id,
            entity.SubmittalNumber,
            entity.Title,
            entity.Status.ToString(),
            entity.ProjectId,
            DueDate: entity.RequiredByDate ?? entity.FinalDueDate,
            UpdatedAt: entity.UpdatedAt ?? entity.CreatedAt,
            Type: entity.SubmittalType.ToString()
        );

    public static SubmittalMobileListItemDto ToMobileListItem(PmEntityDto dto)
    {
        var projectId = dto.ProjectId ?? Guid.Empty;
        var number = ReadInt(dto.Data, "SubmittalNumber") ?? 0;
        var due = ReadDate(dto.Data, "RequiredByDate")
                  ?? ReadDate(dto.Data, "FinalDueDate");
        var status = dto.Status ?? string.Empty;
        var title = dto.Title ?? dto.Name ?? string.Empty;
        var type = ReadString(dto.Data, "SubmittalType");

        return new SubmittalMobileListItemDto(
            dto.Id,
            number,
            title,
            status,
            projectId,
            due,
            UpdatedAt: dto.UpdatedAt ?? dto.CreatedAt,
            Type: type
        );
    }

    private static string? ReadString(object? data, string key)
    {
        if (data is IReadOnlyDictionary<string, object?> dict)
        {
            if (!dict.TryGetValue(key, out var v) || v is null) return null;
            return v.ToString();
        }
        if (data is Dictionary<string, object?> d2)
            return ReadString((IReadOnlyDictionary<string, object?>)d2, key);
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
