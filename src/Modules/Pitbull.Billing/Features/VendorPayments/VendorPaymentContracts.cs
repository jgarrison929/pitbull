using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.VendorPayments;

public record VendorPaymentDto(
    Guid Id,
    string PaymentNumber,
    Guid VendorId,
    string? VendorName,
    DateOnly PaymentDate,
    decimal TotalAmount,
    PaymentMethod PaymentMethod,
    string PaymentMethodName,
    string? ReferenceNumber,
    Guid? BankAccountId,
    string? BankAccountName,
    VendorPaymentStatus Status,
    string StatusName,
    string? Memo,
    Guid? JournalEntryId,
    IReadOnlyList<VendorPaymentApplicationDto> Applications,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record VendorPaymentApplicationDto(
    Guid Id,
    Guid VendorInvoiceId,
    string InvoiceNumber,
    decimal InvoiceTotalAmount,
    decimal AppliedAmount
);

public record CreateVendorPaymentCommand(
    Guid VendorId,
    DateOnly PaymentDate,
    PaymentMethod PaymentMethod,
    string? ReferenceNumber = null,
    Guid? BankAccountId = null,
    string? Memo = null,
    List<PaymentApplicationLineCommand>? Applications = null
) : ICommand<VendorPaymentDto>;

public record PaymentApplicationLineCommand(
    Guid VendorInvoiceId,
    decimal AppliedAmount
);

public record UpdateVendorPaymentCommand(
    Guid VendorPaymentId,
    DateOnly? PaymentDate = null,
    PaymentMethod? PaymentMethod = null,
    string? ReferenceNumber = null,
    Guid? BankAccountId = null,
    bool ClearBankAccountId = false,
    string? Memo = null,
    List<PaymentApplicationLineCommand>? Applications = null
) : ICommand<VendorPaymentDto>;

public record ApproveVendorPaymentCommand(
    Guid VendorPaymentId
) : ICommand<VendorPaymentDto>;

public record PostVendorPaymentCommand(
    Guid VendorPaymentId,
    Guid PostedByUserId,
    Guid ApAccountId,
    Guid CashAccountId
) : ICommand<VendorPaymentDto>;

public record VoidVendorPaymentCommand(
    Guid VendorPaymentId,
    string? Reason = null
) : ICommand<VendorPaymentDto>;

public record ListVendorPaymentsQuery(
    VendorPaymentStatus? Status = null,
    Guid? VendorId = null,
    PaymentMethod? PaymentMethod = null,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListVendorPaymentsResult>;

public record ListVendorPaymentsResult(
    IReadOnlyList<VendorPaymentDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
