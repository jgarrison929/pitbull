using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class BillingPeriodService(PitbullDbContext db, ILogger<BillingPeriodService> logger) : IBillingPeriodService
{
    private readonly ILogger<BillingPeriodService> _logger = logger;
    public async Task<Result<ListBillingPeriodsResult>> ListAsync(ListBillingPeriodsQuery query, CancellationToken ct = default)
    {
        IQueryable<BillingPeriod> q = db.Set<BillingPeriod>().AsNoTracking();

        if (query.Status.HasValue) q = q.Where(p => p.Status == query.Status.Value);

        int totalCount = await q.CountAsync(ct);
        int page = Math.Max(query.Page, 1);
        int pageSize = Math.Clamp(query.PageSize, 1, 100);

        List<BillingPeriod> items = await q
            .OrderByDescending(p => p.PeriodStart)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(new ListBillingPeriodsResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount, Page: page, PageSize: pageSize,
            TotalPages: (int)Math.Ceiling((double)totalCount / pageSize)));
    }

    public async Task<Result<BillingPeriodDto>> GetAsync(Guid id, CancellationToken ct = default)
    {
        var period = await db.Set<BillingPeriod>().AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (period is null) return Result.Failure<BillingPeriodDto>("Billing period not found", "NOT_FOUND");
        return Result.Success(MapToDto(period));
    }

    public async Task<Result<BillingPeriodDto>> CreateAsync(CreateBillingPeriodCommand cmd, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(cmd.Name))
            return Result.Failure<BillingPeriodDto>("Period name is required", "VALIDATION_ERROR");
        if (cmd.PeriodEnd <= cmd.PeriodStart)
            return Result.Failure<BillingPeriodDto>("Period end must be after period start", "VALIDATION_ERROR");
        if (cmd.BillingDeadlineDay < 1 || cmd.BillingDeadlineDay > 31)
            return Result.Failure<BillingPeriodDto>("Billing deadline day must be between 1 and 31", "VALIDATION_ERROR");

        bool overlap = await db.Set<BillingPeriod>().AnyAsync(
            p => p.PeriodStart <= cmd.PeriodEnd && p.PeriodEnd >= cmd.PeriodStart, ct);
        if (overlap)
            return Result.Failure<BillingPeriodDto>("Period overlaps with an existing billing period", "OVERLAP");

        BillingPeriod period = new()
        {
            Name = cmd.Name.Trim(),
            PeriodStart = cmd.PeriodStart,
            PeriodEnd = cmd.PeriodEnd,
            BillingDeadlineDay = cmd.BillingDeadlineDay,
            Notes = cmd.Notes
        };

        db.Set<BillingPeriod>().Add(period);
        await db.SaveChangesAsync(ct);
        return Result.Success(MapToDto(period));
    }

    public async Task<Result<BillingPeriodDto>> UpdateAsync(UpdateBillingPeriodCommand cmd, CancellationToken ct = default)
    {
        var period = await db.Set<BillingPeriod>().FirstOrDefaultAsync(p => p.Id == cmd.PeriodId, ct);
        if (period is null) return Result.Failure<BillingPeriodDto>("Billing period not found", "NOT_FOUND");

        if (cmd.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(cmd.Name))
                return Result.Failure<BillingPeriodDto>("Period name cannot be empty", "VALIDATION_ERROR");
            period.Name = cmd.Name.Trim();
        }
        if (cmd.BillingDeadlineDay.HasValue)
        {
            if (cmd.BillingDeadlineDay.Value < 1 || cmd.BillingDeadlineDay.Value > 31)
                return Result.Failure<BillingPeriodDto>("Billing deadline day must be between 1 and 31", "VALIDATION_ERROR");
            period.BillingDeadlineDay = cmd.BillingDeadlineDay.Value;
        }
        if (cmd.Status.HasValue) period.Status = cmd.Status.Value;
        if (cmd.Notes is not null) period.Notes = cmd.Notes;

        await db.SaveChangesAsync(ct);
        return Result.Success(MapToDto(period));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var period = await db.Set<BillingPeriod>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (period is null) return Result.Failure("Billing period not found", "NOT_FOUND");

        period.IsDeleted = true;
        period.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static BillingPeriodDto MapToDto(BillingPeriod p) => new(
        p.Id, p.Name, p.PeriodStart, p.PeriodEnd,
        p.BillingDeadlineDay, p.Status, p.Notes, p.CreatedAt);
}
