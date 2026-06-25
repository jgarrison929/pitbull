using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Domain;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Services;

namespace Pitbull.Billing.Services;

public class BillingApplicationService(
    PitbullDbContext db,
    ILogger<BillingApplicationService> logger,
    IWorkflowTransitionService? workflowTransitions = null) : IBillingApplicationService
{
    private readonly ILogger<BillingApplicationService> _logger = logger;
    public async Task<Result<ListBillingApplicationsResult>> ListAsync(ListBillingApplicationsQuery query, CancellationToken ct = default)
    {
        IQueryable<BillingApplication> q = db.Set<BillingApplication>().AsNoTracking();

        if (query.ProjectId.HasValue) q = q.Where(a => a.ProjectId == query.ProjectId.Value);
        if (query.OwnerContractId.HasValue) q = q.Where(a => a.OwnerContractId == query.OwnerContractId.Value);
        if (query.Status.HasValue) q = q.Where(a => a.Status == query.Status.Value);

        int totalCount = await q.CountAsync(ct);
        int page = Math.Max(query.Page, 1);
        int pageSize = Math.Clamp(query.PageSize, 1, 100);

        List<BillingApplication> items = await q
            .OrderByDescending(a => a.ApplicationNumber)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(new ListBillingApplicationsResult(
            Items: items.Select(a => MapToDto(a, null)).ToList(),
            TotalCount: totalCount, Page: page, PageSize: pageSize,
            TotalPages: (int)Math.Ceiling((double)totalCount / pageSize)));
    }

    public async Task<Result<BillingApplicationDto>> GetAsync(Guid id, CancellationToken ct = default)
    {
        var app = await db.Set<BillingApplication>().AsNoTracking()
            .Include(a => a.LineItems.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(a => a.Id == id, ct);

        if (app is null) return Result.Failure<BillingApplicationDto>("Billing application not found", "NOT_FOUND");
        return Result.Success(MapToDto(app, app.LineItems.Select(MapLineToDto).ToList()));
    }

    public async Task<Result<BillingApplicationDto>> CreateAsync(CreateBillingApplicationCommand cmd, CancellationToken ct = default)
    {
        // Validate period dates
        if (cmd.PeriodThrough < cmd.PeriodFrom)
            return Result.Failure<BillingApplicationDto>(
                "Period through date cannot be before period from date", "VALIDATION_ERROR");

        // Validate SOV exists and is active
        var sov = await db.Set<OwnerScheduleOfValues>().AsNoTracking()
            .Include(s => s.LineItems.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(s => s.Id == cmd.OwnerScheduleOfValuesId, ct);
        if (sov is null) return Result.Failure<BillingApplicationDto>("Schedule of Values not found", "NOT_FOUND");
        if (sov.Status != OwnerSOVStatus.Active && sov.Status != OwnerSOVStatus.Locked)
            return Result.Failure<BillingApplicationDto>("SOV must be Active or Locked to create a billing application", "INVALID_STATUS");

        var contract = await db.Set<OwnerContract>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == cmd.OwnerContractId, ct);
        if (contract is null) return Result.Failure<BillingApplicationDto>("Owner contract not found", "NOT_FOUND");

        // Determine next application number
        int lastAppNumber = await db.Set<BillingApplication>()
            .Where(a => a.OwnerContractId == cmd.OwnerContractId)
            .MaxAsync(a => (int?)a.ApplicationNumber, ct) ?? 0;
        int nextNumber = lastAppNumber + 1;

        // Get prior non-voided application for carry-forward
        BillingApplication? priorApp = null;
        List<BillingApplicationLineItem>? priorLines = null;
        if (lastAppNumber > 0)
        {
            priorApp = await db.Set<BillingApplication>().AsNoTracking()
                .Include(a => a.LineItems)
                .Where(a => a.OwnerContractId == cmd.OwnerContractId && a.Status != BillingApplicationStatus.Void)
                .OrderByDescending(a => a.ApplicationNumber)
                .FirstOrDefaultAsync(ct);
            priorLines = priorApp?.LineItems.ToList();
        }

        // Create billing application
        BillingApplication app = new()
        {
            ProjectId = contract.ProjectId,
            OwnerContractId = cmd.OwnerContractId,
            OwnerScheduleOfValuesId = cmd.OwnerScheduleOfValuesId,
            ApplicationNumber = nextNumber,
            PeriodFrom = cmd.PeriodFrom,
            PeriodThrough = cmd.PeriodThrough,
            ApplicationDate = cmd.ApplicationDate,
            OriginalContractSum = contract.OriginalContractSum,
            NetChangeByChangeOrders = contract.ApprovedChangeOrderAmount,
            ContractSumToDate = contract.ContractSumToDate,
            RetainagePercentWork = contract.DefaultRetainagePercent,
            RetainagePercentMaterials = contract.RetainagePercentMaterials,
            Status = BillingApplicationStatus.Draft
        };

        // Create line items from SOV with carry-forward
        List<BillingApplicationLineItem> lineItems = [];
        foreach (var sovLine in sov.LineItems.OrderBy(l => l.SortOrder))
        {
            var priorLine = priorLines?.FirstOrDefault(pl => pl.OwnerSOVLineItemId == sovLine.Id);

            var lineItem = new BillingApplicationLineItem
            {
                BillingApplicationId = app.Id,
                OwnerSOVLineItemId = sovLine.Id,
                ItemNumber = sovLine.ItemNumber,
                Description = sovLine.Description,
                ScheduledValue = sovLine.ScheduledValue,
                SortOrder = sovLine.SortOrder,
                // G703 Column D = prior Column G (TotalCompletedAndStored = D + E + F)
                WorkCompletedPrevious = priorLine?.TotalCompletedAndStored ?? 0,
                MaterialsStoredToDate = priorLine?.MaterialsStoredToDate ?? 0,
                RetainagePercent = sovLine.RetainagePercent,
                CostCodeId = sovLine.CostCodeId
            };

            CalculateLineItem(lineItem, app);
            lineItems.Add(lineItem);
        }

        app.LineItems = lineItems;
        CalculateG702(app, lineItems);

        // Set previous certificates from prior app
        app.LessPreviousCertificates = priorApp?.TotalEarnedLessRetainage ?? 0;
        app.CurrentPaymentDue = app.TotalEarnedLessRetainage - app.LessPreviousCertificates;
        app.BalanceToFinishIncludingRetainage = app.ContractSumToDate - app.TotalEarnedLessRetainage;

        db.Set<BillingApplication>().Add(app);
        await db.SaveChangesAsync(ct);

        return Result.Success(MapToDto(app, lineItems.Select(MapLineToDto).ToList()));
    }

    public async Task<Result<BillingApplicationDto>> RecalculateAsync(Guid billingApplicationId, CancellationToken ct = default)
    {
        var app = await db.Set<BillingApplication>()
            .Include(a => a.LineItems.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(a => a.Id == billingApplicationId, ct);

        if (app is null) return Result.Failure<BillingApplicationDto>("Billing application not found", "NOT_FOUND");
        if (app.Status != BillingApplicationStatus.Draft)
            return Result.Failure<BillingApplicationDto>("Only draft applications can be recalculated", "INVALID_STATUS");

        var lines = app.LineItems.ToList();
        foreach (var line in lines)
            CalculateLineItem(line, app);

        CalculateG702(app, lines);

        // Get previous non-voided certificates
        var priorApp = await db.Set<BillingApplication>().AsNoTracking()
            .Where(a => a.OwnerContractId == app.OwnerContractId
                        && a.ApplicationNumber < app.ApplicationNumber
                        && a.Status != BillingApplicationStatus.Void)
            .OrderByDescending(a => a.ApplicationNumber)
            .FirstOrDefaultAsync(ct);
        app.LessPreviousCertificates = priorApp?.TotalEarnedLessRetainage ?? 0;
        app.CurrentPaymentDue = app.TotalEarnedLessRetainage - app.LessPreviousCertificates;
        app.BalanceToFinishIncludingRetainage = app.ContractSumToDate - app.TotalEarnedLessRetainage;

        await db.SaveChangesAsync(ct);
        return Result.Success(MapToDto(app, lines.Select(MapLineToDto).ToList()));
    }

    public async Task<Result<BillingApplicationLineItemDto>> UpdateLineAsync(UpdateBillingApplicationLineCommand cmd, CancellationToken ct = default)
    {
        var app = await db.Set<BillingApplication>().FirstOrDefaultAsync(a => a.Id == cmd.BillingApplicationId, ct);
        if (app is null) return Result.Failure<BillingApplicationLineItemDto>("Billing application not found", "NOT_FOUND");
        if (app.Status != BillingApplicationStatus.Draft)
            return Result.Failure<BillingApplicationLineItemDto>("Only draft applications can be modified", "INVALID_STATUS");

        var line = await db.Set<BillingApplicationLineItem>()
            .FirstOrDefaultAsync(l => l.Id == cmd.LineItemId && l.BillingApplicationId == cmd.BillingApplicationId, ct);
        if (line is null) return Result.Failure<BillingApplicationLineItemDto>("Line item not found", "NOT_FOUND");

        if (cmd.WorkCompletedThisPeriod < 0)
            return Result.Failure<BillingApplicationLineItemDto>("Work completed this period cannot be negative", "VALIDATION_ERROR");

        line.WorkCompletedThisPeriod = cmd.WorkCompletedThisPeriod;
        line.MaterialsStoredToDate = cmd.MaterialsStoredToDate;
        CalculateLineItem(line, app);

        decimal totalCompleted = line.TotalCompletedAndStored;
        if (totalCompleted > line.ScheduledValue)
            return Result.Failure<BillingApplicationLineItemDto>(
                $"Line {line.ItemNumber} total ({totalCompleted:C2}) exceeds scheduled value ({line.ScheduledValue:C2})", "EXCEEDS_SCHEDULED");

        // Recalculate G702 header totals so they stay in sync with the updated line
        var allLines = await db.Set<BillingApplicationLineItem>()
            .Where(l => l.BillingApplicationId == app.Id)
            .ToListAsync(ct);
        CalculateG702(app, allLines);

        // Recalculate current payment due
        var priorApp = await db.Set<BillingApplication>().AsNoTracking()
            .Where(a => a.OwnerContractId == app.OwnerContractId
                        && a.ApplicationNumber < app.ApplicationNumber
                        && a.Status != BillingApplicationStatus.Void)
            .OrderByDescending(a => a.ApplicationNumber)
            .FirstOrDefaultAsync(ct);
        app.LessPreviousCertificates = priorApp?.TotalEarnedLessRetainage ?? 0;
        app.CurrentPaymentDue = app.TotalEarnedLessRetainage - app.LessPreviousCertificates;
        app.BalanceToFinishIncludingRetainage = app.ContractSumToDate - app.TotalEarnedLessRetainage;

        await db.SaveChangesAsync(ct);
        return Result.Success(MapLineToDto(line));
    }

    public async Task<Result<BillingApplicationDto>> BulkUpdateLinesAsync(BulkUpdateBillingLinesCommand cmd, CancellationToken ct = default)
    {
        var app = await db.Set<BillingApplication>()
            .Include(a => a.LineItems.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(a => a.Id == cmd.BillingApplicationId, ct);

        if (app is null) return Result.Failure<BillingApplicationDto>("Billing application not found", "NOT_FOUND");
        if (app.Status != BillingApplicationStatus.Draft)
            return Result.Failure<BillingApplicationDto>("Only draft applications can be modified", "INVALID_STATUS");

        var lines = app.LineItems.ToList();
        foreach (var update in cmd.Lines)
        {
            var line = lines.FirstOrDefault(l => l.Id == update.LineItemId);
            if (line is null) continue;

            if (update.WorkCompletedThisPeriod < 0)
                return Result.Failure<BillingApplicationDto>($"Work completed cannot be negative on line {line.ItemNumber}", "VALIDATION_ERROR");

            line.WorkCompletedThisPeriod = update.WorkCompletedThisPeriod;
            line.MaterialsStoredToDate = update.MaterialsStoredToDate;
            CalculateLineItem(line, app);

            if (line.TotalCompletedAndStored > line.ScheduledValue)
                return Result.Failure<BillingApplicationDto>(
                    $"Line {line.ItemNumber} total ({line.TotalCompletedAndStored:C2}) exceeds scheduled value ({line.ScheduledValue:C2})", "EXCEEDS_SCHEDULED");
        }

        CalculateG702(app, lines);

        var priorApp = await db.Set<BillingApplication>().AsNoTracking()
            .Where(a => a.OwnerContractId == app.OwnerContractId
                        && a.ApplicationNumber < app.ApplicationNumber
                        && a.Status != BillingApplicationStatus.Void)
            .OrderByDescending(a => a.ApplicationNumber)
            .FirstOrDefaultAsync(ct);
        app.LessPreviousCertificates = priorApp?.TotalEarnedLessRetainage ?? 0;
        app.CurrentPaymentDue = app.TotalEarnedLessRetainage - app.LessPreviousCertificates;
        app.BalanceToFinishIncludingRetainage = app.ContractSumToDate - app.TotalEarnedLessRetainage;

        await db.SaveChangesAsync(ct);
        return Result.Success(MapToDto(app, lines.Select(MapLineToDto).ToList()));
    }

    // ── Workflow ──

    public Task<Result<BillingApplicationDto>> SubmitForReviewAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.PmReview, ct);

    public Task<Result<BillingApplicationDto>> ApproveReviewAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.ReadyToSubmit, ct);

    public async Task<Result<BillingApplicationDto>> RejectReviewAsync(Guid id, string? comments, CancellationToken ct = default)
    {
        var result = await ApplyTransitionAsync(id, BillingApplicationStatus.PmRejected, ct);
        if (result.IsSuccess && comments is not null)
        {
            var app = await db.Set<BillingApplication>().FirstOrDefaultAsync(a => a.Id == id, ct);
            if (app is not null)
            {
                app.InternalNotes = string.IsNullOrWhiteSpace(app.InternalNotes)
                    ? $"Rejection: {comments}"
                    : $"{app.InternalNotes}\nRejection: {comments}";
                await db.SaveChangesAsync(ct);
            }
        }
        return result;
    }

    public Task<Result<BillingApplicationDto>> ReturnToDraftAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.Draft, ct);

    public Task<Result<BillingApplicationDto>> SubmitToOwnerAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.SubmittedToOwner, ct);

    public Task<Result<BillingApplicationDto>> MarkArchitectCertifiedAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.ArchitectCertified, ct);

    public Task<Result<BillingApplicationDto>> MarkDisputedAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.Disputed, ct);

    public Task<Result<BillingApplicationDto>> ResolveDisputeAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.SubmittedToOwner, ct);

    public Task<Result<BillingApplicationDto>> MarkPaymentDueAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.PaymentDue, ct);

    public Task<Result<BillingApplicationDto>> MarkPartiallyPaidAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.PartiallyPaid, ct);

    public Task<Result<BillingApplicationDto>> MarkPaidAsync(Guid id, CancellationToken ct = default)
        => ApplyTransitionAsync(id, BillingApplicationStatus.Paid, ct);

    public async Task<Result<BillingApplicationDto>> VoidAsync(Guid id, CancellationToken ct = default)
    {
        var app = await db.Set<BillingApplication>()
            .Include(a => a.LineItems.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (app is null) return Result.Failure<BillingApplicationDto>("Billing application not found", "NOT_FOUND");
        if (app.Status == BillingApplicationStatus.Paid)
            return Result.Failure<BillingApplicationDto>("Cannot void a paid billing application", "INVALID_STATUS");

        var fromStatus = app.Status;
        app.Status = BillingApplicationStatus.Void;
        await db.SaveChangesAsync(ct);

        await RecordTransitionAsync(app.Id, fromStatus, BillingApplicationStatus.Void, null, ct);
        return Result.Success(MapToDto(app, app.LineItems.Select(MapLineToDto).ToList()));
    }

    // ── Calculation Engine ──

    private static void CalculateLineItem(BillingApplicationLineItem line, BillingApplication app)
    {
        // G703 Column G = D + E + F
        line.TotalCompletedAndStored = line.WorkCompletedPrevious + line.WorkCompletedThisPeriod + line.MaterialsStoredToDate;

        // G703 Column H = G / C (capped at 100%)
        line.PercentComplete = line.ScheduledValue != 0
            ? Math.Min(Math.Round(line.TotalCompletedAndStored / line.ScheduledValue * 100, 2), 100m)
            : 0;

        // G703 Column I = C - G
        line.BalanceToFinish = line.ScheduledValue - line.TotalCompletedAndStored;

        // Retainage
        decimal rate = line.RetainagePercent ?? app.RetainagePercentWork;
        line.RetainageAmount = Math.Round(line.TotalCompletedAndStored * rate / 100, 2);
    }

    private static void CalculateG702(BillingApplication app, List<BillingApplicationLineItem> lines)
    {
        // Line 4: Total completed and stored (sum of G703 Column G)
        app.TotalCompletedAndStoredToDate = lines.Sum(l => l.TotalCompletedAndStored);

        // Line 5: Retainage
        decimal completedWork = lines.Sum(l => l.WorkCompletedPrevious + l.WorkCompletedThisPeriod);
        decimal storedMaterials = lines.Sum(l => l.MaterialsStoredToDate);

        app.RetainageOnCompletedWork = lines.Sum(l =>
        {
            decimal rate = l.RetainagePercent ?? app.RetainagePercentWork;
            return Math.Round((l.WorkCompletedPrevious + l.WorkCompletedThisPeriod) * rate / 100, 2);
        });

        app.RetainageOnStoredMaterials = lines.Sum(l =>
            Math.Round(l.MaterialsStoredToDate * app.RetainagePercentMaterials / 100, 2));

        app.TotalRetainage = app.RetainageOnCompletedWork + app.RetainageOnStoredMaterials;

        // Line 6: Total earned less retainage
        app.TotalEarnedLessRetainage = app.TotalCompletedAndStoredToDate - app.TotalRetainage;
    }

    private async Task<Result<BillingApplicationDto>> ApplyTransitionAsync(
        Guid id, BillingApplicationStatus newStatus, CancellationToken ct)
    {
        var app = await db.Set<BillingApplication>()
            .Include(a => a.LineItems.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(a => a.Id == id, ct);

        if (app is null) return Result.Failure<BillingApplicationDto>("Billing application not found", "NOT_FOUND");

        var fromStatus = app.Status;
        if (!BillingApplicationStatusTransitions.IsValid(fromStatus, newStatus))
            return Result.Failure<BillingApplicationDto>(
                $"Cannot transition billing application from {fromStatus} to {newStatus}",
                "INVALID_STATUS_TRANSITION");

        app.Status = newStatus;
        await db.SaveChangesAsync(ct);

        await RecordTransitionAsync(app.Id, fromStatus, newStatus, null, ct);
        return Result.Success(MapToDto(app, app.LineItems.Select(MapLineToDto).ToList()));
    }

    private async Task RecordTransitionAsync(
        Guid entityId,
        BillingApplicationStatus fromStatus,
        BillingApplicationStatus toStatus,
        string? comment,
        CancellationToken ct)
    {
        if (workflowTransitions is null || fromStatus == toStatus)
            return;

        await workflowTransitions.RecordTransitionAsync(
            "BillingApplication", entityId,
            fromStatus.ToString(), toStatus.ToString(),
            Guid.Empty, null, comment, ct);
    }

    // ── Mappers ──

    private static BillingApplicationDto MapToDto(BillingApplication a, IReadOnlyList<BillingApplicationLineItemDto>? lines) => new(
        a.Id, a.ProjectId, a.OwnerContractId, a.OwnerScheduleOfValuesId,
        a.ApplicationNumber, a.PeriodFrom, a.PeriodThrough, a.ApplicationDate,
        a.OriginalContractSum, a.NetChangeByChangeOrders, a.ContractSumToDate,
        a.TotalCompletedAndStoredToDate,
        a.RetainageOnCompletedWork, a.RetainageOnStoredMaterials, a.TotalRetainage,
        a.RetainagePercentWork, a.RetainagePercentMaterials,
        a.TotalEarnedLessRetainage, a.LessPreviousCertificates,
        a.CurrentPaymentDue, a.BalanceToFinishIncludingRetainage,
        a.Status, a.InternalNotes, a.BillingNarrative,
        a.CreatedAt, a.UpdatedAt, lines);

    private static BillingApplicationLineItemDto MapLineToDto(BillingApplicationLineItem l) => new(
        l.Id, l.OwnerSOVLineItemId, l.ItemNumber, l.Description, l.ScheduledValue,
        l.SortOrder, l.WorkCompletedPrevious, l.WorkCompletedThisPeriod,
        l.MaterialsStoredToDate, l.TotalCompletedAndStored, l.PercentComplete,
        l.BalanceToFinish, l.RetainagePercent, l.RetainageAmount);
}
