using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Features.Vendors;

public record VendorDto(
    Guid Id,
    string Name,
    string Code,
    string? TaxId,
    string? ContactName,
    string? ContactEmail,
    string? Phone,
    string? Address,
    string? City,
    string? State,
    string? Zip,
    DateOnly? InsuranceExpDate,
    bool W9OnFile,
    string? MinorityWbeStatus,
    string? TradeClassification,
    string? PaymentTerms,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateVendorCommand(
    string Name,
    string Code,
    string? TaxId = null,
    string? ContactName = null,
    string? ContactEmail = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    DateOnly? InsuranceExpDate = null,
    bool W9OnFile = false,
    string? MinorityWbeStatus = null,
    string? TradeClassification = null,
    string? PaymentTerms = null,
    bool IsActive = true
) : ICommand<VendorDto>;

public record UpdateVendorCommand(
    Guid VendorId,
    string? Name = null,
    string? Code = null,
    string? TaxId = null,
    string? ContactName = null,
    string? ContactEmail = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    DateOnly? InsuranceExpDate = null,
    bool? W9OnFile = null,
    string? MinorityWbeStatus = null,
    string? TradeClassification = null,
    string? PaymentTerms = null,
    bool? IsActive = null
) : ICommand<VendorDto>;

public record ListVendorsQuery(
    string? SearchTerm = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListVendorsResult>;

public record ListVendorsResult(
    IReadOnlyList<VendorDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
