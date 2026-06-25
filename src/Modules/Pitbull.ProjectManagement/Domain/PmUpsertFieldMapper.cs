using System.Text.Json;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Status-safe projection of <see cref="PmUpsertRequest"/> scalar fields onto PM entities.
/// Lifts the non-status half of <c>PmServiceBase.ApplyUpsert</c> for explicit pipelines.
/// </summary>
public static class PmUpsertFieldMapper
{
    private static readonly HashSet<string> ProtectedFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "Id", "TenantId", "CompanyId", "IsDeleted", "DeletedAt", "DeletedBy", "CreatedAt", "CreatedBy", "Status"
    };

    public static void MapNonStatusScalars(object entity, PmUpsertRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Name))
            SetIfExists(entity, "Name", request.Name);

        if (!string.IsNullOrWhiteSpace(request.Title))
            SetIfExists(entity, "Title", request.Title);

        if (!string.IsNullOrWhiteSpace(request.Description))
            SetIfExists(entity, "Description", request.Description);

        if (request.ReferenceId.HasValue)
        {
            foreach (var propName in new[]
                     {
                         "ReferenceId", "ScheduleId", "SubmittalId", "TaskId", "MeetingId", "CommunicationId",
                         "PlanSetId", "PlanSheetId", "SpecSectionId", "DailyReportId", "ProgressEntryId", "NarrativeId", "RfiId",
                         "PunchListItemId", "DocumentId"
                     })
            {
                if (entity.GetType().GetProperty(propName) != null)
                {
                    SetIfExists(entity, propName, request.ReferenceId.Value);
                    break;
                }
            }
        }

        if (request.DueDate.HasValue)
            SetIfExists(entity, "DueDate", request.DueDate.Value);

        if (request.Data is null)
            return;

        foreach (var kvp in request.Data)
        {
            if (ProtectedFields.Contains(kvp.Key))
                continue;

            var p = entity.GetType().GetProperty(kvp.Key);
            if (p == null || kvp.Value is null)
                continue;

            try
            {
                var converted = ConvertToPropertyType(kvp.Value, Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType);
                p.SetValue(entity, converted);
            }
            catch
            {
                // Ignore incompatible fields in generic projection.
            }
        }
    }

    private static void SetIfExists(object entity, string propertyName, object value)
    {
        var p = entity.GetType().GetProperty(propertyName);
        if (p == null || !p.CanWrite)
            return;
        p.SetValue(entity, value);
    }

    private static object ConvertToPropertyType(object value, Type targetType)
    {
        if (value is JsonElement jsonElement)
        {
            return targetType switch
            {
                _ when targetType == typeof(Guid) => jsonElement.GetGuid(),
                _ when targetType == typeof(Guid?) => jsonElement.ValueKind == JsonValueKind.Null ? null! : jsonElement.GetGuid(),
                _ when targetType == typeof(string) => jsonElement.GetString() ?? string.Empty,
                _ when targetType == typeof(int) => jsonElement.GetInt32(),
                _ when targetType == typeof(long) => jsonElement.GetInt64(),
                _ when targetType == typeof(decimal) => jsonElement.GetDecimal(),
                _ when targetType == typeof(double) => jsonElement.GetDouble(),
                _ when targetType == typeof(bool) => jsonElement.GetBoolean(),
                _ when targetType == typeof(DateTime) => NormalizeDateTimeUtc(jsonElement.GetDateTime()),
                _ when targetType.IsEnum => Enum.Parse(targetType, jsonElement.GetString() ?? string.Empty, true),
                _ => Convert.ChangeType(jsonElement.ToString(), targetType)
            };
        }

        if (targetType.IsEnum && value is string enumString)
            return Enum.Parse(targetType, enumString, true);

        if (targetType == typeof(DateTime) && value is DateTime dtVal)
            return NormalizeDateTimeUtc(dtVal);

        return Convert.ChangeType(value, targetType);
    }

    private static DateTime NormalizeDateTimeUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();
}