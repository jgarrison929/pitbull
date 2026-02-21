using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.PurchaseOrders;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class PurchaseOrderService(PitbullDbContext db, ILogger<PurchaseOrderService> logger) : IPurchaseOrderService
{
    public async Task<Result<ListPurchaseOrdersResult>> GetPurchaseOrdersAsync(ListPurchaseOrdersQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<PurchaseOrder> dbQuery = db.Set<PurchaseOrder>()
            .AsNoTracking()
            .Include(po => po.Lines);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(po => po.Status == query.Status.Value);

        if (query.VendorId.HasValue)
            dbQuery = dbQuery.Where(po => po.VendorId == query.VendorId.Value);

        if (query.ProjectId.HasValue)
            dbQuery = dbQuery.Where(po => po.ProjectId == query.ProjectId.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string term = query.Search.Trim().ToLower();
            dbQuery = dbQuery.Where(po =>
                po.PONumber.ToLower().Contains(term) ||
                (po.Description != null && po.Description.ToLower().Contains(term)));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<PurchaseOrder> items = await dbQuery
            .OrderByDescending(po => po.CreatedAt)
            .ThenByDescending(po => po.PONumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListPurchaseOrdersResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<PurchaseOrderDto>> GetPurchaseOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        PurchaseOrder? purchaseOrder = await db.Set<PurchaseOrder>()
            .AsNoTracking()
            .Include(po => po.Lines)
            .FirstOrDefaultAsync(po => po.Id == id, cancellationToken);

        if (purchaseOrder is null)
            return Result.Failure<PurchaseOrderDto>("Purchase order not found", "NOT_FOUND");

        return Result.Success(MapToDto(purchaseOrder));
    }

    public async Task<Result<PurchaseOrderDto>> CreatePurchaseOrderAsync(CreatePurchaseOrderCommand command, CancellationToken cancellationToken = default)
    {
        if (command.ProjectId == Guid.Empty || command.VendorId == Guid.Empty)
            return Result.Failure<PurchaseOrderDto>("ProjectId and VendorId are required", "VALIDATION_ERROR");

        if (command.Lines is null || command.Lines.Count == 0)
            return Result.Failure<PurchaseOrderDto>("At least one line is required", "VALIDATION_ERROR");

        string poNumber = await GeneratePoNumberAsync(cancellationToken);

        PurchaseOrder purchaseOrder = new()
        {
            PONumber = poNumber,
            ProjectId = command.ProjectId,
            VendorId = command.VendorId,
            Description = command.Description?.Trim(),
            Status = PurchaseOrderStatus.Draft
        };

        foreach (CreatePurchaseOrderLineCommand line in command.Lines)
        {
            if (string.IsNullOrWhiteSpace(line.Description) || line.Quantity <= 0 || line.UnitPrice < 0)
                return Result.Failure<PurchaseOrderDto>("Line description, quantity, and unit price are required", "VALIDATION_ERROR");

            decimal amount = decimal.Round(line.Quantity * line.UnitPrice, 2, MidpointRounding.AwayFromZero);

            purchaseOrder.Lines.Add(new PurchaseOrderLine
            {
                Description = line.Description.Trim(),
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                Amount = amount,
                CostCodeId = line.CostCodeId,
                ReceivedQuantity = 0m
            });
        }

        purchaseOrder.TotalAmount = purchaseOrder.Lines.Sum(l => l.Amount);

        db.Set<PurchaseOrder>().Add(purchaseOrder);

        // Retry with new PO number on unique constraint violation (race condition)
        for (int attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return Result.Success(MapToDto(purchaseOrder));
            }
            catch (DbUpdateException ex) when (attempt < 2 && IsUniqueViolation(ex))
            {
                logger.LogWarning("PO number {PONumber} conflict, retrying (attempt {Attempt})",
                    purchaseOrder.PONumber, attempt + 1);
                purchaseOrder.PONumber = await GeneratePoNumberAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to create purchase order for vendor {VendorId}", command.VendorId);
                return Result.Failure<PurchaseOrderDto>("Failed to create purchase order", "DATABASE_ERROR");
            }
        }

        return Result.Failure<PurchaseOrderDto>("Failed to generate unique PO number after retries", "DATABASE_ERROR");
    }

    public async Task<Result<PurchaseOrderDto>> UpdatePurchaseOrderAsync(UpdatePurchaseOrderCommand command, CancellationToken cancellationToken = default)
    {
        PurchaseOrder? purchaseOrder = await db.Set<PurchaseOrder>()
            .Include(po => po.Lines)
            .FirstOrDefaultAsync(po => po.Id == command.PurchaseOrderId, cancellationToken);

        if (purchaseOrder is null)
            return Result.Failure<PurchaseOrderDto>("Purchase order not found", "NOT_FOUND");

        if (purchaseOrder.Status != PurchaseOrderStatus.Draft)
            return Result.Failure<PurchaseOrderDto>("Only draft purchase orders can be edited", "INVALID_STATUS");

        if (command.ProjectId.HasValue)
            purchaseOrder.ProjectId = command.ProjectId.Value;
        if (command.VendorId.HasValue)
            purchaseOrder.VendorId = command.VendorId.Value;
        if (command.Description != null)
            purchaseOrder.Description = string.IsNullOrWhiteSpace(command.Description) ? null : command.Description.Trim();

        if (command.Lines is not null)
        {
            db.Set<PurchaseOrderLine>().RemoveRange(purchaseOrder.Lines);
            purchaseOrder.Lines.Clear();

            foreach (CreatePurchaseOrderLineCommand line in command.Lines)
            {
                if (string.IsNullOrWhiteSpace(line.Description) || line.Quantity <= 0 || line.UnitPrice < 0)
                    return Result.Failure<PurchaseOrderDto>("Line description, quantity, and unit price are required", "VALIDATION_ERROR");

                decimal amount = decimal.Round(line.Quantity * line.UnitPrice, 2, MidpointRounding.AwayFromZero);

                purchaseOrder.Lines.Add(new PurchaseOrderLine
                {
                    Description = line.Description.Trim(),
                    Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice,
                    Amount = amount,
                    CostCodeId = line.CostCodeId,
                    ReceivedQuantity = 0m
                });
            }
        }

        purchaseOrder.TotalAmount = purchaseOrder.Lines.Sum(l => l.Amount);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(purchaseOrder));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<PurchaseOrderDto>("Purchase order was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update purchase order {PurchaseOrderId}", command.PurchaseOrderId);
            return Result.Failure<PurchaseOrderDto>("Failed to update purchase order", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PurchaseOrderDto>> ApprovePurchaseOrderAsync(Guid id, Guid approvedById, CancellationToken cancellationToken = default)
    {
        PurchaseOrder? purchaseOrder = await db.Set<PurchaseOrder>()
            .Include(po => po.Lines)
            .FirstOrDefaultAsync(po => po.Id == id, cancellationToken);

        if (purchaseOrder is null)
            return Result.Failure<PurchaseOrderDto>("Purchase order not found", "NOT_FOUND");

        if (purchaseOrder.Status != PurchaseOrderStatus.Draft)
            return Result.Failure<PurchaseOrderDto>("Only draft purchase orders can be approved", "INVALID_STATUS");

        if (purchaseOrder.Lines.Count == 0)
            return Result.Failure<PurchaseOrderDto>("Purchase order must have at least one line", "VALIDATION_ERROR");

        purchaseOrder.Status = PurchaseOrderStatus.Approved;
        purchaseOrder.ApprovedById = approvedById == Guid.Empty ? null : approvedById;
        purchaseOrder.ApprovedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(purchaseOrder));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to approve purchase order {PurchaseOrderId}", id);
            return Result.Failure<PurchaseOrderDto>("Failed to approve purchase order", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PurchaseOrderDto>> ReceivePurchaseOrderAsync(ReceivePurchaseOrderCommand command, CancellationToken cancellationToken = default)
    {
        PurchaseOrder? purchaseOrder = await db.Set<PurchaseOrder>()
            .Include(po => po.Lines)
            .FirstOrDefaultAsync(po => po.Id == command.PurchaseOrderId, cancellationToken);

        if (purchaseOrder is null)
            return Result.Failure<PurchaseOrderDto>("Purchase order not found", "NOT_FOUND");

        if (purchaseOrder.Status is not (PurchaseOrderStatus.Approved or PurchaseOrderStatus.PartiallyReceived))
            return Result.Failure<PurchaseOrderDto>("Purchase order must be approved before receiving", "INVALID_STATUS");

        if (command.Lines is null || command.Lines.Count == 0)
            return Result.Failure<PurchaseOrderDto>("At least one received line is required", "VALIDATION_ERROR");

        foreach (PurchaseOrderReceiveLineCommand line in command.Lines)
        {
            PurchaseOrderLine? poLine = purchaseOrder.Lines.FirstOrDefault(l => l.Id == line.PurchaseOrderLineId);
            if (poLine is null)
                return Result.Failure<PurchaseOrderDto>($"PO line {line.PurchaseOrderLineId} not found", "LINE_NOT_FOUND");

            if (line.ReceivedQuantity <= 0)
                return Result.Failure<PurchaseOrderDto>("Received quantity must be greater than zero", "VALIDATION_ERROR");

            decimal newTotal = poLine.ReceivedQuantity + line.ReceivedQuantity;
            if (newTotal > poLine.Quantity)
                return Result.Failure<PurchaseOrderDto>(
                    $"Received quantity ({newTotal}) exceeds ordered quantity ({poLine.Quantity}) for line item '{poLine.Description}'",
                    "OVER_DELIVERY");

            poLine.ReceivedQuantity = newTotal;
        }

        bool allReceived = purchaseOrder.Lines.All(l => l.ReceivedQuantity >= l.Quantity);
        bool anyReceived = purchaseOrder.Lines.Any(l => l.ReceivedQuantity > 0);

        if (allReceived)
            purchaseOrder.Status = PurchaseOrderStatus.Received;
        else if (anyReceived)
            purchaseOrder.Status = PurchaseOrderStatus.PartiallyReceived;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(purchaseOrder));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to receive purchase order {PurchaseOrderId}", command.PurchaseOrderId);
            return Result.Failure<PurchaseOrderDto>("Failed to receive purchase order", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeletePurchaseOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        PurchaseOrder? purchaseOrder = await db.Set<PurchaseOrder>()
            .FirstOrDefaultAsync(po => po.Id == id, cancellationToken);

        if (purchaseOrder is null)
            return Result.Failure("Purchase order not found", "NOT_FOUND");

        if (purchaseOrder.Status is PurchaseOrderStatus.Received or PurchaseOrderStatus.PartiallyReceived or PurchaseOrderStatus.Closed)
            return Result.Failure("Cannot delete a purchase order that has been received or closed", "INVALID_STATUS");

        db.Set<PurchaseOrder>().Remove(purchaseOrder);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete purchase order {PurchaseOrderId}", id);
            return Result.Failure("Failed to delete purchase order", "DATABASE_ERROR");
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        // PostgreSQL unique violation error code: 23505
        var inner = ex.InnerException;
        return inner is not null && inner.Message.Contains("23505", StringComparison.Ordinal);
    }

    private async Task<string> GeneratePoNumberAsync(CancellationToken cancellationToken)
    {
        int year = DateTime.UtcNow.Year;
        string prefix = $"PO-{year}-";

        string? lastPoNumber = await db.Set<PurchaseOrder>()
            .Where(po => po.PONumber.StartsWith(prefix))
            .OrderByDescending(po => po.PONumber)
            .Select(po => po.PONumber)
            .FirstOrDefaultAsync(cancellationToken);

        int nextSequence = 1;
        if (!string.IsNullOrWhiteSpace(lastPoNumber) && lastPoNumber.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            string sequencePart = lastPoNumber[prefix.Length..];
            if (int.TryParse(sequencePart, out int parsed))
                nextSequence = parsed + 1;
        }

        return $"{prefix}{nextSequence:D6}";
    }

    private static PurchaseOrderDto MapToDto(PurchaseOrder purchaseOrder)
    {
        return new PurchaseOrderDto(
            Id: purchaseOrder.Id,
            PONumber: purchaseOrder.PONumber,
            ProjectId: purchaseOrder.ProjectId,
            VendorId: purchaseOrder.VendorId,
            Description: purchaseOrder.Description,
            TotalAmount: purchaseOrder.TotalAmount,
            Status: purchaseOrder.Status,
            StatusName: purchaseOrder.Status.ToString(),
            ApprovedById: purchaseOrder.ApprovedById,
            ApprovedAt: purchaseOrder.ApprovedAt,
            Lines: purchaseOrder.Lines
                .OrderBy(line => line.CreatedAt)
                .Select(line => new PurchaseOrderLineDto(
                    Id: line.Id,
                    Description: line.Description,
                    Quantity: line.Quantity,
                    UnitPrice: line.UnitPrice,
                    Amount: line.Amount,
                    CostCodeId: line.CostCodeId,
                    ReceivedQuantity: line.ReceivedQuantity))
                .ToList(),
            CreatedAt: purchaseOrder.CreatedAt,
            UpdatedAt: purchaseOrder.UpdatedAt);
    }
}
