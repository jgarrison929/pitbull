using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class OwnerContractService(PitbullDbContext db, ILogger<OwnerContractService> logger) : IOwnerContractService
{
    // ── Owner Contracts ──

    public async Task<Result<ListOwnerContractsResult>> ListContractsAsync(ListOwnerContractsQuery query, CancellationToken ct = default)
    {
        IQueryable<OwnerContract> q = db.Set<OwnerContract>().AsNoTracking();

        if (query.ProjectId.HasValue) q = q.Where(c => c.ProjectId == query.ProjectId.Value);
        if (query.Status.HasValue) q = q.Where(c => c.Status == query.Status.Value);

        int totalCount = await q.CountAsync(ct);
        int page = Math.Max(query.Page, 1);
        int pageSize = Math.Clamp(query.PageSize, 1, 100);

        List<OwnerContract> items = await q
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(new ListOwnerContractsResult(
            Items: items.Select(MapContractToDto).ToList(),
            TotalCount: totalCount, Page: page, PageSize: pageSize,
            TotalPages: (int)Math.Ceiling((double)totalCount / pageSize)));
    }

    public async Task<Result<OwnerContractDto>> GetContractAsync(Guid id, CancellationToken ct = default)
    {
        var contract = await db.Set<OwnerContract>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (contract is null) return Result.Failure<OwnerContractDto>("Owner contract not found", "NOT_FOUND");
        return Result.Success(MapContractToDto(contract));
    }

    public async Task<Result<OwnerContractDto>> CreateContractAsync(CreateOwnerContractCommand cmd, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(cmd.ContractNumber))
            return Result.Failure<OwnerContractDto>("Contract number is required", "VALIDATION_ERROR");
        if (string.IsNullOrWhiteSpace(cmd.ProjectName))
            return Result.Failure<OwnerContractDto>("Project name is required", "VALIDATION_ERROR");
        if (cmd.OriginalContractSum <= 0)
            return Result.Failure<OwnerContractDto>("Original contract sum must be greater than zero", "VALIDATION_ERROR");
        if (cmd.DefaultRetainagePercent < 0 || cmd.DefaultRetainagePercent > 100)
            return Result.Failure<OwnerContractDto>("Retainage percent must be between 0 and 100", "VALIDATION_ERROR");

        bool duplicate = await db.Set<OwnerContract>()
            .AnyAsync(c => c.ContractNumber == cmd.ContractNumber.Trim(), ct);
        if (duplicate)
            return Result.Failure<OwnerContractDto>($"Contract number '{cmd.ContractNumber.Trim()}' already exists", "DUPLICATE");

        OwnerContract contract = new()
        {
            ProjectId = cmd.ProjectId,
            ContractNumber = cmd.ContractNumber.Trim(),
            ProjectName = cmd.ProjectName.Trim(),
            OwnerName = cmd.OwnerName?.Trim(),
            OwnerAddress = cmd.OwnerAddress?.Trim(),
            ArchitectName = cmd.ArchitectName?.Trim(),
            ArchitectProjectNumber = cmd.ArchitectProjectNumber?.Trim(),
            OriginalContractSum = cmd.OriginalContractSum,
            ApprovedChangeOrderAmount = 0,
            ContractSumToDate = cmd.OriginalContractSum,
            DefaultRetainagePercent = cmd.DefaultRetainagePercent,
            RetainagePercentMaterials = cmd.RetainagePercentMaterials,
            ContractDate = cmd.ContractDate,
            PaymentTermsDays = cmd.PaymentTermsDays
        };

        db.Set<OwnerContract>().Add(contract);
        await db.SaveChangesAsync(ct);
        return Result.Success(MapContractToDto(contract));
    }

    public async Task<Result<OwnerContractDto>> UpdateContractAsync(UpdateOwnerContractCommand cmd, CancellationToken ct = default)
    {
        var contract = await db.Set<OwnerContract>().FirstOrDefaultAsync(c => c.Id == cmd.ContractId, ct);
        if (contract is null) return Result.Failure<OwnerContractDto>("Owner contract not found", "NOT_FOUND");

        if (cmd.ContractNumber is not null)
        {
            if (string.IsNullOrWhiteSpace(cmd.ContractNumber))
                return Result.Failure<OwnerContractDto>("Contract number cannot be empty", "VALIDATION_ERROR");
            bool dup = await db.Set<OwnerContract>().AnyAsync(c => c.ContractNumber == cmd.ContractNumber.Trim() && c.Id != cmd.ContractId, ct);
            if (dup) return Result.Failure<OwnerContractDto>($"Contract number '{cmd.ContractNumber.Trim()}' already exists", "DUPLICATE");
            contract.ContractNumber = cmd.ContractNumber.Trim();
        }
        if (cmd.ProjectName is not null) contract.ProjectName = cmd.ProjectName.Trim();
        if (cmd.OwnerName is not null) contract.OwnerName = cmd.OwnerName.Trim();
        if (cmd.OwnerAddress is not null) contract.OwnerAddress = cmd.OwnerAddress.Trim();
        if (cmd.ArchitectName is not null) contract.ArchitectName = cmd.ArchitectName.Trim();
        if (cmd.OriginalContractSum.HasValue)
        {
            contract.OriginalContractSum = cmd.OriginalContractSum.Value;
            contract.ContractSumToDate = cmd.OriginalContractSum.Value + contract.ApprovedChangeOrderAmount;
        }
        if (cmd.DefaultRetainagePercent.HasValue) contract.DefaultRetainagePercent = cmd.DefaultRetainagePercent.Value;
        if (cmd.RetainagePercentMaterials.HasValue) contract.RetainagePercentMaterials = cmd.RetainagePercentMaterials.Value;
        if (cmd.ContractDate.HasValue) contract.ContractDate = cmd.ContractDate.Value;
        if (cmd.PaymentTermsDays.HasValue) contract.PaymentTermsDays = cmd.PaymentTermsDays.Value;

        await db.SaveChangesAsync(ct);
        return Result.Success(MapContractToDto(contract));
    }

    public async Task<Result> DeleteContractAsync(Guid id, CancellationToken ct = default)
    {
        var contract = await db.Set<OwnerContract>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (contract is null) return Result.Failure("Owner contract not found", "NOT_FOUND");

        bool hasBillings = await db.Set<BillingApplication>().AnyAsync(a => a.OwnerContractId == id, ct);
        if (hasBillings) return Result.Failure("Cannot delete contract with existing billing applications", "HAS_BILLINGS");

        contract.IsDeleted = true;
        contract.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ── Owner SOV ──

    public async Task<Result<OwnerSOVDto>> GetSOVAsync(Guid ownerContractId, CancellationToken ct = default)
    {
        var sov = await db.Set<OwnerScheduleOfValues>().AsNoTracking()
            .Include(s => s.LineItems.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(s => s.OwnerContractId == ownerContractId, ct);

        if (sov is null) return Result.Failure<OwnerSOVDto>("Schedule of Values not found", "NOT_FOUND");
        return Result.Success(MapSOVToDto(sov, includeLines: true));
    }

    public async Task<Result<OwnerSOVDto>> CreateSOVAsync(CreateOwnerSOVCommand cmd, CancellationToken ct = default)
    {
        var contract = await db.Set<OwnerContract>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == cmd.OwnerContractId, ct);
        if (contract is null) return Result.Failure<OwnerSOVDto>("Owner contract not found", "NOT_FOUND");

        bool exists = await db.Set<OwnerScheduleOfValues>().AnyAsync(s => s.OwnerContractId == cmd.OwnerContractId, ct);
        if (exists) return Result.Failure<OwnerSOVDto>("A Schedule of Values already exists for this contract", "DUPLICATE");

        OwnerScheduleOfValues sov = new()
        {
            ProjectId = contract.ProjectId,
            OwnerContractId = cmd.OwnerContractId,
            Name = cmd.Name,
            OriginalContractAmount = contract.OriginalContractSum,
            ApprovedChangeOrderAmount = contract.ApprovedChangeOrderAmount,
            RevisedContractAmount = contract.ContractSumToDate,
            DefaultRetainagePercent = contract.DefaultRetainagePercent
        };

        db.Set<OwnerScheduleOfValues>().Add(sov);
        await db.SaveChangesAsync(ct);
        return Result.Success(MapSOVToDto(sov, includeLines: true));
    }

    public async Task<Result<OwnerSOVDto>> ActivateSOVAsync(Guid sovId, CancellationToken ct = default)
    {
        var sov = await db.Set<OwnerScheduleOfValues>()
            .Include(s => s.LineItems)
            .FirstOrDefaultAsync(s => s.Id == sovId, ct);

        if (sov is null) return Result.Failure<OwnerSOVDto>("Schedule of Values not found", "NOT_FOUND");
        if (sov.Status != OwnerSOVStatus.Draft) return Result.Failure<OwnerSOVDto>("SOV can only be activated from Draft status", "INVALID_STATUS");
        if (!sov.LineItems.Any()) return Result.Failure<OwnerSOVDto>("SOV must have at least one line item", "VALIDATION_ERROR");

        decimal totalScheduled = sov.LineItems.Sum(l => l.ScheduledValue);
        if (totalScheduled != sov.RevisedContractAmount)
            return Result.Failure<OwnerSOVDto>($"SOV line items total ({totalScheduled:C2}) does not match contract amount ({sov.RevisedContractAmount:C2})", "UNBALANCED");

        sov.TotalScheduledValue = totalScheduled;
        sov.Status = OwnerSOVStatus.Active;
        await db.SaveChangesAsync(ct);
        return Result.Success(MapSOVToDto(sov, includeLines: true));
    }

    // ── SOV Line Items ──

    public async Task<Result<OwnerSOVLineItemDto>> AddLineItemAsync(AddSOVLineItemCommand cmd, CancellationToken ct = default)
    {
        var sov = await db.Set<OwnerScheduleOfValues>().FirstOrDefaultAsync(s => s.Id == cmd.OwnerSOVId, ct);
        if (sov is null) return Result.Failure<OwnerSOVLineItemDto>("Schedule of Values not found", "NOT_FOUND");
        if (sov.Status != OwnerSOVStatus.Draft) return Result.Failure<OwnerSOVLineItemDto>("Line items can only be added to Draft SOV", "INVALID_STATUS");
        if (string.IsNullOrWhiteSpace(cmd.ItemNumber)) return Result.Failure<OwnerSOVLineItemDto>("Item number is required", "VALIDATION_ERROR");
        if (string.IsNullOrWhiteSpace(cmd.Description)) return Result.Failure<OwnerSOVLineItemDto>("Description is required", "VALIDATION_ERROR");
        if (cmd.ScheduledValue < 0) return Result.Failure<OwnerSOVLineItemDto>("Scheduled value cannot be negative", "VALIDATION_ERROR");

        int nextSort = cmd.SortOrder > 0 ? cmd.SortOrder :
            (await db.Set<OwnerSOVLineItem>().Where(l => l.OwnerScheduleOfValuesId == sov.Id).MaxAsync(l => (int?)l.SortOrder, ct) ?? 0) + 1;

        OwnerSOVLineItem line = new()
        {
            OwnerScheduleOfValuesId = sov.Id,
            ItemNumber = cmd.ItemNumber.Trim(),
            Description = cmd.Description.Trim(),
            SortOrder = nextSort,
            OriginalValue = cmd.ScheduledValue,
            ScheduledValue = cmd.ScheduledValue,
            RetainagePercent = cmd.RetainagePercent,
            CostCodeId = cmd.CostCodeId,
            Notes = cmd.Notes
        };

        db.Set<OwnerSOVLineItem>().Add(line);
        sov.TotalScheduledValue = await db.Set<OwnerSOVLineItem>()
            .Where(l => l.OwnerScheduleOfValuesId == sov.Id).SumAsync(l => l.ScheduledValue, ct) + cmd.ScheduledValue;
        await db.SaveChangesAsync(ct);
        return Result.Success(MapLineToDto(line));
    }

    public async Task<Result<OwnerSOVLineItemDto>> UpdateLineItemAsync(UpdateSOVLineItemCommand cmd, CancellationToken ct = default)
    {
        var line = await db.Set<OwnerSOVLineItem>().FirstOrDefaultAsync(l => l.Id == cmd.LineItemId, ct);
        if (line is null) return Result.Failure<OwnerSOVLineItemDto>("Line item not found", "NOT_FOUND");

        var sov = await db.Set<OwnerScheduleOfValues>().FirstOrDefaultAsync(s => s.Id == line.OwnerScheduleOfValuesId, ct);
        if (sov is null || sov.Status != OwnerSOVStatus.Draft)
            return Result.Failure<OwnerSOVLineItemDto>("Line items can only be modified on Draft SOV", "INVALID_STATUS");

        if (cmd.ItemNumber is not null) line.ItemNumber = cmd.ItemNumber.Trim();
        if (cmd.Description is not null) line.Description = cmd.Description.Trim();
        if (cmd.ScheduledValue.HasValue)
        {
            line.OriginalValue = cmd.ScheduledValue.Value;
            line.ScheduledValue = cmd.ScheduledValue.Value;
        }
        if (cmd.SortOrder.HasValue) line.SortOrder = cmd.SortOrder.Value;
        if (cmd.RetainagePercent.HasValue) line.RetainagePercent = cmd.RetainagePercent.Value;
        if (cmd.Notes is not null) line.Notes = cmd.Notes;

        sov.TotalScheduledValue = await db.Set<OwnerSOVLineItem>()
            .Where(l => l.OwnerScheduleOfValuesId == sov.Id).SumAsync(l => l.ScheduledValue, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success(MapLineToDto(line));
    }

    public async Task<Result> DeleteLineItemAsync(Guid lineItemId, CancellationToken ct = default)
    {
        var line = await db.Set<OwnerSOVLineItem>().FirstOrDefaultAsync(l => l.Id == lineItemId, ct);
        if (line is null) return Result.Failure("Line item not found", "NOT_FOUND");

        var sov = await db.Set<OwnerScheduleOfValues>().FirstOrDefaultAsync(s => s.Id == line.OwnerScheduleOfValuesId, ct);
        if (sov is null || sov.Status != OwnerSOVStatus.Draft)
            return Result.Failure("Line items can only be deleted from Draft SOV", "INVALID_STATUS");

        line.IsDeleted = true;
        line.DeletedAt = DateTime.UtcNow;
        sov.TotalScheduledValue = await db.Set<OwnerSOVLineItem>()
            .Where(l => l.OwnerScheduleOfValuesId == sov.Id && l.Id != lineItemId).SumAsync(l => l.ScheduledValue, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ── Mappers ──

    private static OwnerContractDto MapContractToDto(OwnerContract c) => new(
        c.Id, c.ProjectId, c.ContractNumber, c.ProjectName, c.OwnerName, c.ArchitectName,
        c.OriginalContractSum, c.ApprovedChangeOrderAmount, c.ContractSumToDate,
        c.DefaultRetainagePercent, c.RetainagePercentMaterials, c.ContractDate,
        c.PaymentTermsDays, c.Status, c.CreatedAt, c.UpdatedAt);

    private static OwnerSOVDto MapSOVToDto(OwnerScheduleOfValues s, bool includeLines) => new(
        s.Id, s.ProjectId, s.OwnerContractId, s.Name,
        s.OriginalContractAmount, s.ApprovedChangeOrderAmount, s.RevisedContractAmount,
        s.TotalScheduledValue, s.DefaultRetainagePercent, s.Status, s.LockedDate, s.Notes,
        s.CreatedAt,
        includeLines ? s.LineItems.Select(MapLineToDto).ToList() : null);

    private static OwnerSOVLineItemDto MapLineToDto(OwnerSOVLineItem l) => new(
        l.Id, l.ItemNumber, l.Description, l.SortOrder,
        l.OriginalValue, l.ApprovedChangeOrderValue, l.ScheduledValue,
        l.RetainagePercent, l.CostCodeId, l.IsFromChangeOrder, l.Notes);
}
