namespace Pitbull.Api.Features.AI;

public record InvoiceExtractionResult
{
    public string? VendorName { get; init; }
    public decimal VendorNameConfidence { get; init; }
    public string? InvoiceNumber { get; init; }
    public decimal InvoiceNumberConfidence { get; init; }
    public string? InvoiceDate { get; init; }
    public decimal InvoiceDateConfidence { get; init; }
    public string? DueDate { get; init; }
    public decimal DueDateConfidence { get; init; }
    public string? PoNumber { get; init; }
    public decimal PoNumberConfidence { get; init; }
    public List<InvoiceLineItemDto> LineItems { get; init; } = [];
    public decimal? Subtotal { get; init; }
    public decimal? Tax { get; init; }
    public decimal? Total { get; init; }
    public decimal TotalConfidence { get; init; }
    public decimal OverallConfidence { get; init; }
    public List<VendorMatchDto> VendorMatches { get; init; } = [];
    public PurchaseOrderMatchDto? MatchedPurchaseOrder { get; init; }
    public List<string> Warnings { get; init; } = [];
}

public record InvoiceLineItemDto(
    string Description,
    decimal? Quantity,
    decimal? UnitPrice,
    decimal? Amount,
    string? CostCode);

public record VendorMatchDto(
    Guid Id,
    string Name,
    string Code,
    decimal Confidence);

public record PurchaseOrderMatchDto(
    Guid Id,
    string PoNumber,
    string? Description,
    decimal TotalAmount,
    string Status,
    Guid ProjectId,
    string? ProjectName);
