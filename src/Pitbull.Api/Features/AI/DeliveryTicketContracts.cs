namespace Pitbull.Api.Features.AI;

/// <summary>
/// Extracted data from a delivery ticket photo via OCR.
/// </summary>
public record DeliveryTicketExtractionResult
{
    public string? PoNumber { get; init; }
    public decimal PoNumberConfidence { get; init; }
    public string? VendorName { get; init; }
    public decimal VendorNameConfidence { get; init; }
    public string? TicketNumber { get; init; }
    public decimal TicketNumberConfidence { get; init; }
    public string? DeliveryDate { get; init; }
    public decimal DeliveryDateConfidence { get; init; }
    public List<DeliveryMaterialLineDto> Materials { get; init; } = [];
    public decimal OverallConfidence { get; init; }
    public PurchaseOrderMatchDto? MatchedPurchaseOrder { get; init; }
    public List<VendorMatchDto> VendorMatches { get; init; } = [];
    public List<string> Warnings { get; init; } = [];
}

public record DeliveryMaterialLineDto(
    string Description,
    decimal? Quantity,
    string? Unit,
    string? CostCode);

/// <summary>
/// Response from the delivery ticket OCR endpoint, wrapping extraction results and document reference.
/// </summary>
public record DeliveryTicketOcrResponse(
    DeliveryTicketExtractionResult Extraction,
    Guid DocumentId);

/// <summary>
/// Request body for creating a delivery record on a daily report.
/// </summary>
public sealed class CreateDeliveryRequest
{
    public string VendorName { get; init; } = string.Empty;
    public string MaterialDescription { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public string? Unit { get; init; }
    public Guid? RelatedCostCodeId { get; init; }
}
