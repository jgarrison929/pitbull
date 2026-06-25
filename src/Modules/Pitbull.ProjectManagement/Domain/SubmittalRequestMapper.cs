using System.Text.Json;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Submittal status workflow — scalar fields use <see cref="PmUpsertFieldMapper"/>.
/// </summary>
public static class SubmittalRequestMapper
{
    public static void MapCreate(PmSubmittal entity, PmUpsertRequest request, int submittalNumber)
    {
        entity.SubmittalNumber = submittalNumber;
        entity.Status = SubmittalStatus.Draft;
        PmUpsertFieldMapper.MapNonStatusScalars(entity, request);
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