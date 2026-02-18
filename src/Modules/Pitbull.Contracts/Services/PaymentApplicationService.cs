using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Services;

/// <summary>
/// Implementation of enhanced payment application operations for AIA G702/G703 workflow.
/// </summary>
public class PaymentApplicationService(PitbullDbContext db) : IPaymentApplicationService
{
    public async Task<Result<IReadOnlyList<PaymentApplicationLineItemDto>>> GetLineItemsAsync(
        Guid paymentApplicationId, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .AsNoTracking()
            .FirstOrDefaultAsync(pa => pa.Id == paymentApplicationId && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<IReadOnlyList<PaymentApplicationLineItemDto>>(
                "Payment application not found", "NOT_FOUND");

        var lineItems = await db.Set<PaymentApplicationLineItem>()
            .AsNoTracking()
            .Where(li => li.PaymentApplicationId == paymentApplicationId && !li.IsDeleted)
            .OrderBy(li => li.SortOrder)
            .ToListAsync(cancellationToken);

        var dtos = lineItems.Select(MapLineItemToDto).ToList();
        return Result.Success<IReadOnlyList<PaymentApplicationLineItemDto>>(dtos);
    }

    public async Task<Result<IReadOnlyList<PaymentApplicationLineItemDto>>> UpdateLineItemsAsync(
        Guid paymentApplicationId, UpdatePaymentApplicationLineItemsRequest request,
        CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == paymentApplicationId && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<IReadOnlyList<PaymentApplicationLineItemDto>>(
                "Payment application not found", "NOT_FOUND");

        var settings = await GetSettingsAsync(payApp.CompanyId, cancellationToken);
        var editableStatuses = settings.LockSubmittedLineItems
            ? new[] { PaymentApplicationStatus.Draft }
            : new[] { PaymentApplicationStatus.Draft, PaymentApplicationStatus.Submitted };

        if (!editableStatuses.Contains(payApp.Status))
            return Result.Failure<IReadOnlyList<PaymentApplicationLineItemDto>>(
                "Line items can only be edited on draft applications", "INVALID_STATUS");

        var existingItems = await db.Set<PaymentApplicationLineItem>()
            .Where(li => li.PaymentApplicationId == paymentApplicationId && !li.IsDeleted)
            .ToListAsync(cancellationToken);

        var existingBySOV = existingItems.ToDictionary(li => li.SOVLineItemId);

        foreach (var input in request.Items)
        {
            if (!existingBySOV.TryGetValue(input.SOVLineItemId, out var lineItem))
                continue;

            lineItem.WorkCompletedThisPeriod = input.WorkCompletedThisPeriod;
            lineItem.MaterialsStoredThisPeriod = input.MaterialsStoredThisPeriod;

            if (input.RetainagePercentOverride.HasValue)
                lineItem.RetainagePercent = input.RetainagePercentOverride.Value;

            if (request.RecalculateTotals)
                RecalculateLineItem(lineItem);
        }

        if (request.RecalculateTotals)
            RecalculatePayAppTotals(payApp, existingItems);

        await db.SaveChangesAsync(cancellationToken);

        var dtos = existingItems.OrderBy(li => li.SortOrder).Select(MapLineItemToDto).ToList();
        return Result.Success<IReadOnlyList<PaymentApplicationLineItemDto>>(dtos);
    }

    public async Task<Result<PaymentApplicationDetailDto>> SubmitAsync(
        Guid id, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == id && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDetailDto>("Payment application not found", "NOT_FOUND");

        if (payApp.Status != PaymentApplicationStatus.Draft)
            return Result.Failure<PaymentApplicationDetailDto>(
                "Only draft applications can be submitted", "INVALID_STATUS");

        var settings = await GetSettingsAsync(payApp.CompanyId, cancellationToken);

        if (settings.RequireSignedSubcontract)
        {
            var subcontract = await db.Set<Subcontract>()
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == payApp.SubcontractId && !s.IsDeleted, cancellationToken);

            if (subcontract?.ExecutionDate is null)
                return Result.Failure<PaymentApplicationDetailDto>(
                    "Subcontract must be signed (have an execution date) before submitting a payment application",
                    "UNSIGNED_SUBCONTRACT");
        }

        payApp.Status = PaymentApplicationStatus.Submitted;
        payApp.SubmittedDate = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(await BuildDetailDto(payApp, cancellationToken));
    }

    public async Task<Result<PaymentApplicationDetailDto>> ReviewAsync(
        Guid id, ReviewPaymentApplicationRequest request, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == id && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDetailDto>("Payment application not found", "NOT_FOUND");

        if (payApp.Status != PaymentApplicationStatus.Submitted)
            return Result.Failure<PaymentApplicationDetailDto>(
                "Only submitted applications can be reviewed", "INVALID_STATUS");

        payApp.Status = PaymentApplicationStatus.Reviewed;
        payApp.ReviewedBy = request.ReviewedBy;
        payApp.ReviewedNotes = request.Notes;
        payApp.ReviewedDate = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(await BuildDetailDto(payApp, cancellationToken));
    }

    public async Task<Result<PaymentApplicationDetailDto>> ApproveAsync(
        Guid id, ApprovePaymentApplicationRequest request, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == id && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDetailDto>("Payment application not found", "NOT_FOUND");

        var settings = await GetSettingsAsync(payApp.CompanyId, cancellationToken);
        var approvableStatuses = settings.EnableApprovalWorkflow
            ? new[] { PaymentApplicationStatus.Reviewed }
            : new[] { PaymentApplicationStatus.Submitted, PaymentApplicationStatus.Reviewed };

        if (!approvableStatuses.Contains(payApp.Status))
            return Result.Failure<PaymentApplicationDetailDto>(
                "Only reviewed applications can be approved", "INVALID_STATUS");

        payApp.Status = PaymentApplicationStatus.Approved;
        payApp.ApprovedBy = request.ApprovedBy;
        payApp.ApprovedAmount = request.ApprovedAmount ?? payApp.CurrentPaymentDue;
        payApp.ApprovedDate = DateTime.UtcNow;
        payApp.Notes = request.Notes ?? payApp.Notes;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(await BuildDetailDto(payApp, cancellationToken));
    }

    public async Task<Result<PaymentApplicationDetailDto>> RejectAsync(
        Guid id, RejectPaymentApplicationRequest request, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == id && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDetailDto>("Payment application not found", "NOT_FOUND");

        var rejectableStatuses = new[]
        {
            PaymentApplicationStatus.Submitted,
            PaymentApplicationStatus.Reviewed
        };

        if (!rejectableStatuses.Contains(payApp.Status))
            return Result.Failure<PaymentApplicationDetailDto>(
                "Only submitted or reviewed applications can be rejected", "INVALID_STATUS");

        payApp.Status = PaymentApplicationStatus.Rejected;
        payApp.RejectedBy = request.RejectedBy;
        payApp.RejectionReason = request.Reason;
        payApp.RejectedDate = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(await BuildDetailDto(payApp, cancellationToken));
    }

    public async Task<Result<PaymentApplicationDetailDto>> MarkPaidAsync(
        Guid id, MarkPaymentApplicationPaidRequest request, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == id && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDetailDto>("Payment application not found", "NOT_FOUND");

        if (payApp.Status != PaymentApplicationStatus.Approved)
            return Result.Failure<PaymentApplicationDetailDto>(
                "Only approved applications can be marked as paid", "INVALID_STATUS");

        var settings = await GetSettingsAsync(payApp.CompanyId, cancellationToken);

        if (settings.RequireLienWaiverBeforePaid)
        {
            // Lien waiver entity is not yet implemented - block payment until it is
            return Result.Failure<PaymentApplicationDetailDto>(
                "A lien waiver is required before marking as paid. Lien waiver tracking is not yet available.",
                "LIEN_WAIVER_REQUIRED");
        }

        payApp.Status = PaymentApplicationStatus.Paid;
        payApp.PaidAmount = request.PaidAmount;
        payApp.PaidDate = request.PaidDate;
        payApp.PaidReference = request.PaymentReference;
        payApp.CheckNumber = request.CheckNumber ?? payApp.CheckNumber;
        payApp.Notes = request.Notes ?? payApp.Notes;

        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == payApp.SubcontractId && !s.IsDeleted, cancellationToken);

        if (subcontract is not null)
        {
            subcontract.BilledToDate += payApp.CurrentPaymentDue;
            subcontract.PaidToDate += request.PaidAmount;
            subcontract.RetainageHeld = payApp.TotalRetainage;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(await BuildDetailDto(payApp, cancellationToken));
    }

    public async Task<Result<PaymentApplicationDetailDto>> CreateFromSovAsync(
        Guid sovId, CreatePaymentApplicationFromSovRequest request,
        CancellationToken cancellationToken = default)
    {
        var sov = await db.Set<ScheduleOfValues>()
            .Include(s => s.LineItems.Where(li => !li.IsDeleted))
            .FirstOrDefaultAsync(s => s.Id == sovId && !s.IsDeleted, cancellationToken);

        if (sov is null)
            return Result.Failure<PaymentApplicationDetailDto>("Schedule of values not found", "NOT_FOUND");

        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == sov.SubcontractId && !s.IsDeleted, cancellationToken);

        if (subcontract is null)
            return Result.Failure<PaymentApplicationDetailDto>("Subcontract not found", "NOT_FOUND");

        var previousApps = await db.Set<PaymentApplication>()
            .Where(pa => pa.SubcontractId == sov.SubcontractId && !pa.IsDeleted)
            .OrderByDescending(pa => pa.ApplicationNumber)
            .ToListAsync(cancellationToken);

        var lastApp = previousApps.FirstOrDefault();
        var nextNumber = (lastApp?.ApplicationNumber ?? 0) + 1;

        var previousLineItems = lastApp is not null
            ? await db.Set<PaymentApplicationLineItem>()
                .AsNoTracking()
                .Where(li => li.PaymentApplicationId == lastApp.Id && !li.IsDeleted)
                .ToListAsync(cancellationToken)
            : new List<PaymentApplicationLineItem>();

        var prevBySOV = previousLineItems.ToDictionary(li => li.SOVLineItemId);

        var payApp = new PaymentApplication
        {
            CompanyId = subcontract.CompanyId,
            SubcontractId = sov.SubcontractId,
            ScheduleOfValuesId = sovId,
            ApplicationNumber = nextNumber,
            PeriodStart = request.PeriodStart,
            PeriodEnd = request.PeriodEnd,
            ScheduledValue = subcontract.CurrentValue,
            RetainagePercent = sov.RetainagePercent,
            Status = PaymentApplicationStatus.Draft,
            InvoiceNumber = request.InvoiceNumber,
            Notes = request.Notes,
            WorkCompletedPrevious = lastApp?.WorkCompletedToDate ?? 0m,
            RetainagePrevious = lastApp?.TotalRetainage ?? 0m,
            LessPreviousCertificates = lastApp?.TotalEarnedLessRetainage ?? 0m
        };

        db.Set<PaymentApplication>().Add(payApp);

        var lineItems = new List<PaymentApplicationLineItem>();
        foreach (var sovItem in sov.LineItems.OrderBy(li => li.SortOrder))
        {
            prevBySOV.TryGetValue(sovItem.Id, out var prevLine);

            var lineItem = new PaymentApplicationLineItem
            {
                CompanyId = subcontract.CompanyId,
                PaymentApplicationId = payApp.Id,
                SOVLineItemId = sovItem.Id,
                ItemNumber = sovItem.ItemNumber,
                Description = sovItem.Description,
                ScheduledValue = sovItem.ScheduledValue,
                WorkCompletedPrevious = prevLine is not null
                    ? prevLine.TotalCompletedAndStoredToDate - (prevLine.MaterialsStoredToDate)
                    : 0m,
                WorkCompletedThisPeriod = 0m,
                MaterialsStoredPrevious = prevLine?.MaterialsStoredToDate ?? 0m,
                MaterialsStoredThisPeriod = 0m,
                MaterialsStoredToDate = prevLine?.MaterialsStoredToDate ?? 0m,
                TotalCompletedAndStoredToDate = prevLine?.TotalCompletedAndStoredToDate ?? 0m,
                PercentComplete = prevLine?.PercentComplete ?? 0m,
                BalanceToFinish = sovItem.ScheduledValue - (prevLine?.TotalCompletedAndStoredToDate ?? 0m),
                RetainagePercent = sov.RetainagePercent,
                RetainageAmount = 0m,
                SortOrder = sovItem.SortOrder
            };

            lineItems.Add(lineItem);
        }

        db.Set<PaymentApplicationLineItem>().AddRange(lineItems);
        RecalculatePayAppTotals(payApp, lineItems);

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(await BuildDetailDto(payApp, cancellationToken));
    }

    public async Task<Result<PaymentApplicationDetailDto>> GetDetailAsync(
        Guid id, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == id && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDetailDto>("Payment application not found", "NOT_FOUND");

        return Result.Success(await BuildDetailDto(payApp, cancellationToken));
    }

    public async Task<Result<PaymentApplicationG702Dto>> GetSummaryAsync(
        Guid id, AccountingBookType? bookType = null, CancellationToken cancellationToken = default)
    {
        var payApp = await db.Set<PaymentApplication>()
            .AsNoTracking()
            .FirstOrDefaultAsync(pa => pa.Id == id && !pa.IsDeleted, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationG702Dto>("Payment application not found", "NOT_FOUND");

        var subcontract = await db.Set<Subcontract>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == payApp.SubcontractId && !s.IsDeleted, cancellationToken);

        if (subcontract is null)
            return Result.Failure<PaymentApplicationG702Dto>("Subcontract not found", "NOT_FOUND");

        return Result.Success(BuildG702(payApp, subcontract));
    }

    // === Private Helpers ===

    private async Task<PaymentApplicationSettings> GetSettingsAsync(
        Guid companyId, CancellationToken cancellationToken)
    {
        var company = await db.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId && !c.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken);

        return company?.PaymentApplicationSettings ?? new PaymentApplicationSettings();
    }

    private static void RecalculateLineItem(PaymentApplicationLineItem li)
    {
        var workToDate = li.WorkCompletedPrevious + li.WorkCompletedThisPeriod;
        li.MaterialsStoredToDate = li.MaterialsStoredPrevious + li.MaterialsStoredThisPeriod;
        li.TotalCompletedAndStoredToDate = workToDate + li.MaterialsStoredToDate;
        li.PercentComplete = li.ScheduledValue != 0
            ? Math.Round(li.TotalCompletedAndStoredToDate / li.ScheduledValue * 100, 4)
            : 0m;
        li.BalanceToFinish = li.ScheduledValue - li.TotalCompletedAndStoredToDate;
        li.RetainageAmount = (li.WorkCompletedThisPeriod + li.MaterialsStoredThisPeriod)
            * (li.RetainagePercent / 100m);
    }

    private static void RecalculatePayAppTotals(
        PaymentApplication payApp, IList<PaymentApplicationLineItem> lineItems)
    {
        payApp.WorkCompletedThisPeriod = lineItems.Sum(li => li.WorkCompletedThisPeriod);
        payApp.StoredMaterials = lineItems.Sum(li => li.MaterialsStoredThisPeriod);
        payApp.WorkCompletedToDate = payApp.WorkCompletedPrevious + payApp.WorkCompletedThisPeriod;
        payApp.TotalCompletedAndStored = lineItems.Sum(li => li.TotalCompletedAndStoredToDate);
        payApp.RetainageThisPeriod = lineItems.Sum(li => li.RetainageAmount);
        payApp.TotalRetainage = payApp.RetainagePrevious + payApp.RetainageThisPeriod;
        payApp.TotalEarnedLessRetainage = payApp.TotalCompletedAndStored - payApp.TotalRetainage;
        payApp.CurrentPaymentDue = payApp.TotalEarnedLessRetainage - payApp.LessPreviousCertificates;
    }

    private async Task<PaymentApplicationDetailDto> BuildDetailDto(
        PaymentApplication payApp, CancellationToken cancellationToken)
    {
        var lineItems = await db.Set<PaymentApplicationLineItem>()
            .AsNoTracking()
            .Where(li => li.PaymentApplicationId == payApp.Id && !li.IsDeleted)
            .OrderBy(li => li.SortOrder)
            .ToListAsync(cancellationToken);

        var bookEntries = await db.Set<PaymentApplicationBookEntry>()
            .AsNoTracking()
            .Where(be => be.PaymentApplicationId == payApp.Id && !be.IsDeleted)
            .ToListAsync(cancellationToken);

        var subcontract = await db.Set<Subcontract>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == payApp.SubcontractId && !s.IsDeleted, cancellationToken);

        var g702 = subcontract is not null
            ? BuildG702(payApp, subcontract)
            : new PaymentApplicationG702Dto(0, 0, 0, 0, 0, 0, 0, 0, 0);

        return new PaymentApplicationDetailDto(
            Id: payApp.Id,
            SubcontractId: payApp.SubcontractId,
            ScheduleOfValuesId: payApp.ScheduleOfValuesId,
            ApplicationNumber: payApp.ApplicationNumber,
            PeriodStart: payApp.PeriodStart,
            PeriodEnd: payApp.PeriodEnd,
            Status: payApp.Status,
            CurrentPaymentDue: payApp.CurrentPaymentDue,
            TotalCompletedAndStored: payApp.TotalCompletedAndStored,
            TotalRetainage: payApp.TotalRetainage,
            RetainagePercent: payApp.RetainagePercent,
            PaidAmount: payApp.PaidAmount,
            SubmittedDate: payApp.SubmittedDate,
            ReviewedDate: payApp.ReviewedDate,
            ApprovedDate: payApp.ApprovedDate,
            PaidDate: payApp.PaidDate,
            ApprovedBy: payApp.ApprovedBy,
            ReviewedBy: payApp.ReviewedBy,
            RejectedBy: payApp.RejectedBy,
            RejectionReason: payApp.RejectionReason,
            RejectedDate: payApp.RejectedDate,
            InvoiceNumber: payApp.InvoiceNumber,
            CheckNumber: payApp.CheckNumber,
            Notes: payApp.Notes,
            G702: g702,
            G703LineItems: lineItems.Select(MapLineItemToDto).ToList(),
            BookEntries: bookEntries.Select(MapBookEntryToDto).ToList()
        );
    }

    private static PaymentApplicationG702Dto BuildG702(
        PaymentApplication payApp, Subcontract subcontract)
    {
        var originalContractSum = subcontract.OriginalValue;
        var netChange = subcontract.CurrentValue - subcontract.OriginalValue;
        var contractSumToDate = subcontract.CurrentValue;

        return new PaymentApplicationG702Dto(
            OriginalContractSum: originalContractSum,
            NetChangeByChangeOrders: netChange,
            ContractSumToDate: contractSumToDate,
            TotalCompletedAndStoredToDate: payApp.TotalCompletedAndStored,
            RetainageToDate: payApp.TotalRetainage,
            TotalEarnedLessRetainage: payApp.TotalEarnedLessRetainage,
            LessPreviousCertificates: payApp.LessPreviousCertificates,
            CurrentPaymentDue: payApp.CurrentPaymentDue,
            BalanceToFinish: contractSumToDate - payApp.TotalEarnedLessRetainage
        );
    }

    private static PaymentApplicationLineItemDto MapLineItemToDto(PaymentApplicationLineItem li) =>
        new(li.Id, li.SOVLineItemId, li.ItemNumber, li.Description, li.ScheduledValue,
            li.WorkCompletedPrevious, li.WorkCompletedThisPeriod,
            li.MaterialsStoredPrevious, li.MaterialsStoredThisPeriod,
            li.TotalCompletedAndStoredToDate, li.PercentComplete, li.BalanceToFinish,
            li.RetainagePercent, li.RetainageAmount, li.SortOrder);

    private static PaymentApplicationBookEntryDto MapBookEntryToDto(PaymentApplicationBookEntry be) =>
        new(be.Id, be.BookType, be.EarnedRevenueToDate, be.CurrentPeriodRevenue,
            be.BillingsToDate, be.CurrentPeriodBilling, be.RetainageHeldToDate,
            be.OverUnderBilling, be.GeneratedAt);
}
