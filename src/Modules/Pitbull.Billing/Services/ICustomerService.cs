using Pitbull.Billing.Features.Customers;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface ICustomerService
{
    Task<Result<ListCustomersResult>> GetCustomersAsync(ListCustomersQuery query, CancellationToken cancellationToken = default);
    Task<Result<CustomerDto>> GetCustomerAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<CustomerDto>> CreateCustomerAsync(CreateCustomerCommand command, CancellationToken cancellationToken = default);
    Task<Result<CustomerDto>> UpdateCustomerAsync(UpdateCustomerCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteCustomerAsync(Guid id, CancellationToken cancellationToken = default);
}
