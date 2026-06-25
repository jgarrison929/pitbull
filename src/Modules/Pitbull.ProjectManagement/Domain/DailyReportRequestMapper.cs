using System.Text.Json;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Explicit field mapping for daily report create/update — avoids silent ApplyUpsert failures.
/// </summary>
public static class DailyReportRequestMapper
{
    public static void MapCreate(PmDailyReport entity, PmUpsertRequest request, Guid defaultPreparedByUserId)
    {
        if (request.Data is null)
        {
            if (entity.ReportDate == default)
                entity.ReportDate = DateTime.UtcNow.Date;
            if (entity.PreparedByUserId == Guid.Empty && defaultPreparedByUserId != Guid.Empty)
                entity.PreparedByUserId = defaultPreparedByUserId;
            return;
        }

        if (TryGetDateTime(request.Data, "ReportDate", out var reportDate))
            entity.ReportDate = NormalizeUtc(reportDate);
        else if (entity.ReportDate == default)
            entity.ReportDate = DateTime.UtcNow.Date;

        if (TryGetEnum(request.Data, "ReportType", out DailyReportType reportType))
            entity.ReportType = reportType;

        if (TryGetString(request.Data, "WeatherSummary", out var weather))
            entity.WeatherSummary = weather;

        if (TryGetDecimal(request.Data, "TemperatureLow", out var tempLow))
            entity.TemperatureLow = tempLow;

        if (TryGetDecimal(request.Data, "TemperatureHigh", out var tempHigh))
            entity.TemperatureHigh = tempHigh;

        if (TryGetString(request.Data, "Precipitation", out var precip))
            entity.Precipitation = precip;

        if (TryGetString(request.Data, "Wind", out var wind))
            entity.Wind = wind;

        if (TryGetString(request.Data, "WorkNarrative", out var work))
            entity.WorkNarrative = work;

        if (TryGetGuid(request.Data, "PreparedByUserId", out var preparedBy))
            entity.PreparedByUserId = preparedBy;
        else if (entity.PreparedByUserId == Guid.Empty && defaultPreparedByUserId != Guid.Empty)
            entity.PreparedByUserId = defaultPreparedByUserId;
    }

    public static bool TryGetDuplicateKey(
        PmUpsertRequest request,
        out DateTime reportDateUtc,
        out DailyReportType reportType)
    {
        reportDateUtc = default;
        reportType = default;

        if (request.Data is null)
            return false;

        if (!TryGetDateTime(request.Data, "ReportDate", out var reportDate))
            return false;

        if (!TryGetEnum(request.Data, "ReportType", out reportType))
            return false;

        reportDateUtc = NormalizeUtc(reportDate).Date;
        reportDateUtc = DateTime.SpecifyKind(reportDateUtc, DateTimeKind.Utc);
        return true;
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();

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

    private static bool TryGetDecimal(IReadOnlyDictionary<string, object?> data, string key, out decimal value)
    {
        value = default;
        if (!data.TryGetValue(key, out var raw) || raw is null)
            return false;

        if (raw is decimal d)
        {
            value = d;
            return true;
        }

        if (raw is JsonElement je && je.ValueKind == JsonValueKind.Number)
        {
            value = je.GetDecimal();
            return true;
        }

        return decimal.TryParse(raw.ToString(), out value);
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