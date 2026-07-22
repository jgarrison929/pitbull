using Pitbull.Contracts.Features.CreateSubcontract;

namespace Pitbull.Contracts.Features;

/// <summary>
/// Slim subcontract row for phone lists (GET /api/subcontracts?view=mobile).
/// Band 3.6 / 3.5.6: id, number, title (subcontractor), status, projectId, amount?,
/// billed/paid/retainage from server only — no invent when missing.
/// No portfolio commercial health scores; SOV line bags omitted.
/// </summary>
public record SubcontractMobileListItemDto(
    Guid Id,
    string Number,
    string Title,
    string Status,
    Guid ProjectId,
    decimal? Amount,
    decimal? BilledToDate = null,
    decimal? PaidToDate = null,
    decimal? RetainageHeld = null,
    string? TradeCode = null
);

/// <summary>Maps full subcontract DTOs to the mobile list contract.</summary>
public static class SubcontractListViewMapper
{
    public static SubcontractMobileListItemDto ToMobileListItem(SubcontractDto dto) =>
        new(
            dto.Id,
            Number: dto.SubcontractNumber,
            Title: dto.SubcontractorName,
            Status: dto.Status.ToString(),
            ProjectId: dto.ProjectId,
            Amount: dto.CurrentValue,
            BilledToDate: dto.BilledToDate,
            PaidToDate: dto.PaidToDate,
            RetainageHeld: dto.RetainageHeld,
            TradeCode: dto.TradeCode
        );
}
