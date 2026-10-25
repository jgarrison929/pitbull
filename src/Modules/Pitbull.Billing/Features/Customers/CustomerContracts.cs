using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Features.Customers;

public record CustomerDto(
    Guid Id,
    string Name,
    string Code,
    string? ContactName,
    string? ContactEmail,
    string? Phone,
    string? Address,
    string? City,
    string? State,
    string? Zip,
    string? PaymentTerms,
    decimal? CreditLimit,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateCustomerCommand(
    string Name,
    string Code,
    string? ContactName = null,
    string? ContactEmail = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    string? PaymentTerms = null,
    decimal? CreditLimit = null,
    bool IsActive = true
) : ICommand<CustomerDto>;

public record UpdateCustomerCommand(
    Guid CustomerId,
    string? Name = null,
    string? Code = null,
    string? ContactName = null,
    string? ContactEmail = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    string? PaymentTerms = null,
    decimal? CreditLimit = null,
    bool? IsActive = null
) : ICommand<CustomerDto>;

public record ListCustomersQuery(
    string? SearchTerm = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListCustomersResult>;

public record ListCustomersResult(
    IReadOnlyList<CustomerDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
