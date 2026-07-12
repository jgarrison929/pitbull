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
