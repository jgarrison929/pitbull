using System.Text.Json;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Explicit field mapping for submittal create/update — avoids generic ApplyUpsert status bypass.
/// </summary>
public static class SubmittalRequestMapper
{
    public static void MapCreate(PmSubmittal entity, PmUpsertRequest request, int submittalNumber)
    {
        entity.SubmittalNumber = submittalNumber;
        entity.Status = SubmittalStatus.Draft;
        MapFields(entity, request);
    }

    public static void MapFields(PmSubmittal entity, PmUpsertRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Title))
            entity.Title = request.Title;

        if (!string.IsNullOrWhiteSpace(request.Description))
            entity.Description = request.Description;

        if (request.Data is null)
            return;

        if (TryGetString(request.Data, "SpecSectionCode", out var specCode))
            entity.SpecSectionCode = specCode;

        if (TryGetString(request.Data, "SpecSectionTitle", out var specTitle))
            entity.SpecSectionTitle = specTitle;

        if (TryGetEnum(request.Data, "SubmittalType", out SubmittalType submittalType))
            entity.SubmittalType = submittalType;

        if (TryGetDateTime(request.Data, "RequiredByDate", out var requiredBy))
            entity.RequiredByDate = requiredBy;

        if (TryGetDateTime(request.Data, "FinalDueDate", out var finalDue))
            entity.FinalDueDate = finalDue;

        if (TryGetGuid(request.Data, "ScheduleActivityId", out var activityId))
            entity.ScheduleActivityId = activityId;

        if (TryGetBool(request.Data, "IsSubstitutionRequest", out var isSubstitution))
            entity.IsSubstitutionRequest = isSubstitution;
    }

    public static bool TryResolveStatusChange(
        PmUpsertRequest request,
        SubmittalStatus current,
        out SubmittalStatus newStatus)
    {
        newStatus = current;

        if (!string.IsNullOrWhiteSpace(request.Status)
            && Enum.TryParse<SubmittalStatus>(request.Status, true, out var fromProperty)
            && fromProperty != current)
        {
            newStatus = fromProperty;
            return true;
        }

        if (request.Data is not null
            && TryGetEnum(request.Data, "Status", out SubmittalStatus fromData)
            && fromData != current)
        {
            newStatus = fromData;
            return true;
        }

        return false;
    }

    public static void ApplyStatusSideEffects(PmSubmittal entity, SubmittalStatus newStatus)
    {
        if (newStatus == SubmittalStatus.Submitted)
            entity.SubmittedDate = DateTime.UtcNow;
        else if (newStatus is SubmittalStatus.Approved or SubmittalStatus.ApprovedAsNoted
                 or SubmittalStatus.ReviseAndResubmit or SubmittalStatus.Rejected)
            entity.ReturnedDate = DateTime.UtcNow;

        if (newStatus == SubmittalStatus.ReviseAndResubmit)
        {
            entity.RevisionNumber += 1;
            entity.Status = SubmittalStatus.Draft;
            return;
        }

        entity.Status = newStatus;
    }

    private static bool TryGetString(IReadOnlyDictionary<string, object?> data, string key, out string? value)
    {
        value = null;
        if (!data.TryGetValue(key, out var raw) || raw is null)
            return false;
        value = raw switch
        {
            string s => s,
            JsonElement je when je.ValueKind == JsonValueKind.String => je.GetString(),
            _ => raw.ToString()
        };
        return !string.IsNullOrWhiteSpace(value);
    }

    private static bool TryGetGuid(IReadOnlyDictionary<string, object?> data, string key, out Guid value)
    {
        value = default;
        if (!data.TryGetValue(key, out var raw) || raw is null)
            return false;

        if (raw is Guid g)
        {
            value = g;
            return true;
        }

        if (raw is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.String && Guid.TryParse(je.GetString(), out value))
                return true;
            if (je.TryGetGuid(out value))
                return true;
        }

        return Guid.TryParse(raw.ToString(), out value);
    }

    private static bool TryGetDateTime(IReadOnlyDictionary<string, object?> data, string key, out DateTime value)
    {
        value = default;
        if (!data.TryGetValue(key, out var raw) || raw is null)
            return false;

        if (raw is DateTime dt)
        {
            value = dt;
            return true;
        }

        if (raw is JsonElement je && je.ValueKind != JsonValueKind.Null)
        {
            value = je.GetDateTime();
            return true;
        }

        return DateTime.TryParse(raw.ToString(), out value);
    }

    private static bool TryGetBool(IReadOnlyDictionary<string, object?> data, string key, out bool value)
    {
        value = default;
        if (!data.TryGetValue(key, out var raw) || raw is null)
            return false;

        if (raw is bool b)
        {
            value = b;
            return true;
        }

        if (raw is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.True || je.ValueKind == JsonValueKind.False)
            {
                value = je.GetBoolean();
                return true;
            }
        }

        return bool.TryParse(raw.ToString(), out value);
    }

    private static bool TryGetEnum<TEnum>(IReadOnlyDictionary<string, object?> data, string key, out TEnum value)
        where TEnum : struct, Enum
    {
        value = default;
        if (!data.TryGetValue(key, out var raw) || raw is null)
            return false;

        if (raw is TEnum e)
        {
            value = e;
            return true;
        }

        if (raw is JsonElement je && je.ValueKind == JsonValueKind.String)
            return Enum.TryParse(je.GetString(), true, out value);

        return Enum.TryParse(raw.ToString(), true, out value);
    }
}