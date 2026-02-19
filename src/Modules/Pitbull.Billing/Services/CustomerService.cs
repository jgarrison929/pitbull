using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.Customers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class CustomerService(PitbullDbContext db, ILogger<CustomerService> logger) : ICustomerService
{
    public async Task<Result<ListCustomersResult>> GetCustomersAsync(ListCustomersQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<Customer> dbQuery = db.Set<Customer>().AsNoTracking();

        if (query.IsActive.HasValue)
            dbQuery = dbQuery.Where(c => c.IsActive == query.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            string searchTerm = query.SearchTerm.Trim().ToLower();
            dbQuery = dbQuery.Where(c =>
                c.Name.ToLower().Contains(searchTerm) ||
                c.Code.ToLower().Contains(searchTerm) ||
                (c.ContactName != null && c.ContactName.ToLower().Contains(searchTerm)) ||
                (c.ContactEmail != null && c.ContactEmail.ToLower().Contains(searchTerm)));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : query.PageSize;

        List<Customer> items = await dbQuery
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListCustomersResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<CustomerDto>> GetCustomerAsync(Guid id, CancellationToken cancellationToken = default)
    {
        Customer? customer = await db.Set<Customer>()
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (customer is null)
            return Result.Failure<CustomerDto>("Customer not found", "NOT_FOUND");

        return Result.Success(MapToDto(customer));
    }

    public async Task<Result<CustomerDto>> CreateCustomerAsync(CreateCustomerCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Name) || string.IsNullOrWhiteSpace(command.Code))
            return Result.Failure<CustomerDto>("Name and Code are required", "VALIDATION_ERROR");

        bool duplicate = await db.Set<Customer>()
            .AnyAsync(c => c.Code == command.Code, cancellationToken);

        if (duplicate)
            return Result.Failure<CustomerDto>($"Customer code '{command.Code}' already exists", "DUPLICATE_CODE");

        Customer customer = new()
        {
            Name = command.Name.Trim(),
            Code = command.Code.Trim(),
            ContactName = command.ContactName,
            ContactEmail = command.ContactEmail,
            Phone = command.Phone,
            Address = command.Address,
            City = command.City,
            State = command.State,
            Zip = command.Zip,
            PaymentTerms = command.PaymentTerms,
            CreditLimit = command.CreditLimit,
            IsActive = command.IsActive
        };

        db.Set<Customer>().Add(customer);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(customer));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create customer {CustomerCode}", command.Code);
            return Result.Failure<CustomerDto>("Failed to create customer", "DATABASE_ERROR");
        }
    }

    public async Task<Result<CustomerDto>> UpdateCustomerAsync(UpdateCustomerCommand command, CancellationToken cancellationToken = default)
    {
        Customer? customer = await db.Set<Customer>().FirstOrDefaultAsync(c => c.Id == command.CustomerId, cancellationToken);
        if (customer is null)
            return Result.Failure<CustomerDto>("Customer not found", "NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(command.Code) && !string.Equals(customer.Code, command.Code, StringComparison.OrdinalIgnoreCase))
        {
            bool duplicate = await db.Set<Customer>()
                .AnyAsync(c => c.Id != command.CustomerId && c.Code == command.Code, cancellationToken);
            if (duplicate)
                return Result.Failure<CustomerDto>($"Customer code '{command.Code}' already exists", "DUPLICATE_CODE");
            customer.Code = command.Code.Trim();
        }

        if (!string.IsNullOrWhiteSpace(command.Name))
            customer.Name = command.Name.Trim();
        if (command.ContactName != null)
            customer.ContactName = command.ContactName;
        if (command.ContactEmail != null)
            customer.ContactEmail = command.ContactEmail;
        if (command.Phone != null)
            customer.Phone = command.Phone;
        if (command.Address != null)
            customer.Address = command.Address;
        if (command.City != null)
            customer.City = command.City;
        if (command.State != null)
            customer.State = command.State;
        if (command.Zip != null)
            customer.Zip = command.Zip;
        if (command.PaymentTerms != null)
            customer.PaymentTerms = command.PaymentTerms;
        if (command.CreditLimit.HasValue)
            customer.CreditLimit = command.CreditLimit.Value;
        if (command.IsActive.HasValue)
            customer.IsActive = command.IsActive.Value;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(customer));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<CustomerDto>("Customer was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update customer {CustomerId}", command.CustomerId);
            return Result.Failure<CustomerDto>("Failed to update customer", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteCustomerAsync(Guid id, CancellationToken cancellationToken = default)
    {
        Customer? customer = await db.Set<Customer>().FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (customer is null)
            return Result.Failure("Customer not found", "NOT_FOUND");

        db.Set<Customer>().Remove(customer);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete customer {CustomerId}", id);
            return Result.Failure("Failed to delete customer", "DATABASE_ERROR");
        }
    }

    private static CustomerDto MapToDto(Customer customer)
    {
        return new CustomerDto(
            Id: customer.Id,
            Name: customer.Name,
            Code: customer.Code,
            ContactName: customer.ContactName,
            ContactEmail: customer.ContactEmail,
            Phone: customer.Phone,
            Address: customer.Address,
            City: customer.City,
            State: customer.State,
            Zip: customer.Zip,
            PaymentTerms: customer.PaymentTerms,
            CreditLimit: customer.CreditLimit,
            IsActive: customer.IsActive,
            CreatedAt: customer.CreatedAt,
            UpdatedAt: customer.UpdatedAt);
    }
}
