using Pitbull.Billing.Features.VendorInvoices;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IVendorInvoiceService
{
    Task<Result<ListVendorInvoicesResult>> GetVendorInvoicesAsync(ListVendorInvoicesQuery query, CancellationToken cancellationToken = default);
    Task<Result<VendorInvoiceDto>> GetVendorInvoiceAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<VendorInvoiceDto>> CreateVendorInvoiceAsync(CreateVendorInvoiceCommand command, CancellationToken cancellationToken = default);
    Task<Result<VendorInvoiceDto>> UpdateVendorInvoiceAsync(UpdateVendorInvoiceCommand command, CancellationToken cancellationToken = default);
    Task<Result<InvoiceMatchResultDto>> MatchVendorInvoiceAsync(MatchVendorInvoiceCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteVendorInvoiceAsync(Guid id, CancellationToken cancellationToken = default);
}
