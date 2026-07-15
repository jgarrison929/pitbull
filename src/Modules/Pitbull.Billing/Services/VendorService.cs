using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.Vendors;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Logging;

namespace Pitbull.Billing.Services;

public class VendorService(PitbullDbContext db, ILogger<VendorService> logger) : IVendorService
{
    public async Task<Result<ListVendorsResult>> GetVendorsAsync(ListVendorsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<Vendor> dbQuery = db.Set<Vendor>().AsNoTracking();

        if (query.IsActive.HasValue)
            dbQuery = dbQuery.Where(v => v.IsActive == query.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            string searchTerm = query.SearchTerm.Trim().ToLower();
            dbQuery = dbQuery.Where(v =>
                v.Name.ToLower().Contains(searchTerm) ||
                v.Code.ToLower().Contains(searchTerm) ||
                (v.ContactName != null && v.ContactName.ToLower().Contains(searchTerm)) ||
                (v.ContactEmail != null && v.ContactEmail.ToLower().Contains(searchTerm)) ||
                (v.TradeClassification != null && v.TradeClassification.ToLower().Contains(searchTerm)));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : query.PageSize;

        List<Vendor> items = await dbQuery
            .OrderBy(v => v.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListVendorsResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<VendorDto>> GetVendorAsync(Guid id, CancellationToken cancellationToken = default)
    {
        Vendor? vendor = await db.Set<Vendor>()
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);

        if (vendor is null)
            return Result.Failure<VendorDto>("Vendor not found", "NOT_FOUND");

        return Result.Success(MapToDto(vendor));
    }

    public async Task<Result<VendorDto>> CreateVendorAsync(CreateVendorCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Name) || string.IsNullOrWhiteSpace(command.Code))
            return Result.Failure<VendorDto>("Name and Code are required", "VALIDATION_ERROR");

        bool duplicate = await db.Set<Vendor>()
            .AnyAsync(v => v.Code == command.Code, cancellationToken);

        if (duplicate)
            return Result.Failure<VendorDto>($"Vendor code '{command.Code}' already exists", "DUPLICATE_CODE");

        Vendor vendor = new()
        {
            Name = command.Name.Trim(),
            Code = command.Code.Trim(),
            TaxId = command.TaxId,
            ContactName = command.ContactName,
            ContactEmail = command.ContactEmail,
            Phone = command.Phone,
            Address = command.Address,
            City = command.City,
            State = command.State,
            Zip = command.Zip,
            InsuranceExpDate = command.InsuranceExpDate,
            W9OnFile = command.W9OnFile,
            MinorityWbeStatus = command.MinorityWbeStatus,
            TradeClassification = command.TradeClassification,
            PaymentTerms = command.PaymentTerms,
            IsActive = command.IsActive
        };

        db.Set<Vendor>().Add(vendor);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(vendor));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create vendor {VendorCode}", LogSafe.Text(command.Code));
            return Result.Failure<VendorDto>("Failed to create vendor", "DATABASE_ERROR");
        }
    }

    public async Task<Result<VendorDto>> UpdateVendorAsync(UpdateVendorCommand command, CancellationToken cancellationToken = default)
    {
        Vendor? vendor = await db.Set<Vendor>().FirstOrDefaultAsync(v => v.Id == command.VendorId, cancellationToken);
        if (vendor is null)
            return Result.Failure<VendorDto>("Vendor not found", "NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(command.Code) && !string.Equals(vendor.Code, command.Code, StringComparison.OrdinalIgnoreCase))
        {
            bool duplicate = await db.Set<Vendor>()
                .AnyAsync(v => v.Id != command.VendorId && v.Code == command.Code, cancellationToken);
            if (duplicate)
                return Result.Failure<VendorDto>($"Vendor code '{command.Code}' already exists", "DUPLICATE_CODE");
            vendor.Code = command.Code.Trim();
        }

        if (!string.IsNullOrWhiteSpace(command.Name))
            vendor.Name = command.Name.Trim();
        if (command.TaxId != null)
            vendor.TaxId = command.TaxId;
        if (command.ContactName != null)
            vendor.ContactName = command.ContactName;
        if (command.ContactEmail != null)
            vendor.ContactEmail = command.ContactEmail;
        if (command.Phone != null)
            vendor.Phone = command.Phone;
        if (command.Address != null)
            vendor.Address = command.Address;
        if (command.City != null)
            vendor.City = command.City;
        if (command.State != null)
            vendor.State = command.State;
        if (command.Zip != null)
            vendor.Zip = command.Zip;
        if (command.InsuranceExpDate.HasValue)
            vendor.InsuranceExpDate = command.InsuranceExpDate.Value;
        if (command.W9OnFile.HasValue)
            vendor.W9OnFile = command.W9OnFile.Value;
        if (command.MinorityWbeStatus != null)
            vendor.MinorityWbeStatus = command.MinorityWbeStatus;
        if (command.TradeClassification != null)
            vendor.TradeClassification = command.TradeClassification;
        if (command.PaymentTerms != null)
            vendor.PaymentTerms = command.PaymentTerms;
        if (command.IsActive.HasValue)
            vendor.IsActive = command.IsActive.Value;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(vendor));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<VendorDto>("Vendor was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update vendor {VendorId}", command.VendorId);
            return Result.Failure<VendorDto>("Failed to update vendor", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteVendorAsync(Guid id, CancellationToken cancellationToken = default)
    {
        Vendor? vendor = await db.Set<Vendor>().FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (vendor is null)
            return Result.Failure("Vendor not found", "NOT_FOUND");

        db.Set<Vendor>().Remove(vendor);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete vendor {VendorId}", id);
            return Result.Failure("Failed to delete vendor", "DATABASE_ERROR");
        }
    }

    private static VendorDto MapToDto(Vendor vendor)
    {
        return new VendorDto(
            Id: vendor.Id,
            Name: vendor.Name,
            Code: vendor.Code,
            TaxId: vendor.TaxId,
            ContactName: vendor.ContactName,
            ContactEmail: vendor.ContactEmail,
            Phone: vendor.Phone,
            Address: vendor.Address,
            City: vendor.City,
            State: vendor.State,
            Zip: vendor.Zip,
            InsuranceExpDate: vendor.InsuranceExpDate,
            W9OnFile: vendor.W9OnFile,
            MinorityWbeStatus: vendor.MinorityWbeStatus,
            TradeClassification: vendor.TradeClassification,
            PaymentTerms: vendor.PaymentTerms,
            IsActive: vendor.IsActive,
            CreatedAt: vendor.CreatedAt,
            UpdatedAt: vendor.UpdatedAt);
    }
}
