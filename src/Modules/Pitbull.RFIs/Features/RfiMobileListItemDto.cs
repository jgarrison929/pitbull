using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features;

/// <summary>
/// Slim RFI row for phone lists (GET …/rfis?view=mobile).
/// Band 3.5 contract: id, number, subject, status, projectId, optional dueDate/updatedAt.
/// Omits question/answer bodies, drawings, cost impact, and any health/KPI fields.
/// </summary>
public record RfiMobileListItemDto(
    Guid Id,
    int Number,
    string Subject,
    RfiStatus Status,
    Guid ProjectId,
    DateTime? DueDate,
    DateTime? UpdatedAt
);

/// <summary>Maps full RFI DTOs to the mobile list contract (no KPI fields).</summary>
public static class RfiListViewMapper
{
    public static RfiMobileListItemDto ToMobileListItem(RfiDto dto) =>
        new(
            dto.Id,
            dto.Number,
            dto.Subject,
            dto.Status,
            dto.ProjectId,
            dto.DueDate,
            // Recency for sort/glance: prefer UpdatedAt when present; CreatedAt is always set on DTO
            UpdatedAt: dto.CreatedAt
        );

    public static RfiMobileListItemDto ToMobileListItem(Domain.Rfi rfi) =>
        new(
            rfi.Id,
            rfi.Number,
            rfi.Subject,
            rfi.Status,
            rfi.ProjectId,
            rfi.DueDate,
            UpdatedAt: rfi.UpdatedAt ?? rfi.CreatedAt
        );
}
