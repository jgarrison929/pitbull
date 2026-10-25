namespace Pitbull.RFIs.Features;

/// <summary>
/// Full cost impact analysis for an RFI, including linked change orders and timeline.
/// </summary>
public record RfiCostImpactDto(
    Guid RfiId,
    int RfiNumber,
    string Subject,
    string Status,

    // Time metrics
    int DaysOpen,
    int? ResponseDelayDays,  // Days past due date when answered
    DateTime CreatedAt,
    DateTime? DueDate,
    DateTime? AnsweredAt,
    DateTime? ClosedAt,

    // Cost totals
    decimal DirectCost,      // Sum of linked change order amounts
    decimal DelayCost,       // Sum of linked change order delay costs
    decimal TotalCost,       // DirectCost + DelayCost

    // Linked entities
    List<LinkedChangeOrderDto> ChangeOrders,
    List<RfiTimelineEventDto> Timeline
);

/// <summary>
/// Summary of a change order linked to an RFI.
/// </summary>
public record LinkedChangeOrderDto(
    Guid Id,
    string ChangeOrderNumber,
    string Title,
    decimal Amount,
    int? DelayDays,
    decimal? DelayCost,
    string Status,
    DateTime? ApprovedDate
);

/// <summary>
/// Timeline event for RFI history.
/// </summary>
public record RfiTimelineEventDto(
    DateTime Date,
    string Event,
    string? Actor,
    string? Details
);
