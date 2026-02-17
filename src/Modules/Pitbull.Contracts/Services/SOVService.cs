using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.SOV;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Services;

public class SOVService(PitbullDbContext db) : ISOVService
{
    public async Task<Result<SOVDto>> GetBySubcontractAsync(Guid subcontractId, CancellationToken ct = default)
    {
        var sov = await db.Set<ScheduleOfValues>()
            .AsNoTracking()
            .Include(s => s.LineItems.Where(li => !li.IsDeleted).OrderBy(li => li.SortOrder))
            .FirstOrDefaultAsync(s => s.SubcontractId == subcontractId && !s.IsDeleted, ct);

        if (sov is null)
            return Result.Failure<SOVDto>("No schedule of values found for this contract", "NOT_FOUND");

        return Result.Success(MapToDto(sov));
    }

    public async Task<Result<SOVDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var sov = await db.Set<ScheduleOfValues>()
            .AsNoTracking()
            .Include(s => s.LineItems.Where(li => !li.IsDeleted).OrderBy(li => li.SortOrder))
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);

        if (sov is null)
            return Result.Failure<SOVDto>("Schedule of values not found", "NOT_FOUND");

        return Result.Success(MapToDto(sov));
    }

    public async Task<Result<SOVDto>> CreateAsync(Guid subcontractId, CreateSOVCommand command, CancellationToken ct = default)
    {
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == subcontractId && !s.IsDeleted, ct);

        if (subcontract is null)
            return Result.Failure<SOVDto>("Subcontract not found", "NOT_FOUND");

        // Check if SOV already exists for this subcontract
        var existing = await db.Set<ScheduleOfValues>()
            .AnyAsync(s => s.SubcontractId == subcontractId && !s.IsDeleted, ct);

        if (existing)
            return Result.Failure<SOVDto>("A schedule of values already exists for this contract", "DUPLICATE");

        var sov = new ScheduleOfValues
        {
            SubcontractId = subcontractId,
            Name = command.Name,
            RetainagePercent = command.RetainagePercent,
            TotalScheduledValue = 0,
            Status = SOVStatus.Draft
        };

        db.Set<ScheduleOfValues>().Add(sov);
        await db.SaveChangesAsync(ct);

        return Result.Success(MapToDto(sov));
    }

    public async Task<Result<SOVSummaryDto>> GetSummaryAsync(Guid id, CancellationToken ct = default)
    {
        var sov = await db.Set<ScheduleOfValues>()
            .AsNoTracking()
            .Include(s => s.LineItems.Where(li => !li.IsDeleted))
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);

        if (sov is null)
            return Result.Failure<SOVSummaryDto>("Schedule of values not found", "NOT_FOUND");

        var items = sov.LineItems;
        var totalScheduled = items.Sum(li => li.ScheduledValue);
        var totalPrevious = items.Sum(li => li.PreviouslyBilled);
        var totalCurrent = items.Sum(li => li.CurrentBilled);
        var totalStored = items.Sum(li => li.StoredMaterials);
        var totalCompleted = items.Sum(li => li.TotalCompletedToDate);
        var totalBalance = items.Sum(li => li.BalanceToFinish);
        var totalRetainage = items.Sum(li => li.Retainage);
        var overallPercent = totalScheduled != 0 ? Math.Round(totalCompleted / totalScheduled * 100, 2) : 0;

        return Result.Success(new SOVSummaryDto(
            sov.Id,
            sov.Name,
            totalScheduled,
            totalPrevious,
            totalCurrent,
            totalStored,
            totalCompleted,
            overallPercent,
            totalBalance,
            totalRetainage,
            items.Count
        ));
    }

    public async Task<Result<SOVLineItemDto>> AddLineItemAsync(Guid sovId, CreateSOVLineItemCommand command, CancellationToken ct = default)
    {
        var sov = await db.Set<ScheduleOfValues>()
            .Include(s => s.LineItems.Where(li => !li.IsDeleted))
            .FirstOrDefaultAsync(s => s.Id == sovId && !s.IsDeleted, ct);

        if (sov is null)
            return Result.Failure<SOVLineItemDto>("Schedule of values not found", "NOT_FOUND");

        // Check duplicate item number
        if (sov.LineItems.Any(li => li.ItemNumber == command.ItemNumber))
            return Result.Failure<SOVLineItemDto>($"Item number '{command.ItemNumber}' already exists", "DUPLICATE");

        var sortOrder = command.SortOrder ?? (sov.LineItems.Count > 0 ? sov.LineItems.Max(li => li.SortOrder) + 1 : 1);

        var lineItem = new SOVLineItem
        {
            ScheduleOfValuesId = sovId,
            ItemNumber = command.ItemNumber,
            Description = command.Description,
            ScheduledValue = command.ScheduledValue,
            PreviouslyBilled = command.PreviouslyBilled,
            CurrentBilled = command.CurrentBilled,
            StoredMaterials = command.StoredMaterials,
            Retainage = command.Retainage,
            SortOrder = sortOrder
        };

        db.Set<SOVLineItem>().Add(lineItem);

        // Recalculate SOV total
        sov.TotalScheduledValue = sov.LineItems.Sum(li => li.ScheduledValue) + command.ScheduledValue;
        await db.SaveChangesAsync(ct);

        return Result.Success(MapLineItemToDto(lineItem));
    }

    public async Task<Result<SOVLineItemDto>> UpdateLineItemAsync(Guid sovId, Guid lineItemId, UpdateSOVLineItemCommand command, CancellationToken ct = default)
    {
        var sov = await db.Set<ScheduleOfValues>()
            .Include(s => s.LineItems.Where(li => !li.IsDeleted))
            .FirstOrDefaultAsync(s => s.Id == sovId && !s.IsDeleted, ct);

        if (sov is null)
            return Result.Failure<SOVLineItemDto>("Schedule of values not found", "NOT_FOUND");

        var lineItem = sov.LineItems.FirstOrDefault(li => li.Id == lineItemId);
        if (lineItem is null)
            return Result.Failure<SOVLineItemDto>("Line item not found", "NOT_FOUND");

        // Check duplicate item number if changing
        if (command.ItemNumber is not null && command.ItemNumber != lineItem.ItemNumber
            && sov.LineItems.Any(li => li.ItemNumber == command.ItemNumber && li.Id != lineItemId))
            return Result.Failure<SOVLineItemDto>($"Item number '{command.ItemNumber}' already exists", "DUPLICATE");

        if (command.ItemNumber is not null) lineItem.ItemNumber = command.ItemNumber;
        if (command.Description is not null) lineItem.Description = command.Description;
        if (command.ScheduledValue.HasValue) lineItem.ScheduledValue = command.ScheduledValue.Value;
        if (command.PreviouslyBilled.HasValue) lineItem.PreviouslyBilled = command.PreviouslyBilled.Value;
        if (command.CurrentBilled.HasValue) lineItem.CurrentBilled = command.CurrentBilled.Value;
        if (command.StoredMaterials.HasValue) lineItem.StoredMaterials = command.StoredMaterials.Value;
        if (command.Retainage.HasValue) lineItem.Retainage = command.Retainage.Value;
        if (command.SortOrder.HasValue) lineItem.SortOrder = command.SortOrder.Value;

        // Recalculate SOV total
        sov.TotalScheduledValue = sov.LineItems.Sum(li => li.ScheduledValue);
        await db.SaveChangesAsync(ct);

        return Result.Success(MapLineItemToDto(lineItem));
    }

    public async Task<Result> DeleteLineItemAsync(Guid sovId, Guid lineItemId, CancellationToken ct = default)
    {
        var sov = await db.Set<ScheduleOfValues>()
            .Include(s => s.LineItems.Where(li => !li.IsDeleted))
            .FirstOrDefaultAsync(s => s.Id == sovId && !s.IsDeleted, ct);

        if (sov is null)
            return Result.Failure("Schedule of values not found", "NOT_FOUND");

        var lineItem = sov.LineItems.FirstOrDefault(li => li.Id == lineItemId);
        if (lineItem is null)
            return Result.Failure("Line item not found", "NOT_FOUND");

        lineItem.IsDeleted = true;
        lineItem.DeletedAt = DateTime.UtcNow;

        // Recalculate SOV total
        sov.TotalScheduledValue = sov.LineItems.Where(li => li.Id != lineItemId).Sum(li => li.ScheduledValue);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }

    public async Task<Result> ReorderLineItemsAsync(Guid sovId, ReorderSOVLineItemsCommand command, CancellationToken ct = default)
    {
        var sov = await db.Set<ScheduleOfValues>()
            .Include(s => s.LineItems.Where(li => !li.IsDeleted))
            .FirstOrDefaultAsync(s => s.Id == sovId && !s.IsDeleted, ct);

        if (sov is null)
            return Result.Failure("Schedule of values not found", "NOT_FOUND");

        for (var i = 0; i < command.LineItemIds.Count; i++)
        {
            var lineItem = sov.LineItems.FirstOrDefault(li => li.Id == command.LineItemIds[i]);
            if (lineItem is not null)
                lineItem.SortOrder = i + 1;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static SOVDto MapToDto(ScheduleOfValues sov) => new(
        sov.Id,
        sov.SubcontractId,
        sov.Name,
        sov.TotalScheduledValue,
        sov.Status,
        sov.RetainagePercent,
        sov.CreatedAt,
        sov.UpdatedAt,
        sov.LineItems.OrderBy(li => li.SortOrder).Select(MapLineItemToDto).ToList()
    );

    private static SOVLineItemDto MapLineItemToDto(SOVLineItem li) => new(
        li.Id,
        li.ScheduleOfValuesId,
        li.ItemNumber,
        li.Description,
        li.ScheduledValue,
        li.PreviouslyBilled,
        li.CurrentBilled,
        li.StoredMaterials,
        li.TotalCompletedToDate,
        li.PercentComplete,
        li.BalanceToFinish,
        li.Retainage,
        li.SortOrder
    );
}
