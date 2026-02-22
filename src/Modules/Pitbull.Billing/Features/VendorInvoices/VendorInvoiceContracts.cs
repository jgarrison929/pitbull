using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.VendorInvoices;

public record VendorInvoiceDto(
    Guid Id,
    Guid VendorId,
    string InvoiceNumber,
    DateOnly InvoiceDate,
    DateOnly DueDate,
    decimal TotalAmount,
    VendorInvoiceStatus Status,
    string StatusName,
    Guid? PurchaseOrderId,
    InvoiceMatchResultDto? LatestMatchResult,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record InvoiceMatchResultDto(
    Guid Id,
    Guid VendorInvoiceId,
    Guid? PurchaseOrderId,
    InvoiceMatchType MatchType,
    string MatchTypeName,
    decimal VarianceAmount,
    decimal VariancePercent,
    bool AutoApproved,
    DateTime MatchedAt
);

public record CreateVendorInvoiceCommand(
    Guid VendorId,
    string InvoiceNumber,
    DateOnly InvoiceDate,
    DateOnly DueDate,
    decimal TotalAmount,
    Guid? PurchaseOrderId = null,
    decimal? TaxAmount = null,
    decimal? TaxRate = null,
    Guid? TaxJurisdictionId = null,
    string CurrencyCode = "USD",
    decimal ExchangeRate = 1.0m,
    bool IsTaxExempt = false,
    string? TaxExemptReason = null
) : ICommand<VendorInvoiceDto>;

public record UpdateVendorInvoiceCommand(
    Guid VendorInvoiceId,
    Guid? VendorId = null,
    string? InvoiceNumber = null,
    DateOnly? InvoiceDate = null,
    DateOnly? DueDate = null,
    decimal? TotalAmount = null,
    VendorInvoiceStatus? Status = null,
    Guid? PurchaseOrderId = null,
    bool ClearPurchaseOrderId = false,
    decimal? TaxAmount = null,
    decimal? TaxRate = null,
    Guid? TaxJurisdictionId = null,
    bool ClearTaxJurisdiction = false,
    string? CurrencyCode = null,
    decimal? ExchangeRate = null,
    bool? IsTaxExempt = null,
    string? TaxExemptReason = null
) : ICommand<VendorInvoiceDto>;

public record MatchVendorInvoiceCommand(
    Guid VendorInvoiceId,
    decimal? TolerancePercent = null
) : ICommand<InvoiceMatchResultDto>;

public record ListVendorInvoicesQuery(
    VendorInvoiceStatus? Status = null,
    Guid? VendorId = null,
    Guid? PurchaseOrderId = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListVendorInvoicesResult>;

public record ListVendorInvoicesResult(
    IReadOnlyList<VendorInvoiceDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
