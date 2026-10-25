using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Features.VendorPayments;

public interface IVendorPaymentService
{
    Task<Result<ListVendorPaymentsResult>> GetVendorPaymentsAsync(ListVendorPaymentsQuery query, CancellationToken cancellationToken = default);
    Task<Result<VendorPaymentDto>> GetVendorPaymentAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<VendorPaymentDto>> CreateVendorPaymentAsync(CreateVendorPaymentCommand command, CancellationToken cancellationToken = default);
    Task<Result<VendorPaymentDto>> UpdateVendorPaymentAsync(UpdateVendorPaymentCommand command, CancellationToken cancellationToken = default);
    Task<Result<VendorPaymentDto>> ApproveVendorPaymentAsync(ApproveVendorPaymentCommand command, CancellationToken cancellationToken = default);
    Task<Result<VendorPaymentDto>> PostVendorPaymentAsync(PostVendorPaymentCommand command, CancellationToken cancellationToken = default);
    Task<Result<VendorPaymentDto>> VoidVendorPaymentAsync(VoidVendorPaymentCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteVendorPaymentAsync(Guid id, CancellationToken cancellationToken = default);
}
