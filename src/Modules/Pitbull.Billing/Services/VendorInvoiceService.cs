using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.VendorInvoices;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class VendorInvoiceService(PitbullDbContext db, ILogger<VendorInvoiceService> logger) : IVendorInvoiceService
{
    private const decimal DefaultTolerancePercent = 5m;

    public async Task<Result<ListVendorInvoicesResult>> GetVendorInvoicesAsync(ListVendorInvoicesQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<VendorInvoice> dbQuery = db.Set<VendorInvoice>()
            .AsNoTracking()
            .Include(i => i.MatchResults);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(i => i.Status == query.Status.Value);

        if (query.VendorId.HasValue)
            dbQuery = dbQuery.Where(i => i.VendorId == query.VendorId.Value);

        if (query.PurchaseOrderId.HasValue)
            dbQuery = dbQuery.Where(i => i.PurchaseOrderId == query.PurchaseOrderId.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string term = query.Search.Trim().ToLower();
            dbQuery = dbQuery.Where(i => i.InvoiceNumber.ToLower().Contains(term));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<VendorInvoice> items = await dbQuery
            .OrderByDescending(i => i.InvoiceDate)
            .ThenByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListVendorInvoicesResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<VendorInvoiceDto>> GetVendorInvoiceAsync(Guid id, CancellationToken cancellationToken = default)
    {
        VendorInvoice? invoice = await db.Set<VendorInvoice>()
            .AsNoTracking()
            .Include(i => i.MatchResults)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice is null)
            return Result.Failure<VendorInvoiceDto>("Vendor invoice not found", "NOT_FOUND");

        return Result.Success(MapToDto(invoice));
    }

    public async Task<Result<VendorInvoiceDto>> CreateVendorInvoiceAsync(CreateVendorInvoiceCommand command, CancellationToken cancellationToken = default)
    {
        if (command.VendorId == Guid.Empty || string.IsNullOrWhiteSpace(command.InvoiceNumber))
            return Result.Failure<VendorInvoiceDto>("VendorId and InvoiceNumber are required", "VALIDATION_ERROR");

        if (command.TotalAmount <= 0)
            return Result.Failure<VendorInvoiceDto>("Invoice total amount must be positive", "VALIDATION_ERROR");

        VendorInvoice invoice = new()
        {
            VendorId = command.VendorId,
            InvoiceNumber = command.InvoiceNumber.Trim(),
            InvoiceDate = command.InvoiceDate,
            DueDate = command.DueDate,
            TotalAmount = command.TotalAmount,
            Status = VendorInvoiceStatus.Pending,
            PurchaseOrderId = command.PurchaseOrderId
        };

        db.Set<VendorInvoice>().Add(invoice);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(invoice));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create vendor invoice {InvoiceNumber}", command.InvoiceNumber);
            return Result.Failure<VendorInvoiceDto>("Failed to create vendor invoice", "DATABASE_ERROR");
        }
    }

    public async Task<Result<VendorInvoiceDto>> UpdateVendorInvoiceAsync(UpdateVendorInvoiceCommand command, CancellationToken cancellationToken = default)
    {
        VendorInvoice? invoice = await db.Set<VendorInvoice>()
            .Include(i => i.MatchResults)
            .FirstOrDefaultAsync(i => i.Id == command.VendorInvoiceId, cancellationToken);

        if (invoice is null)
            return Result.Failure<VendorInvoiceDto>("Vendor invoice not found", "NOT_FOUND");

        if (command.VendorId.HasValue)
            invoice.VendorId = command.VendorId.Value;
        if (!string.IsNullOrWhiteSpace(command.InvoiceNumber))
            invoice.InvoiceNumber = command.InvoiceNumber.Trim();
        if (command.InvoiceDate.HasValue)
            invoice.InvoiceDate = command.InvoiceDate.Value;
        if (command.DueDate.HasValue)
            invoice.DueDate = command.DueDate.Value;
        if (command.TotalAmount.HasValue)
            invoice.TotalAmount = command.TotalAmount.Value;
        if (command.Status.HasValue)
        {
            if (!IsValidInvoiceStatusTransition(invoice.Status, command.Status.Value))
                return Result.Failure<VendorInvoiceDto>(
                    $"Cannot transition invoice from {invoice.Status} to {command.Status.Value}",
                    "INVALID_STATUS_TRANSITION");
            invoice.Status = command.Status.Value;
        }
        if (command.ClearPurchaseOrderId)
            invoice.PurchaseOrderId = null;
        else if (command.PurchaseOrderId.HasValue)
            invoice.PurchaseOrderId = command.PurchaseOrderId.Value;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(invoice));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<VendorInvoiceDto>("Vendor invoice was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update vendor invoice {VendorInvoiceId}", command.VendorInvoiceId);
            return Result.Failure<VendorInvoiceDto>("Failed to update vendor invoice", "DATABASE_ERROR");
        }
    }

    public async Task<Result<InvoiceMatchResultDto>> MatchVendorInvoiceAsync(MatchVendorInvoiceCommand command, CancellationToken cancellationToken = default)
    {
        VendorInvoice? invoice = await db.Set<VendorInvoice>()
            .Include(i => i.MatchResults)
            .FirstOrDefaultAsync(i => i.Id == command.VendorInvoiceId, cancellationToken);

        if (invoice is null)
            return Result.Failure<InvoiceMatchResultDto>("Vendor invoice not found", "NOT_FOUND");

        PurchaseOrder? purchaseOrder = null;

        if (invoice.PurchaseOrderId.HasValue)
        {
            purchaseOrder = await db.Set<PurchaseOrder>()
                .Include(po => po.Lines)
                .FirstOrDefaultAsync(po => po.Id == invoice.PurchaseOrderId.Value, cancellationToken);
        }
        else
        {
            purchaseOrder = await db.Set<PurchaseOrder>()
                .Include(po => po.Lines)
                .Where(po => po.VendorId == invoice.VendorId)
                .OrderBy(po => Math.Abs(po.TotalAmount - invoice.TotalAmount))
                .ThenByDescending(po => po.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (purchaseOrder is not null)
                invoice.PurchaseOrderId = purchaseOrder.Id;
        }

        if (purchaseOrder is null)
            return Result.Failure<InvoiceMatchResultDto>("No purchase order available for match", "PO_NOT_FOUND");

        decimal poAmount = purchaseOrder.Lines.Sum(l => l.Amount);
        decimal receivedAmount = purchaseOrder.Lines.Sum(l => l.ReceivedQuantity * l.UnitPrice);
        bool hasReceipts = purchaseOrder.Lines.Any(l => l.ReceivedQuantity > 0);

        InvoiceMatchType matchType = hasReceipts ? InvoiceMatchType.ThreeWay : InvoiceMatchType.TwoWay;
        decimal expectedAmount = hasReceipts ? receivedAmount : poAmount;

        decimal varianceAmount = decimal.Round(invoice.TotalAmount - expectedAmount, 2, MidpointRounding.AwayFromZero);
        decimal variancePercent = expectedAmount == 0
            ? (invoice.TotalAmount == 0 ? 0 : 100)
            : decimal.Round((varianceAmount / expectedAmount) * 100m, 4, MidpointRounding.AwayFromZero);

        decimal tolerancePercent = command.TolerancePercent ?? DefaultTolerancePercent;
        bool withinTolerance = Math.Abs(variancePercent) <= tolerancePercent;

        InvoiceMatchResult result = new()
        {
            VendorInvoiceId = invoice.Id,
            PurchaseOrderId = purchaseOrder.Id,
            MatchType = matchType,
            VarianceAmount = varianceAmount,
            VariancePercent = variancePercent,
            AutoApproved = withinTolerance,
            MatchedAt = DateTime.UtcNow
        };

        db.Set<InvoiceMatchResult>().Add(result);

        invoice.Status = withinTolerance ? VendorInvoiceStatus.Matched : VendorInvoiceStatus.PartiallyMatched;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapMatchResultDto(result));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to match vendor invoice {VendorInvoiceId}", command.VendorInvoiceId);
            return Result.Failure<InvoiceMatchResultDto>("Failed to match vendor invoice", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteVendorInvoiceAsync(Guid id, CancellationToken cancellationToken = default)
    {
        VendorInvoice? invoice = await db.Set<VendorInvoice>()
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice is null)
            return Result.Failure("Vendor invoice not found", "NOT_FOUND");

        db.Set<VendorInvoice>().Remove(invoice);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete vendor invoice {VendorInvoiceId}", id);
            return Result.Failure("Failed to delete vendor invoice", "DATABASE_ERROR");
        }
    }

    private static VendorInvoiceDto MapToDto(VendorInvoice invoice)
    {
        InvoiceMatchResult? latestMatch = invoice.MatchResults
            .OrderByDescending(m => m.MatchedAt)
            .FirstOrDefault();

        return new VendorInvoiceDto(
            Id: invoice.Id,
            VendorId: invoice.VendorId,
            InvoiceNumber: invoice.InvoiceNumber,
            InvoiceDate: invoice.InvoiceDate,
            DueDate: invoice.DueDate,
            TotalAmount: invoice.TotalAmount,
            Status: invoice.Status,
            StatusName: invoice.Status.ToString(),
            PurchaseOrderId: invoice.PurchaseOrderId,
            LatestMatchResult: latestMatch is null ? null : MapMatchResultDto(latestMatch),
            CreatedAt: invoice.CreatedAt,
            UpdatedAt: invoice.UpdatedAt);
    }

    private static InvoiceMatchResultDto MapMatchResultDto(InvoiceMatchResult match)
    {
        return new InvoiceMatchResultDto(
            Id: match.Id,
            VendorInvoiceId: match.VendorInvoiceId,
            PurchaseOrderId: match.PurchaseOrderId,
            MatchType: match.MatchType,
            MatchTypeName: match.MatchType.ToString(),
            VarianceAmount: match.VarianceAmount,
            VariancePercent: match.VariancePercent,
            AutoApproved: match.AutoApproved,
            MatchedAt: match.MatchedAt);
    }

    private static bool IsValidInvoiceStatusTransition(VendorInvoiceStatus from, VendorInvoiceStatus to)
    {
        if (from == to) return true;
        return (from, to) switch
        {
            (VendorInvoiceStatus.Pending, VendorInvoiceStatus.Matched) => true,
            (VendorInvoiceStatus.Pending, VendorInvoiceStatus.PartiallyMatched) => true,
            (VendorInvoiceStatus.Pending, VendorInvoiceStatus.Approved) => true,
            (VendorInvoiceStatus.Matched, VendorInvoiceStatus.Approved) => true,
            (VendorInvoiceStatus.PartiallyMatched, VendorInvoiceStatus.Approved) => true,
            (VendorInvoiceStatus.Approved, VendorInvoiceStatus.Paid) => true,
            _ => false
        };
    }
}
