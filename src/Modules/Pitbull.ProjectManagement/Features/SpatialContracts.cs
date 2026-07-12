using Pitbull.ProjectManagement.Domain;

namespace Pitbull.ProjectManagement.Features;

public sealed record SpatialGraphResponse(
    bool HasGraph,
    string? Message,
    Guid? GraphId,
    Guid? ProjectId,
    string? GraphName,
    int? Version,
    string? Status,
    IReadOnlyList<SpatialNodeDto> Nodes);

public sealed record SpatialNodeDto(
    Guid Id,
    Guid? ParentNodeId,
    string NodeType,
    string Code,
    string Name,
    int SortOrder,
    int? LevelIndex,
    bool IsActive,
    decimal? CentroidX,
    decimal? CentroidY,
    decimal? CentroidZ);

public sealed record SpatialOverlayResponse(
    bool HasGraph,
    string? Message,
    string Mode,
    string AsOf,
    string TruthNote,
    IReadOnlyList<SpatialOverlayNodeDto> Nodes);

public sealed record SpatialOverlayNodeDto(
    Guid SpatialNodeId,
    string Band,
    string Label,
    string Source,
    bool IsProxy,
    string? Formula,
    string? InsufficientReason);

public sealed record SpatialZoneOptionDto(
    Guid Id,
    string Code,
    string Name,
    string PathLabel);

/// <summary>Zone drill panel: linked operational artifacts or honest empty lists.</summary>
public sealed record SpatialZoneDetailResponse(
    Guid SpatialNodeId,
    string Code,
    string Name,
    string NodeType,
    string PathLabel,
    string Message,
    IReadOnlyList<SpatialLinkedItemDto> OpenRfis,
    IReadOnlyList<SpatialLinkedItemDto> DailyReports,
    IReadOnlyList<SpatialLinkedItemDto> ProgressEntries,
    IReadOnlyList<SpatialLinkedItemDto> ScheduleActivities,
    IReadOnlyList<SpatialLinkedItemDto> PlanSheets);

public sealed record SpatialLinkedItemDto(
    Guid Id,
    string Kind,
    string Title,
    string? Status,
    DateTime? Date,
    string? Detail);

/// <summary>
/// Photo pin for twin zone panel (2.15.3 stub). Never invent green pins —
/// empty Pins means no GPS/zone-linked photos yet.
/// </summary>
public sealed record TwinPhotoPinDto(
    Guid PhotoId,
    Guid? SpatialNodeId,
    double? Latitude,
    double? Longitude,
    string? ThumbnailUrl,
    DateTime? CapturedAt,
    string PlacementSource // "gps" | "zone" | "unknown"
);

/// <summary>Aggregate photo pins for a project (or one zone). Honest empty list.</summary>
public sealed record TwinPhotoPinsResponse(
    Guid ProjectId,
    Guid? SpatialNodeId,
    string Message,
    IReadOnlyList<TwinPhotoPinDto> Pins
);

/// <summary>Pure aggregation helpers for photo pins (unit-tested; no fake green).</summary>
public static class TwinPhotoPinAggregation
{
    /// <summary>
    /// Build pins only from real photo records with optional GPS/zone.
    /// Missing GPS does not invent coordinates.
    /// </summary>
    public static IReadOnlyList<TwinPhotoPinDto> Aggregate(
        IEnumerable<(
            Guid PhotoId,
            Guid? SpatialNodeId,
            double? Latitude,
            double? Longitude,
            string? ThumbnailUrl,
            DateTime? CapturedAt
        )> photos,
        Guid? filterZoneId = null)
    {
        var list = new List<TwinPhotoPinDto>();
        foreach (var p in photos)
        {
            if (filterZoneId is Guid z && p.SpatialNodeId != z)
                continue;

            var hasGps = p.Latitude is not null && p.Longitude is not null;
            var hasZone = p.SpatialNodeId is not null;
            if (!hasGps && !hasZone)
                continue; // cannot place pin honestly

            var source = hasGps ? "gps" : hasZone ? "zone" : "unknown";
            list.Add(new TwinPhotoPinDto(
                p.PhotoId,
                p.SpatialNodeId,
                hasGps ? p.Latitude : null,
                hasGps ? p.Longitude : null,
                p.ThumbnailUrl,
                p.CapturedAt,
                source));
        }

        return list;
    }

    public static TwinPhotoPinsResponse Empty(Guid projectId, Guid? zoneId = null) =>
        new(
            projectId,
            zoneId,
            "No photo pins yet — pins appear when field photos have GPS or a zone link. Empty is not all-clear.",
            Array.Empty<TwinPhotoPinDto>());
}

// ── Model assets (2.16.3+) ───────────────────────────────────────────────────

/// <summary>Model asset DTO. Ready=true only when ConversionStatus is Succeeded.</summary>
public sealed record ModelAssetDto(
    Guid Id,
    Guid ProjectId,
    string DisplayName,
    string SourceFormat,
    string ConversionStatus,
    string? ConversionError,
    string? SourceBlobKey,
    string? RuntimeBlobKey,
    string? LicenseAttribution,
    bool IsActiveVersion,
    int VersionNumber,
    bool IsReady
);

public sealed record ModelAssetListResponse(
    Guid ProjectId,
    string Message,
    IReadOnlyList<ModelAssetDto> Assets
);

public sealed record RegisterModelAssetRequest(
    string? DisplayName,
    string SourceFormat,
    string? SourceBlobKey,
    string? LicenseAttribution
);

/// <summary>Pure helpers for model asset status truth (never ready while processing).</summary>
public static class ModelAssetStatus
{
    public static bool IsReady(string conversionStatus) =>
        string.Equals(conversionStatus, nameof(ModelConversionStatus.Succeeded), StringComparison.OrdinalIgnoreCase)
        || string.Equals(conversionStatus, "Succeeded", StringComparison.OrdinalIgnoreCase);

    public static ModelAssetDto ToDto(ModelAsset entity) =>
        new(
            entity.Id,
            entity.ProjectId,
            entity.DisplayName,
            entity.SourceFormat.ToString(),
            entity.ConversionStatus.ToString(),
            entity.ConversionError,
            entity.SourceBlobKey,
            entity.RuntimeBlobKey,
            entity.LicenseAttribution,
            entity.IsActiveVersion,
            entity.VersionNumber,
            IsReady(entity.ConversionStatus.ToString()));

    public static ModelAssetListResponse EmptyList(Guid projectId) =>
        new(
            projectId,
            "No model assets yet — zones-first twin works without a 3D model. Empty is not a failure.",
            Array.Empty<ModelAssetDto>());
}
