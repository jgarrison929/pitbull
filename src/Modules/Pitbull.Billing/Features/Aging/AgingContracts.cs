namespace Pitbull.Billing.Features.Aging;

// ── Aging bucket breakdown (shared between AP and AR) ──

public record AgingBuckets(
    decimal Current,
    decimal Days1To30,
    decimal Days31To60,
    decimal Days61To90,
    decimal Days90Plus,
    decimal Total
);

// ── Vendor (AP) Aging ──

public record VendorAgingLineItem(
    Guid VendorId,
    string VendorName,
    string VendorCode,
    int InvoiceCount,
    decimal Current,
    decimal Days1To30,
    decimal Days31To60,
    decimal Days61To90,
    decimal Days90Plus,
    decimal Total
);

public record VendorAgingResult(
    AgingBuckets Summary,
    IReadOnlyList<VendorAgingLineItem> Vendors,
    DateOnly AsOfDate
);

// ── Customer (AR) Aging ──

public record CustomerAgingLineItem(
    Guid ProjectId,
    string ProjectName,
    string ProjectNumber,
    int ApplicationCount,
    decimal Current,
    decimal Days1To30,
    decimal Days31To60,
    decimal Days61To90,
    decimal Days90Plus,
    decimal Total
);

public record CustomerAgingResult(
    AgingBuckets Summary,
    IReadOnlyList<CustomerAgingLineItem> Projects,
    DateOnly AsOfDate
);

// ── Combined Summary ──

public record AgingSummaryResult(
    AgingBuckets AccountsPayable,
    AgingBuckets AccountsReceivable,
    decimal NetPosition,
    DateOnly AsOfDate
);
