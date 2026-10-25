using Pitbull.Billing.Features.Vendors;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IVendorService
{
    Task<Result<ListVendorsResult>> GetVendorsAsync(ListVendorsQuery query, CancellationToken cancellationToken = default);
    Task<Result<VendorDto>> GetVendorAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<VendorDto>> CreateVendorAsync(CreateVendorCommand command, CancellationToken cancellationToken = default);
    Task<Result<VendorDto>> UpdateVendorAsync(UpdateVendorCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteVendorAsync(Guid id, CancellationToken cancellationToken = default);
}
